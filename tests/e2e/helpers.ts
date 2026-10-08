import { expect, type Page } from "@playwright/test";

export async function startWithSample(page: Page, mode: "simple" | "advanced" = "advanced") {
  await page.goto("/");
  await page.getByTestId("ob-sample").click();
  await expect(page.getByTestId("stage")).toBeVisible();
  if (mode === "advanced") await page.getByRole("button", { name: "Advanced", exact: true }).click();
}

export const stage = (page: Page) => page.locator("[data-testid=stage] .stage-host");

export async function stageText(page: Page): Promise<string> {
  return stage(page).evaluate((h) => h.shadowRoot?.textContent ?? "");
}

export async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

export async function configureTestHost(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Image host address").fill("http://localhost:8787");
  await page.getByLabel("Upload key").fill("dev-key");
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

/** A small valid PNG (solid colour) for upload tests. */
export function pngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAAKUlEQVR4nO3OMQ0AAAgDoNk/9K3hAQkQnlS7HQAAAAAAAAAAAAAAAOD7GD8AAWG1ImEAAAAASUVORK5CYII=",
    "base64",
  );
}
