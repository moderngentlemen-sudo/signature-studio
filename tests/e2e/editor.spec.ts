import { expect, test } from "@playwright/test";
import { dragTo, stage, stageText, startWithSample } from "./helpers";

test("first-run onboarding uses the typed details", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("ob-name").fill("Jordan Ellis");
  await page.getByLabel("Job title").fill("Founder");
  await page.getByTestId("ob-start").click();
  await expect(page.getByTestId("stage")).toBeVisible();
  await expect.poll(() => stageText(page)).toContain("Jordan Ellis");
  await expect.poll(() => stageText(page)).toContain("Founder");
});

test("inline editing a connected field updates the shared profile", async ({ page }) => {
  await startWithSample(page);
  const name = stage(page).getByText("Alexander Grant").first();
  await name.dblclick();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Morgan Hale");
  await page.keyboard.press("Enter");
  await expect.poll(() => stageText(page)).toContain("Morgan Hale");
  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("profile-fullName")).toHaveValue("Morgan Hale");
});

test("dragging a library component onto the canvas inserts it, undo removes it", async ({ page }) => {
  await startWithSample(page);
  const item = page.getByTestId("lib-button");
  await item.scrollIntoViewIfNeeded();
  const from = (await item.boundingBox())!;
  const target = (await stage(page).getByText("moderngentlemen.co").last().boundingBox())!;
  await dragTo(page, { x: from.x + 20, y: from.y + 10 }, { x: target.x + target.width / 2, y: target.y + target.height - 2 });
  await expect.poll(() => stageText(page)).toContain("Learn more");
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => stageText(page)).not.toContain("Learn more");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => stageText(page)).toContain("Learn more");
});

test("click-to-insert, duplicate and delete with keyboard", async ({ page }) => {
  await startWithSample(page);
  await page.getByTestId("lib-text").click();
  await expect.poll(() => stageText(page)).toContain("Your text here");
  await page.keyboard.press("ControlOrMeta+d");
  await expect.poll(async () => ((await stageText(page)).match(/Your text here/g) ?? []).length).toBe(2);
  await page.keyboard.press("Delete");
  await expect.poll(async () => ((await stageText(page)).match(/Your text here/g) ?? []).length).toBe(1);
});

test("Full / Reply visibility is respected literally", async ({ page }) => {
  await startWithSample(page);
  // Disclaimer is Full-only in this template.
  await expect.poll(() => stageText(page)).toContain("confidential");
  await page.getByTitle(/Signature for replies/).click();
  await page.getByRole("button", { name: "Hidden components" }).click(); // hide ghosts
  await expect.poll(() => stageText(page)).not.toContain("confidential");
  // Make the job title Reply-only: it must appear in Reply and not in Full.
  await stage(page).getByText("Creative Director").first().click();
  await page.getByTestId("inspector").getByRole("button", { name: "Reply", exact: true }).click();
  await expect.poll(() => stageText(page)).toContain("Creative Director");
  await page.getByTitle(/Signature for new emails/).click();
  await expect.poll(() => stageText(page)).not.toContain("Creative Director");
});

test("switching templates keeps custom content in Extras and can be undone", async ({ page }) => {
  await startWithSample(page);
  await page.getByTestId("lib-text").click();
  await page.getByTestId("inspector").getByLabel("Text").fill("Ask me about bespoke tailoring");
  await page.getByTestId("tab-templates").click();
  await page.getByTestId("template-luxury-maison").click();
  await expect(page.getByTestId("apply-template")).toContainText("Moved to Extras");
  await page.getByTestId("apply-template-confirm").click();
  await expect.poll(() => stageText(page)).toContain("Ask me about bespoke tailoring");
  await expect.poll(() => stageText(page)).toContain("Alexander Grant");
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => stageText(page)).toContain("Ask me about bespoke tailoring");
});

test("layers panel reorders by drag", async ({ page }) => {
  await startWithSample(page);
  await page.getByTestId("tab-layers").click();
  const rows = page.locator("[data-layer-id]");
  const disclaimer = page.locator(".layer", { hasText: "Disclaimer" });
  const columns = page.locator(".layer", { hasText: "Columns" });
  const a = (await disclaimer.boundingBox())!;
  const b = (await columns.boundingBox())!;
  await dragTo(page, { x: a.x + 40, y: a.y + a.height / 2 }, { x: b.x + 60, y: b.y + 3 });
  await expect(rows.nth(1)).toContainText("Disclaimer");
});

test("autosave survives a reload", async ({ page }) => {
  await startWithSample(page);
  await page.getByTestId("tab-profile").click();
  await page.getByTestId("profile-title").fill("Head of Brand");
  await expect(page.getByText("Saved in this browser")).toBeVisible({ timeout: 5000 });
  await page.reload();
  await expect.poll(() => stageText(page)).toContain("Head of Brand");
});
