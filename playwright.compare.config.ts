import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env with override:true so it is the single source of truth (as elsewhere).
dotenv.config({ path: path.resolve(__dirname, ".env"), override: true });

/**
 * Dedicated config for the content-parity comparison suite (tests-compare/).
 *
 * It is separate from the main validation suite because each test loads TWO origins
 * (odyssey + legacy) rather than a single baseURL page. The suite hits live external sites
 * (no local webServer/mock) and emits its parity reports: a Markdown summary
 * (comparison-reporter, md-only here) and a comprehensive 3-sheet Excel workbook
 * (comparison-excel-reporter).
 *
 * Run with: npm run test:compare
 */

export default defineConfig({
  testDir: "./tests-compare",
  testMatch: "**/*.spec.ts",
  // 300s (was 180s): content-comparison.spec.ts can now spend up to two extra reload+resettle
  // cycles recovering from a transient legacy-site render failure (see that file's retry logic)
  // before giving up on a mismatched component — the previous 180s budget was tight enough to hit
  // "Test timeout exceeded" mid-retry on a live course-detail page.
  timeout: 300000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    // Markdown parity report (existing reporter, invoked md-only so it never writes the xlsx).
    ["./tests/reporters/comparison-reporter.ts", { format: "md" }],
    // Comprehensive 3-sheet Excel parity report (Metrics / Component Presence / Parity Detail).
    ["./tests/reporters/comparison-excel-reporter.ts"],
  ],
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
