import { defineConfig, devices } from "@playwright/test";

const appPort = process.env.PLAYWRIGHT_PORT || "3000";
const baseURL = `http://127.0.0.1:${appPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL, trace: "on-first-retry" },
  webServer: { command: `npm run dev -- --port ${appPort}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
  projects: [
    { name: "iPad", use: { ...devices["iPad Pro 11"] } },
    { name: "Android tablet", use: { ...devices["Desktop Chrome HiDPI"], viewport: { width: 1280, height: 800 } } },
  ],
});
