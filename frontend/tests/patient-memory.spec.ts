import { test, expect } from "@playwright/test";

test("Patient Memory retrieves earlier history with MedEmbed and shows its benchmark", async ({ page }) => {
  await expect.poll(async () => (await page.request.get("/api/health")).status(), { timeout: 30000 }).toBe(200);
  await page.goto("/login");
  await page.getByLabel("Email address").fill("doctor1@example.com");
  await page.getByLabel("Password", { exact: true }).fill("ZeestDemo!2026");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await page.goto("/patient-memory");
  await expect(page.getByRole("heading", { name: "Patient Memory", exact: true })).toBeVisible();
  await page.getByLabel("Patient").selectOption({ label: "Amina Noor" });
  await expect(page.locator("#memory-cutoff option")).toHaveCount(2);
  await page.getByLabel("Search question or keywords").fill("cough");
  await page.getByRole("button", { name: "Retrieve patient history" }).click();

  await expect(page.getByRole("heading", { name: "Retrieved history" })).toBeVisible();
  await expect(page.locator(".findings-list")).toContainText("Intermittent cough");
  await expect(page.getByRole("heading", { name: "Retrieval model experiment" })).toBeVisible();
  await expect(page.getByText("MedEmbed Recall@1")).toBeVisible();
  await page.getByText("Method and limitations").click();
  await expect(page.getByText(/revision 40a5850d.*local only/)).toBeVisible();
});
