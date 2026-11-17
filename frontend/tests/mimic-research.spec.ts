import { test, expect } from "@playwright/test";

test("MIMIC research screen displays separate synthetic structured results", async ({ page }) => {
  await expect
    .poll(async () => (await page.request.get("/api/health")).status(), {
      timeout: 30000,
    })
    .toBe(200);
  await page.route("**/api/research/mimic-note/results**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dataset: "MIMIC-IV-Note",
        table: "radiology",
        count: 1,
        research_only: true,
        demo_patient_records_unchanged: true,
        records: [
          {
            note_id: "synthetic-note-01",
            subject_id: "synthetic-subject-01",
            hadm_id: null,
            note_type: "RR",
            charttime: "2099-01-01",
            method: "synthetic test extractor",
            status: "needs_review",
            limitations: ["Synthetic test content only."],
            findings: [
              {
                code: "cough",
                label: "Cough",
                assertion: "present",
                concept_type: "symptom",
                explanation: "Synthetic test only.",
                mentions: [
                  {
                    text: "cough",
                    sentence: "Synthetic report describes cough.",
                    assertion: "present",
                    temporality: "current",
                    experiencer: "patient",
                    method: "synthetic-test",
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email address").fill("doctor1@example.com");
  await page.getByLabel("Password", { exact: true }).fill("ZeestDemo!2026");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/mimic-research");
  await expect(
    page.getByRole("heading", { name: "MIMIC-IV-Note structuring demo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load structured results" }).click();
  await expect(page.getByText("Report synthetic-note-01")).toBeVisible();
  await page.getByText("Report synthetic-note-01").click();
  await expect(page.getByText("Synthetic report describes cough.")).toBeVisible();
  await expect(page.getByText(/does not connect results to prototype patients/)).toBeVisible();
});
