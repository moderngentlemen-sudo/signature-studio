import { expect, test } from "@playwright/test";
import { openWorkspaceTool, startWithSample } from "./helpers";

test("welcome details update the preview and template preview links stay out of the tab order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A small detail.A lasting impression.");
  await page.getByLabel("Your name", { exact: true }).fill("Jordan Ellis");
  await expect(page.locator(".welcome-preview")).toContainText("Jordan Ellis");
  const layout = page.getByTestId("template-minimal-ledger");
  await layout.click();
  await expect(page.locator(".email-window-foot")).toContainText("Ledger layout");
  await layout.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Add Ledger to favourites", { exact: true })).toBeFocused();
  await page.getByTestId("ob-start").click();
  await expect(page.getByLabel("Project name")).toHaveValue("Jordan Ellis signature");
});

test("panel tabs support arrow keys, Home and End", async ({ page }) => {
  await startWithSample(page);
  await page.getByTestId("tab-add").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("tab-layers")).toBeFocused();
  await expect(page.getByTestId("tab-layers")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByTestId("tab-assets")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByTestId("tab-templates")).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Layouts");
});

test("skip link reaches the canvas and dialogs have names, descriptions and native focus containment", async ({ page }) => {
  await startWithSample(page);
  await page.getByRole("link", { name: "Skip to signature canvas" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#signature-canvas")).toBeFocused();
  const preview = page.getByRole("button", { name: "Preview lab", exact: true });
  await preview.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveAccessibleName(/Preview lab/i);
  await expect(dialog).toHaveAttribute("aria-describedby", /.+/);
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(preview).toBeFocused();
});

test("workspace menu closes with Escape and restores focus", async ({ page }) => {
  await startWithSample(page);
  const trigger = page.getByLabel("More tools", { exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "History", exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(page.locator(".workspace-menu")).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();
});

test("document sliders expose their actual labels", async ({ page }) => {
  await startWithSample(page, "simple");
  await expect(page.getByRole("slider", { name: "Target width", exact: true })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Scale", exact: true })).toBeVisible();
});

for (const width of [320, 390, 847]) {
  test(`the ${width}px editor keeps tools available, avoids page overflow and restores sheet focus`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await startWithSample(page, "simple");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByTestId("profile-title")).not.toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close editing panel", exact: true })).toBeFocused();
    await page.getByTestId("profile-title").fill("Brand director");
    expect(
      await page.getByTestId("profile-title").evaluate((input) => parseFloat(getComputedStyle(input).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    await page.getByRole("button", { name: "Close editing panel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Style", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close style panel", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Style", exact: true })).toBeFocused();
    await openWorkspaceTool(page, "Settings");
    await expect(page.locator("dialog[open]")).toHaveAccessibleName("Image hosting");
    await page.keyboard.press("Escape");
    await page.getByLabel("More tools", { exact: true }).click();
    await page.getByRole("button", { name: "Advanced", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByTestId("tab-add")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
