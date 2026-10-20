import { test, expect } from "@playwright/test";
test("registration creates an empty physician account and rejects duplicate email", async ({
  page,
}) => {
  const email = `new-physician-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/signup-laptop.png",
    fullPage: true,
  });
  await page.getByLabel("Full name").fill("New Demo Physician");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("NewDemoPassword!2026");
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Log in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("NewDemoPassword!2026");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(
    page.getByText("No patients assigned.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("No patients assigned.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log Out", exact: true }).click();
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Duplicate Demo");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("NewDemoPassword!2026");
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(page.locator('main [role="alert"] p')).toHaveText(
    "Email already registered.",
  );
});
