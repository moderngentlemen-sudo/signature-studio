import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const preinstalled = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5181",
    viewport: { width: 1440, height: 900 },
    launchOptions: existsSync(preinstalled) ? { executablePath: preinstalled } : {},
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: [
    {
      // Test build: accepts the local test image host (clearly labelled in the UI).
      command: "npx vite --port 5181 --strictPort",
      port: 5181,
      env: { VITE_TEST_HOST: "1" },
      reuseExistingServer: false,
    },
    {
      command: "node scripts/dev-host.mjs",
      port: 8787,
      env: { UPLOAD_KEY: "dev-key" },
      reuseExistingServer: true,
    },
  ],
});
