import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, ".env"), override: true });

// Select the custom report format via REPORT_FORMAT (md | excel | both). Defaults to md.
// - md    -> per-category Markdown files in test-results/
// - excel -> a single validation-report.xlsx workbook in test-results/
// - both  -> emit both formats
const reportFormat = (process.env.REPORT_FORMAT || "md").trim().toLowerCase();
const wantMarkdown = reportFormat === "md" || reportFormat === "both";
const wantExcel = reportFormat === "excel" || reportFormat === "xlsx" || reportFormat === "both";
const customReporters: [string][] = [];
if (wantMarkdown) customReporters.push(["./tests/reporters/markdown-reporter.ts"]);
if (wantExcel) customReporters.push(["./tests/reporters/excel-reporter.ts"]);
// Fall back to Markdown if REPORT_FORMAT was set to an unrecognized value.
if (customReporters.length === 0) customReporters.push(["./tests/reporters/markdown-reporter.ts"]);

export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  expect: {
    timeout: 2000,
  },
  globalSetup: "./tests/global-setup.ts",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html"],
    ...customReporters,
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node tests/mock-server.js",
    url: "http://localhost:3001/",
    reuseExistingServer: true,
  },
});
