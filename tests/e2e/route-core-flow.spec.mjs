import {test, expect} from "@playwright/test";

// E2E for the core user flow (issue #53):
// open app -> select two points -> calculate route -> save -> open public page.
//
// The routing API is stubbed with a deterministic straight-line payload so the
// test never depends on an external routing provider (ORS/OSM) or its network
// availability. The stub keeps the production response contract
// (geometry/distanceMeters/durationSeconds/elevationGainMeters/source).
const STUBBED_ROUTE = {
  geometry: {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [37.6, 55.75],
        [37.65, 55.76],
      ],
    },
  },
  distanceMeters: 5000,
  durationSeconds: 1500,
  elevationGainMeters: 42,
  source: "Straight-line fallback (E2E stub)",
};

async function stubRoutingApi(page) {
  await page.route("**/api/route", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(STUBBED_ROUTE),
    });
  });
}

async function buildRouteOnMap(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", {name: "Build a cycling route"})).toBeVisible();
  await expect(page.locator("#map-host canvas")).toBeVisible({timeout: 30_000});

  await page.locator("#map-host").click({position: {x: 120, y: 120}});
  await page.locator("#map-host").click({position: {x: 360, y: 240}});

  await expect(page.getByText("Start", {exact: true})).toBeVisible();
  await expect(page.getByText("Finish", {exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: /Remove .* point/})).toHaveCount(2);
  await expect(page.getByText(/Routing:/)).toBeVisible({timeout: 15_000});
}

test("core flow: two points calculate a route and expose save validation states", async ({page}) => {
  test.setTimeout(120_000);
  await stubRoutingApi(page);
  await buildRouteOnMap(page);

  // Controlled stub values must reach the summary UI.
  await expect(page.getByText("5.0 km")).toBeVisible();
  await expect(page.getByText("25 min")).toBeVisible();
  await expect(page.getByText(/42 m/)).toBeVisible();

  // Save form appears only after a route is calculated; saving requires a title.
  const saveButton = page.getByRole("button", {name: "Save route"});
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await page.getByLabel("Title").fill("E2E validation probe");
  await expect(saveButton).toBeEnabled();

  // Visibility defaults to Public and can be switched to Private and back.
  const visibility = page.getByRole("group", {name: "Visibility"});
  await expect(visibility.getByRole("button", {name: "Public"})).toHaveAttribute("aria-pressed", "true");
  await expect(visibility.getByRole("button", {name: "Private"})).toHaveAttribute("aria-pressed", "false");
  await visibility.getByRole("button", {name: "Private"}).click();
  await expect(visibility.getByRole("button", {name: "Private"})).toHaveAttribute("aria-pressed", "true");
  await expect(visibility.getByRole("button", {name: "Public"})).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Private routes are visible only to you.")).toBeVisible();
  await visibility.getByRole("button", {name: "Public"}).click();
  await expect(visibility.getByRole("button", {name: "Public"})).toHaveAttribute("aria-pressed", "true");

  // Without a session the API rejects with 401 and the UI surfaces a short
  // friendly message (mapped from the AUTH_REQUIRED error code).
  await saveButton.click();
  await expect(page.getByText("Please sign in to save routes.")).toBeVisible({timeout: 15_000});

  // Each route point has a remove button; removing the finish leaves the
  // start behind, and undo restores the removed point with a recalculated route.
  await page.getByRole("button", {name: "Remove finish point"}).click();
  await expect(page.getByText("Finish", {exact: true})).toHaveCount(0);
  await expect(page.getByText("Start", {exact: true})).toBeVisible();
  await page.getByRole("button", {name: /Undo/}).click();
  await expect(page.getByText("Finish", {exact: true})).toBeVisible();
  await expect(page.getByText(/Routing:/)).toBeVisible({timeout: 15_000});
});

test("core flow: mobile layout keeps route building reachable", async ({page}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({width: 390, height: 844});
  await stubRoutingApi(page);
  await buildRouteOnMap(page);

  await expect(page.getByRole("button", {name: /sidebar/i})).toBeVisible();
  await expect(page.getByRole("button", {name: "Save route"})).toBeVisible();
});

