import { defineConfig, devices } from "@playwright/test";

/**
 * Dedicated config for the validator self-test (tests-selftest/).
 *
 * It is deliberately independent of .env and of the main page-validation suite:
 *   - baseURL is hard-pinned to the local mock server (never the live target),
 *   - it starts its own mock server,
 *   - it uses only the built-in reporters (the custom Markdown/Excel reporters are
 *     for the URL x sub-test matrix of the main suite, not this validator meta-test).
 *
 * Run with: npx playwright test --config=playwright.selftest.config.ts
 */
export default defineConfig({
  testDir: "./tests-selftest",
  testMatch: "**/*.spec.ts",
  timeout: 60000,
  expect: {
    timeout: 2000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3001",
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
