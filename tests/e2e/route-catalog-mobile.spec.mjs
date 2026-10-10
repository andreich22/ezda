import {test, expect} from "@playwright/test";

// Regression test for issue #195: on mobile the /routes catalog must scroll
// when there are many cards, and the pagination buttons must stay inside the
// viewport (320px and up).
//
// The catalog API is stubbed with a deterministic two-page payload so the
// test never depends on a database. The stub honors the `page` query param,
// mirroring the production contract (items/page/pageSize/total/hasNextPage).
//
// NOTE: assertions use real user input (mouse wheel) and layout measurements
// instead of programmatic scrolling: `overflow:hidden` still allows scripted
// `scrollTo`, so only a wheel event proves the page is scrollable for a user.
function catalogItem(index) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `Stub route ${index}`,
    description: "Stubbed catalog entry for the mobile scroll regression test",
    distanceMeters: 5000 + index,
    durationSeconds: 1500,
    elevationGainMeters: 42,
    createdAt: "2026-10-01T00:00:00.000Z",
    isPublic: true,
  };
}

async function stubCatalogApi(page) {
  await page.route("**/api/routes*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/routes") return route.continue();
    const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const currentPage = pageParam === 2 ? 2 : 1;
    const start = currentPage === 2 ? 12 : 0;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: Array.from({length: 12}, (_, i) => catalogItem(start + i)),
        page: currentPage,
        pageSize: 50,
        total: 60,
        hasNextPage: currentPage === 1,
      }),
    });
  });
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectWheelScrollWorks(page) {
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(180, 300);
  await page.mouse.wheel(0, 800);
  await page.waitForFunction((y) => window.scrollY > y, before, {timeout: 5000});
}

async function expectPaginationInsideViewport(page) {
  const viewport = page.viewportSize();
  for (const name of ["← Previous", "Next →"]) {
    const box = await page.getByRole("button", {name}).boundingBox();
    expect(box, `${name} button is rendered`).not.toBeNull();
    expect(box.x, `${name} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${name} right edge`).toBeLessThanOrEqual(viewport.width);
  }
}

test("catalog scrolls on mobile and pagination stays on screen", async ({page}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({width: 360, height: 640});
  await stubCatalogApi(page);

  await page.goto("/routes");
  await expect(page.getByRole("heading", {name: "Public routes"})).toBeVisible();
  await expect(page.getByRole("link", {name: /Stub route 0/})).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  // Twelve cards overflow a 640px-high viewport: a real wheel gesture must
  // move the page, and nothing may stick out horizontally.
  await expectNoHorizontalOverflow(page);
  await expectWheelScrollWorks(page);

  // Pagination is reachable at the bottom and fully inside the viewport.
  await page.getByRole("button", {name: "Next →"}).scrollIntoViewIfNeeded();
  await expectPaginationInsideViewport(page);

  // Paging forward works (URL + page indicator update).
  await page.getByRole("button", {name: "Next →"}).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  expect(page.url()).toContain("page=2");
});

test("pagination fits a 320px-wide phone", async ({page}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({width: 320, height: 568});
  await stubCatalogApi(page);

  await page.goto("/routes");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectWheelScrollWorks(page);
  await page.getByRole("button", {name: "Next →"}).scrollIntoViewIfNeeded();
  await expectPaginationInsideViewport(page);
});
