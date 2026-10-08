import { expect, test } from "@playwright/test";
import { configureTestHost, pngBuffer, stage, startWithSample } from "./helpers";

async function clipboardHtml(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return await (await items[0].getType("text/html")).text();
  });
}

test("a text-only signature copies as rich HTML with no images", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("ob-name").fill("Ava Stone");
  await page.getByLabel("Email").fill("ava@example.com");
  await page.getByTestId("template-type-display").click();
  await page.getByTestId("ob-start").click();
  await page.getByTestId("install-button").click();
  await expect(page.getByTestId("readiness-full")).toContainText("Ready to copy");
  await page.getByTestId("install-next").click();
  await page.getByTestId("copy-full").click();
  const html = await clipboardHtml(page);
  expect(html).toContain("Ava Stone");
  expect(html).toContain('href="mailto:ava@example.com"');
  expect(html).not.toContain("<img");
  expect(html).not.toMatch(/data-ss|<script/);
});

test("images block copying until they are published and verified", async ({ page }) => {
  await startWithSample(page);
  // Put the built-in logo into the logo slot.
  await stage(page).getByText("Logo").first().click();
  await page.getByRole("button", { name: "Use Modern Gentlemen monogram" }).click();
  await page.getByTestId("install-button").click();
  // No host configured yet: copy is blocked and the user is told why.
  await page.getByTestId("consent").click();
  await expect(page.getByTestId("readiness-full")).toContainText("Image hosting isn't set up");
  await expect(page.getByTestId("readiness-full")).toContainText("Not ready");
  await page.getByTestId("install-next").click();
  await expect(page.getByTestId("copy-full")).toBeDisabled();
  await page.keyboard.press("Escape");
  // Configure the (test) host and prepare again.
  await configureTestHost(page);
  await page.getByTestId("install-button").click();
  await page.getByRole("button", { name: "Retry all" }).click();
  await expect(page.getByTestId("readiness-full")).toContainText("Ready to copy", { timeout: 15000 });
  await page.getByTestId("install-next").click();
  await page.getByTestId("copy-full").click();
  const html = await clipboardHtml(page);
  const img = html.match(/<img[^>]+src="([^"]+)"/);
  expect(img?.[1]).toMatch(/^http:\/\/localhost:8787\/s\/[0-9a-f]{64}\.png$/);
  // The published image is publicly fetchable and decodes.
  const res = await page.request.get(img![1]);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
});

test("an uploaded logo is cropped, published and referenced by URL", async ({ page }) => {
  await startWithSample(page);
  await configureTestHost(page);
  await stage(page).getByText("Logo").first().click();
  await page.getByTestId("inspector").locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: pngBuffer() });
  await expect(page.getByRole("heading", { name: "Crop & shape" })).toBeVisible();
  await page.getByTestId("image-done").click();
  await page.getByTestId("install-button").click();
  await page.getByTestId("consent").click();
  await expect(page.getByTestId("readiness-full")).toContainText("Ready to copy", { timeout: 15000 });
});

test("rejects unsupported uploads with a helpful message", async ({ page }) => {
  await startWithSample(page);
  await stage(page).getByText("Logo").first().click();
  await page.getByTestId("inspector").locator("input[type=file]").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText("Please use a PNG, JPEG, WebP, GIF or SVG image.")).toBeVisible();
});
