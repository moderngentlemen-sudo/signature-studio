import { expect, test } from "@playwright/test";
import { stageText, startWithSample } from "./helpers";
import { readFileSync } from "node:fs";

test("export a project file and import it as a new project", async ({ page }) => {
  await startWithSample(page);
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("listitem").filter({ hasText: "Project file" }).getByRole("button", { name: "Download" }).click()]);
  const path = await download.path();
  const text = readFileSync(path!, "utf8");
  const data = JSON.parse(text);
  expect(data.format).toBe("signature-studio.file");
  expect(data.project.schema).toBe("signature-studio.project");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Your signatures" }).click();
  await page.locator("input[type=file]").last().setInputFiles({ name: "p.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByText(/Imported/)).toBeVisible();
  await expect.poll(() => stageText(page)).toContain("Alexander Grant");
  await page.getByRole("button", { name: "Your signatures" }).click();
  await expect(page.locator("dialog[open] .readiness li")).toHaveCount(2);
});

test("a damaged import is refused without touching existing work", async ({ page }) => {
  await startWithSample(page);
  await page.getByRole("button", { name: "Your signatures" }).click();
  await page.locator("input[type=file]").last().setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"schema":"nope"}') });
  await expect(page.getByText("This file isn't a Signature Studio project.")).toBeVisible();
  await expect(page.locator("dialog[open] .readiness li")).toHaveCount(1);
});

test("PNG export produces an image", async ({ page }) => {
  await startWithSample(page);
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("listitem").filter({ hasText: "PNG image" }).getByRole("button", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toMatch(/@2x\.png$/);
  const buf = readFileSync((await download.path())!);
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
});

test("mobile: preview and basic editing work on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startWithSample(page, "simple");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByTestId("profile-title").fill("Partner");
  await expect.poll(() => stageText(page)).toContain("Partner");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("every button has an accessible name", async ({ page }) => {
  await startWithSample(page);
  const unnamed = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter((b) => b.offsetParent !== null)
      .filter((b) => !(b.getAttribute("aria-label") || b.textContent?.trim() || b.getAttribute("title")))
      .map((b) => b.outerHTML.slice(0, 120)),
  );
  expect(unnamed).toEqual([]);
});
