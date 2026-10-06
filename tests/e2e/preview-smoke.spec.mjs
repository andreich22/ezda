import {test, expect} from "@playwright/test";

async function installDiagnostics(page) {
  const consoleErrors = [];
  const failedRequests = [];
  const apiFailures = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  page.on("requestfailed", (request) => {
    failedRequests.push({
      method: request.method(),
      url: request.url(),
      error: request.failure()?.errorText || "request failed",
    });
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      apiFailures.push({status: response.status(), url: response.url()});
    }
  });

  return {consoleErrors, failedRequests, apiFailures};
}

async function assertNoDiagnostics(diagnostics) {
  expect(
    diagnostics.consoleErrors,
    "browser console errors",
  ).toEqual([]);
  expect(
    diagnostics.apiFailures,
    "HTTP 5xx responses",
  ).toEqual([]);
}

test("preview smoke: app, auth session, route builder and routes catalog", async ({page, request}) => {
  test.setTimeout(120_000);
  const diagnostics = await installDiagnostics(page);

  await page.goto("/");
  await expect(page.getByRole("heading", {name: "Build a cycling route"})).toBeVisible();
  await expect(page.locator("#map-host canvas")).toBeVisible({timeout: 30_000});

  const session = await request.get("/api/auth/session");
  expect(session.ok()).toBeTruthy();
  const sessionBody = await session.json();
  expect(sessionBody).toHaveProperty("user");

  await page.locator("#map-host").click({position: {x: 120, y: 120}});
  await page.locator("#map-host").click({position: {x: 360, y: 240}});

  await expect(page.getByText("Start")).toBeVisible();
  await expect(page.getByText("Finish")).toBeVisible();
  await expect(page.getByText(/Routing:/)).toBeVisible({timeout: 45_000});

  const saveButton = page.getByRole("button", {name: "Save route"});
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await page.goto("/routes");
  await expect(page.getByRole("heading", {name: /routes/i})).toBeVisible();
  await expect(page.getByRole("link", {name: /Build a route/i})).toBeVisible();

  await page.goto("/auth");
  await expect(page.getByRole("heading", {name: /Sign in|You are signed in/})).toBeVisible();

  const routesResponse = await request.get("/api/routes?visibility=public&page=1&limit=50");
  expect(routesResponse.ok()).toBeTruthy();
  const routesBody = await routesResponse.json();
  expect(routesBody).toMatchObject({
    page: 1,
    pageSize: 50,
    items: expect.any(Array),
  });

  await assertNoDiagnostics(diagnostics);
});

test("preview smoke: critical mobile layout", async ({page}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({width: 390, height: 844});
  const diagnostics = await installDiagnostics(page);

  await page.goto("/");
  await expect(page.getByRole("heading", {name: "Build a cycling route"})).toBeVisible();
  await expect(page.getByRole("button", {name: /sidebar/i})).toBeVisible();
  await expect(page.locator("#map-host canvas")).toBeVisible({timeout: 30_000});

  await page.getByRole("button", {name: /sidebar/i}).click();
  await expect(page.locator("#route-sidebar")).toHaveAttribute("aria-hidden", "true");

  await assertNoDiagnostics(diagnostics);
});
