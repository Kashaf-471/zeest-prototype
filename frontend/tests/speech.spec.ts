import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
const fixture = path.resolve("../backend/tests/fixtures/synthetic-speech.wav");
async function login(page: any) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("doctor2@example.com");
  await page.getByLabel("Password", { exact: true }).fill("ZeestDemo!2026");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My Patients", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My Patients", exact: true }),
  ).toBeVisible();
  await page.getByRole("link").filter({ hasText: "Amina Demo 2" }).click();
  await page
    .getByRole("link", { name: "Open Encounter", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Consultation", exact: true }),
  ).toBeVisible();
}
test("real local speech from uploaded synthetic audio can be corrected and saved", async ({
  page,
}) => {
  await login(page);
  await page.getByLabel("WAV, MP3, M4A").setInputFiles(fixture);
  await expect(page.getByText(/Final transcript ready/)).toBeVisible({
    timeout: 60000,
  });
  await expect(
    page.getByLabel("Recognised transcript", { exact: true }),
  ).toHaveValue(/patient reports a cough/i);
  await page
    .getByLabel("Recognised transcript", { exact: true })
    .fill(
      "Physician corrected: synthetic consultation with cough for three days.",
    );
  await page.getByRole("button", { name: "Save Notes", exact: true }).click();
  await expect(page.getByText("Notes saved as a new revision.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Recognised transcript", { exact: true }),
  ).toHaveValue(
    "Physician corrected: synthetic consultation with cough for three days.",
  );
  await expect(
    page.locator('[aria-label="Loading workspace data"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../verification/real-transcription.png",
    fullPage: true,
  });
});
test("PCM microphone capture with virtual synthetic device streams chunks and reconciles final audio", async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${fixture}`,
    ],
  });
  try {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3000",
      permissions: ["microphone"],
    });
    const page = await context.newPage();
    await login(page);
    await page.getByRole("button", { name: "Start Recording" }).click();
    await expect(page.getByText("Recording", { exact: true })).toBeVisible();
    await expect(page.getByText(/Chunk 1 recognised/)).toBeVisible({
      timeout: 60000,
    });
    await expect(
      page.getByLabel("Recognised transcript", { exact: true }),
    ).not.toHaveValue("");
    await page.getByRole("button", { name: "Stop Recording" }).click();
    await expect(page.getByText(/Final transcript ready/)).toBeVisible({
      timeout: 60000,
    });
    await expect(page.locator("audio").first()).toHaveAttribute(
      "src",
      /^blob:/,
    );
    await page.getByRole("button", { name: "Save Notes", exact: true }).click();
    await expect(
      page.getByText("Notes saved as a new revision."),
    ).toBeVisible();
    await expect(
      page.locator('[aria-label="Loading workspace data"]'),
    ).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "../verification/virtual-microphone.png",
      fullPage: true,
    });
    await context.close();
  } finally {
    await browser.close();
  }
});
test("denied microphone permission has a visible error and preserves audio upload fallback", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Start Recording" }).click();
  await expect(page.locator('main [role="alert"]')).toBeVisible();
  await expect(page.getByLabel("WAV, MP3, M4A")).toBeEnabled();
});
