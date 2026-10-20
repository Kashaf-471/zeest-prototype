import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
async function login(page: any) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("doctor1@example.com");
  await page.getByLabel("Password", { exact: true }).fill("ZeestDemo!2026");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metrics .metric-card")).toHaveCount(4);
}
test("dashboard, search, unsaved changes, accessible tabs and responsive navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  const summary = await (await page.request.get("/api/workspace")).json();
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Assigned patients" })
      .locator("strong"),
  ).toHaveText(String(summary.metrics.patients));
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/redesign-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "My Patients", exact: true }).click();
  await page.getByLabel("Search patients").fill("no-such-patient");
  await expect(
    page.getByRole("heading", { name: "No matching patients" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByLabel("Search patients").fill("Amina");
  await expect(page.locator(".patient-directory-row")).toHaveCount(1);
  await page.locator(".patient-directory-row").click();
  await page
    .getByRole("link", { name: "Open Encounter", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Consultation", exact: true }),
  ).toBeVisible();
  const unsaved = `Unsaved interface verification note ${Date.now()}`;
  await page.getByLabel("Recognised transcript", { exact: true }).fill(unsaved);
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Encounter workflow" })
    .getByRole("link", { name: "Clinical Inputs", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Leave this page?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay here" }).click();
  await expect(
    page.getByLabel("Recognised transcript", { exact: true }),
  ).toHaveValue(unsaved);
  await page.getByRole("tab", { name: "Transcript", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Structured Notes" }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Structured Notes" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Save Notes", exact: true }).click();
  await expect(page.getByText("Notes saved as a new revision.")).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/redesign-consultation.png",
    fullPage: true,
  });
  const encounter = page.url().replace(/consultation$/, "");
  for (const screen of ["inputs", "review", "records"]) {
    await page.goto(encounter + screen);
    await expect(page.locator(".patient-context")).toBeVisible();
    await expect(
      page.locator('[aria-label="Loading workspace data"]'),
    ).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../verification/redesign-${screen}.png`,
      fullPage: true,
    });
  }
  for (const route of ["/reviews", "/records", "/guide", "/dashboard"]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(
      page.locator('[aria-label="Loading workspace data"]'),
    ).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../verification/redesign-${route.slice(1)}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "My Patients", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  for (const route of [
    "/dashboard",
    "/patients",
    "/guide",
    encounter + "consultation",
    encounter + "inputs",
    encounter + "review",
    encounter + "records",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBeTruthy();
    await expect(
      page.locator('[aria-label="Loading workspace data"]'),
    ).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../verification/redesign-mobile-${route.split("/").at(-1)}.png`,
      fullPage: true,
    });
  }
});
test("WCAG accessibility checks across authentication and clinical pages", async ({
  page,
}) => {
  const violations: any[] = [];
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Log in", exact: true }),
  ).toBeVisible();
  async function check(route: string) {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    for (const v of results.violations)
      violations.push({
        route,
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      });
  }
  await check("/login");
  await login(page);
  for (const route of [
    "/dashboard",
    "/patients",
    "/patients/1",
    "/patients/1/encounters/1/consultation",
    "/patients/1/encounters/1/inputs",
    "/patients/1/encounters/1/review",
    "/records",
    "/guide",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(
      page.locator('[aria-label="Loading workspace data"]'),
    ).toHaveCount(0);
    await check(route);
  }
  writeFileSync(
    "../verification/accessibility-report.json",
    JSON.stringify(violations, null, 2),
  );
  expect(
    violations.map((v) => ({
      route: v.route,
      id: v.id,
      count: v.nodes.length,
    })),
  ).toEqual([]);
});
