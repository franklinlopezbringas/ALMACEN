import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./tests/review",
  outputDir: "artifacts/review-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/review-report", open: "never" }],
  ],
  projects: [375, 768, 1440].map((width) => ({
    name: `${width}`,
    use: {
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      isMobile: width === 375,
      hasTouch: width === 375,
    },
  })),
});
