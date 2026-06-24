import { test, expect } from "@playwright/test";
import { defaultConfig } from "../config/page-validation.config";
import { pageValidationService, TargetUrlConfig } from "../services/page-validation.service";
import fs from "fs";
import path from "path";

// Dynamically resolve target URLs synchronously
const resolveTargetUrlsSync = (): TargetUrlConfig[] => {
  if (defaultConfig.useSitemap) {
    const sitemapCachePath = path.resolve(__dirname, "..", "config", "sitemap-urls.json");
    if (fs.existsSync(sitemapCachePath)) {
      console.log(`[Validation Framework] Loading sitemap URLs from cache: ${sitemapCachePath}`);
      try {
        const content = fs.readFileSync(sitemapCachePath, "utf8");
        const paths: string[] = JSON.parse(content);
        return paths.map((p) => {
          if (p === "/redirect-source") {
            return { url: p, expectedStatus: 301, expectedRedirectUrl: "/redirect-target" };
          }
          return { url: p, expectedStatus: 200 };
        });
      } catch (err) {
        console.error("[Validation Framework] Failed to read sitemap cache, falling back to defaultConfig", err);
      }
    } else {
      console.warn(`[Validation Framework] Sitemap cache file missing at ${sitemapCachePath}. Run global-setup first.`);
    }
  } else {
    // Fallback / Manual URLs mode from urls.json
    try {
      const urlsFile = process.env.URLS_FILE || "config/urls.json";
      const absolutePath = path.resolve(__dirname, "..", urlsFile);
      if (fs.existsSync(absolutePath)) {
        console.log(`[Validation Framework] Loading URLs from file: ${absolutePath}`);
        const content = fs.readFileSync(absolutePath, "utf8");
        const list = JSON.parse(content);
        if (Array.isArray(list)) {
          return list.map((item) => {
            if (typeof item === "string") {
              const urlPath = item;
              if (urlPath === "/redirect-source") {
                return { url: urlPath, expectedStatus: 301, expectedRedirectUrl: "/redirect-target" };
              }
              return { url: urlPath, expectedStatus: 200 };
            } else {
              return {
                url: item.url,
                expectedStatus: item.expectedStatus || 200,
                expectedRedirectUrl: item.expectedRedirectUrl,
              };
            }
          });
        }
      }
    } catch (err) {
      console.error("[Validation Framework] Failed to load manual URLs from file", err);
    }
  }

  // Final fallback to page-validation.config.ts manualUrls
  console.log("[Validation Framework] Using manualUrls list from page-validation.config.ts");
  return defaultConfig.manualUrls;
};

// Resolve target URLs synchronously during test definition compilation
const targetUrls = resolveTargetUrlsSync();

test.describe("Standalone Page Validation Suite", () => {
  for (const pageConfig of targetUrls) {
    test(`URL: ${pageConfig.url}`, async ({ page, request, baseURL }) => {
      const targetBase = baseURL || "http://localhost:3001";
      const expectedStatus = pageConfig.expectedStatus || 200;
      const isRedirect = expectedStatus >= 300 && expectedStatus < 400;

      console.log(`\n[Validation Framework] Evaluating URL: ${pageConfig.url} (Expected Status: ${expectedStatus})`);

      const enabledValidators = pageValidationService.getEnabledValidators();

      for (const validator of enabledValidators) {
        if (isRedirect && validator.type !== "health") {
          continue; // Skip content checks for redirects
        }

        console.log(`  -> Running validator: ${validator.name}`);

        await test.step(validator.name, async () => {
          try {
            // Lazy navigation: load the page if it's a content check and has not loaded yet
            if (validator.type !== "health" && page.url() === "about:blank") {
              const targetUrl = targetBase && !pageConfig.url.startsWith("http://") && !pageConfig.url.startsWith("https://")
                ? new URL(pageConfig.url, targetBase).toString()
                : pageConfig.url;
              console.log(`     Navigating browser to: ${targetUrl}`);
              await page.goto(targetUrl);
              await page.waitForLoadState("networkidle");
            }

            await validator.validate(page, request, pageConfig, targetBase, pageValidationService);
            console.log(`     [✓] ${validator.name} passed`);
          } catch (err: any) {
            console.log(`     [✗] ${validator.name} failed: ${err.message || String(err)}`);
            // Use soft assertion to mark the step as failed without stopping execution of subsequent steps
            expect.soft(true, `Validation step failed: ${err.message || String(err)}`).toBe(false);
          }
        });
      }
    });
  }
});
