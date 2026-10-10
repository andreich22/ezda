import {test, expect} from "@playwright/test";

test("registration confirms email through the server callback and creates a session", async ({page, request}) => {
  test.setTimeout(120_000);
  const email = `e2e-${Date.now()}@example.test`;
  const password = "E2e-password-123!";

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

  await expect(
    page.getByText("Account created. Check your email to confirm the account before signing in."),
  ).toBeVisible({timeout: 30_000});

  const confirmation = await request.get(
    `http://127.0.0.1:4010/test/confirmation?email=${encodeURIComponent(email)}`,
  );
  expect(confirmation.ok()).toBeTruthy();
  const {url} = await confirmation.json();

  await page.goto(url);
  await expect(page).toHaveURL(/\/auth\?confirmed=1$/);
  await expect(page.getByRole("heading", {name: "You are signed in"})).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", {name: "Open menu"}).click();
  await page.getByRole("button", {name: "Sign out"}).click();

  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", {name: "Sign in"})).toBeVisible();

  const sessionResponse = await page.request.get("/api/auth/session");
  expect(sessionResponse.ok()).toBeTruthy();
  await expect(sessionResponse.json()).resolves.toMatchObject({user: null});
});
