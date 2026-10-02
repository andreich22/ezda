import {test, expect} from "@playwright/test";

test("registration confirms email through the server callback and creates a session", async ({page, request}) => {
  const email = `e2e-${Date.now()}@example.test`;
  const password = "E2e-password-123!";

  await page.goto("/auth");
  await page.getByRole("button", {name: "Create account"}).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", {name: "Create account"}).click();

  await expect(page.getByText("Account created. Check your email to confirm the account before signing in.")).toBeVisible();

  const confirmation = await request.get(
    `http://127.0.0.1:4010/test/confirmation?email=${encodeURIComponent(email)}`,
  );
  expect(confirmation.ok()).toBeTruthy();
  const {url} = await confirmation.json();

  await page.goto(url);
  await expect(page).toHaveURL(/\/auth\?confirmed=1$/);
  await expect(page.getByRole("heading", {name: "You are signed in"})).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});
