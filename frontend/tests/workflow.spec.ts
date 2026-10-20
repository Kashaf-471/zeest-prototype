import { test, expect } from "@playwright/test";
import path from "node:path";
test("physician workflow and laptop/narrow screen review", async ({ page }) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("request", (req) => {
    if (!new URL(req.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      externalRequests.push(req.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Log in", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/login-laptop.png",
    fullPage: true,
  });
  await page.getByLabel("Email address").fill("doctor1@example.com");
  await page.getByLabel("Password", { exact: true }).fill("ZeestDemo!2026");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My Patients", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My Patients", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My Patients", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/patients-laptop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/patients-narrow.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole("link").filter({ hasText: "Amina Demo 1" }).click();
  await expect(
    page.getByRole("heading", { name: "Encounter history" }),
  ).toBeVisible();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/details-laptop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/details-narrow.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page
    .getByRole("link", { name: "Open Encounter", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Consultation", exact: true }),
  ).toBeVisible();
  const encounterUrl = page.url();
  await page
    .getByRole("tab", { name: "Structured Notes", exact: true })
    .click();
  await page
    .getByLabel("Subjective", { exact: true })
    .fill("Synthetic browser test: cough for three days.");
  await page.getByRole("button", { name: "Save Notes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Notes saved" }),
  ).toBeVisible();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/consultation-laptop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Clinical Inputs", exact: true })
    .click();
  await page.getByLabel("PNG, JPEG, PDF or TXT").setInputFiles({
    name: "arbitrary.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Unknown browser upload"),
  });
  await expect(page.getByText("Upload saved.", { exact: false })).toBeVisible();
  await page.getByRole("tab", { name: "Laboratory", exact: true }).click();
  await page
    .getByLabel("Values, units and supplied source")
    .fill("Synthetic Hb 12.8 g/dL, browser test source");
  await page.getByRole("button", { name: "Save Input", exact: true }).click();
  await expect(
    page.getByText("Input saved with its source revision."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Medication", exact: true }).click();
  await page
    .getByLabel("Medication, dose, frequency and supplied source")
    .fill("Synthetic: no current medication, test source");
  await page.getByRole("button", { name: "Save Input", exact: true }).click();
  await expect(
    page.getByText("Input saved with its source revision."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Findings", exact: true }).click();
  await page.getByRole("button", { name: "Load Simulated Findings" }).click();
  await expect(page.getByText("Fixed scenario findings loaded.")).toBeVisible();
  await expect(
    page.getByText("No simulated analysis mapped to this input").first(),
  ).toBeVisible();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/inputs-laptop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Generate Simulated Draft" }).click();
  await expect(
    page.getByText("Simulated draft created from a saved source snapshot."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Critic Findings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Simulated critic findings" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Evidence", exact: true }).click();
  await page.getByRole("button", { name: "Modify", exact: true }).click();
  await page
    .getByLabel("Edit diagnosis", { exact: true })
    .fill("Physician-edited synthetic draft");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    page.getByText("New pending revision saved.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/rejection-dialog.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirm Rejection" }).click();
  await expect(
    page.getByText("Draft rejected.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate Simulated Draft" }).click();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/approval-dialog.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirm Approval" }).click();
  await expect(
    page.getByText("Exact saved revision approved and recorded."),
  ).toBeVisible();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/review-laptop.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Encounter workflow" })
    .getByRole("link", { name: "Patient Records", exact: true })
    .click();
  await expect(
    page.getByText("Simulated clinical content · physician approved").first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Audit History/ }).click();
  await expect(
    page.getByRole("heading", { name: "Append-only audit history" }),
  ).toBeVisible();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/records-laptop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const suffix of ["records", "review", "inputs", "consultation"]) {
    await page.goto(encounterUrl.replace(/consultation$/, suffix));
    await expect(
      page.getByRole("heading", {
        name:
          suffix === "records"
            ? "Patient Records"
            : suffix === "review"
              ? "Clinical Review"
              : suffix === "inputs"
                ? "Clinical Inputs and Findings"
                : "Consultation",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator('[aria-label="Loading workspace data"]'),
    ).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../verification/${suffix}-narrow.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Log Out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Log in", exact: true }),
  ).toBeVisible();
  await page.goto("/signup");
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/signup-narrow.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: "Create an account", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
