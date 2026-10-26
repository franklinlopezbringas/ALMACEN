import { defineConfig, devices } from "@playwright/test";
import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");
export default defineConfig({
  testDir: "./tests/live",
  outputDir: "artifacts/live-results",
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3001",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    env: { ...process.env, APP_ORIGIN: "http://127.0.0.1:3001" },
    reuseExistingServer: false,
    timeout: 60000,
  },
});