test("core flow: save persists and the public page + catalog expose the route", async ({page, request}) => {
  test.setTimeout(180_000);

  // Full persistence needs PostgreSQL. CI runners without DATABASE_URL get a
  // clear skip instead of a false failure; local docker (`db` service) and
  // Preview/Production run the whole flow.
  const catalogProbe = await request.get("/api/routes?visibility=public&page=1&limit=1");
  test.skip(!catalogProbe.ok(), "route persistence needs a database; /api/routes is unavailable");

  await stubRoutingApi(page);

  const email = `e2e-flow-${Date.now()}@example.test`;
  const password = "E2e-password-123!";
  const title = `E2E Core Flow ${Date.now()}`;
  const description = "Saved by the core-flow E2E test";

  // Register through the real UI + server confirmation callback.
  await page.goto("/auth");
  await page.getByRole("button", {name: "Create account"}).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const signupResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/signup"),
  );
  await page.getByRole("button", {name: "Create account"}).click();
  const signupResponse = await signupResponsePromise;
  expect(signupResponse.ok()).toBeTruthy();

  const confirmation = await request.get(
    `http://127.0.0.1:4010/test/confirmation?email=${encodeURIComponent(email)}`,
  );
  expect(confirmation.ok()).toBeTruthy();
  const {url} = await confirmation.json();
  await page.goto(url);
  await expect(page).toHaveURL(/\/auth\?confirmed=1$/);

  // Build, save, and follow the redirect to the public route page.
  await buildRouteOnMap(page);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(description);

  // The app navigates to the public page immediately after saving, so the
  // response body may be gone by the time we read it. Capture only the
  // status here and derive the route URL from the navigation itself.
  let saveStatus = 0;
  page.on("response", (response) => {
    if (response.request().method() === "POST" && response.url().endsWith("/api/routes")) {
      saveStatus = response.status();
    }
  });
  await page.getByRole("button", {name: "Save route"}).click();
  await page.waitForURL(/\/routes\/[0-9a-f-]{36}\/?$/, {timeout: 30_000});
  expect(saveStatus).toBe(201);
  const saved = {url: new URL(page.url()).pathname};

  await expect(page).toHaveURL(saved.url, {timeout: 30_000});
  await expect(page.getByRole("heading", {name: title})).toBeVisible();
  await expect(page.getByRole("button", {name: "Copy link"})).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText("5.0 km")).toBeVisible();

  // The route is public: an unauthenticated request can open the same page.
  const publicPage = await request.get(saved.url);
  expect(publicPage.ok()).toBeTruthy();
  const publicHtml = await publicPage.text();
  expect(publicHtml).toContain(title);
  // Guests never see owner actions in the server-rendered HTML.
  expect(publicHtml).not.toContain("Delete route");
  expect(publicHtml).not.toContain("Edit route");

  // The owner sees the edit entry point and the edit page preloads saved values.
  await expect(page.getByRole("link", {name: "Edit route"})).toBeVisible();
  await page.goto(`${saved.url}/edit`);
  await expect(page.getByRole("heading", {name: "Edit route"})).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await expect(page.getByLabel("Description")).toHaveValue(description);
  await expect(page.getByRole("button", {name: "Save changes"}).first()).toBeVisible();

  // The catalog exposes the saved route.
  const titleLink = page.getByRole("link", {name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))});
  await page.goto("/routes");
  await expect(titleLink).toBeVisible({timeout: 30_000});

  // The owner can delete the route: a single click only arms the
  // confirmation, the second click deletes and lands on the catalog.
  await page.goto(saved.url);
  await expect(page.getByRole("button", {name: "Delete route"})).toBeVisible();
  await page.getByRole("button", {name: "Delete route"}).click();
  await expect(page).toHaveURL(saved.url);
  await expect(page.getByRole("button", {name: "Confirm delete"})).toBeVisible();
  await page.getByRole("button", {name: "Confirm delete"}).click();
  await page.waitForURL("/routes", {timeout: 30_000});

  // The deleted route is gone: catalog no longer lists it, detail and edit
  // pages return 404.
  await expect(titleLink).toHaveCount(0);
  expect((await request.get(saved.url)).status()).toBe(404);
  expect((await request.get(`${saved.url}/edit`)).status()).toBe(404);
});
