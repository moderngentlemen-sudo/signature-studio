import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const preinstalled = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5179",
    launchOptions: existsSync(preinstalled) ? { executablePath: preinstalled } : {},
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: {
    command: "npx vite --port 5179 --strictPort",
    port: 5179,
    reuseExistingServer: true,
  },
});
