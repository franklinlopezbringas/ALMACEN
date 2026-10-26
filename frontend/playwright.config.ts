import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
process.env.E2E_STUB_PASSWORD ??= randomBytes(24).toString("hex");
const shared = {
  ...process.env,
  E2E_STUB_PASSWORD: process.env.E2E_STUB_PASSWORD!,
  GYMFLOW_API_URL: "http://127.0.0.1:5099",
  APP_ORIGIN: "http://127.0.0.1:3100",
  COOKIE_SECURE: "false",
  SESSION_SECRET: randomBytes(32).toString("hex"),
};
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "node tests/fixtures/api-server.mjs",
      url: "http://127.0.0.1:5099/api/v1/health",
      env: shared,
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      env: shared,
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
