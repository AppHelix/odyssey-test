import { Page, expect, test } from "@playwright/test";
import { SeoValidationConfig } from "../config/page-validation.config";
import { isValidUrl } from "../utils/network";

export type SeoCheckType = "title" | "description" | "canonical" | "robots" | "openGraph" | "twitter";

export interface SeoCheckDefinition {
  type: SeoCheckType;
  name: string;
  validate: (page: Page, config: SeoValidationConfig) => Promise<void>;
}

// Configurable list of active SEO checks. Comment out elements to toggle validations.
export const ACTIVE_SEO_CHECKS: SeoCheckType[] = [
  "title",
  "description",
  "canonical",
  "robots",
  "openGraph",
  "twitter",
];

/**
 * Validates the SEO metadata in the <head> of the page based on the configuration.
 */
export async function validateSeo(
  page: Page,
  config: SeoValidationConfig
): Promise<void> {
  for (const checkType of ACTIVE_SEO_CHECKS) {
    const check = SEO_CHECK_REGISTRY[checkType];
    if (check) {
      await test.step(check.name, async () => {
        try {
          await check.validate(page, config);
        } catch (err: any) {
          expect.soft(true, `Sub-check failed: ${err.message || String(err)}`).toBe(false);
        }
      });
    }
  }
}

/**
 * Registry mapping SEO check types to their respective validation logic.
 * Exported so the validator self-test can exercise each sub-check in isolation
 * (mirrors SEMANTIC_SECTION_REGISTRY in semantic.validator.ts).
 */
export const SEO_CHECK_REGISTRY: Record<SeoCheckType, SeoCheckDefinition> = {
  title: {
    type: "title",
    name: "Page Title Tag",
    validate: async (page, config) => {
      if (config.title?.required) {
        const titleLocator = page.locator("title");
        await expect(titleLocator, "Title tag should exist").toHaveCount(1);
        
        const title = await page.title();
        expect(title.trim(), "Title tag should not be empty").not.toBe("");

        if (config.title.pattern) {
          if (config.title.pattern instanceof RegExp) {
            expect(title).toMatch(config.title.pattern);
          } else {
            expect(title).toContain(config.title.pattern);
          }
        }
      }
    },
  },
  description: {
    type: "description",
    name: "Meta Description Tag",
    validate: async (page, config) => {
      if (config.description?.required) {
        const descLocator = page.locator('meta[name="description"]');
        await expect(descLocator, "Meta description tag should exist").toHaveCount(1);

        const desc = await descLocator.getAttribute("content");
        expect(desc, "Meta description content should be defined").not.toBeNull();
        expect(desc!.trim(), "Meta description content should not be empty").not.toBe("");

        if (config.description.pattern) {
          if (config.description.pattern instanceof RegExp) {
            expect(desc).toMatch(config.description.pattern);
          } else {
            expect(desc).toContain(config.description.pattern);
          }
        }
      }
    },
  },
  canonical: {
    type: "canonical",
    name: "Canonical Link Tag",
    validate: async (page, config) => {
      if (config.canonical?.required) {
        const canonicalLocator = page.locator('link[rel="canonical"]');
        await expect(canonicalLocator, "Canonical link tag should exist").toHaveCount(1);

        const href = await canonicalLocator.getAttribute("href");
        expect(href, "Canonical link href should be defined").not.toBeNull();
        expect(href!.trim(), "Canonical link href should not be empty").not.toBe("");

        if (config.canonical.verifyFormat) {
          expect(
            isValidUrl(href!),
            `Canonical URL '${href}' has an invalid format (must be absolute)`
          ).toBe(true);

          try {
            const pageUrl = page.url();
            const parsedPage = new URL(pageUrl);
            const parsedCanonical = new URL(href!);
            expect(
              parsedCanonical.pathname,
              `Canonical link pathname '${parsedCanonical.pathname}' does not match page pathname '${parsedPage.pathname}'`
            ).toBe(parsedPage.pathname);
          } catch (err: any) {
            throw new Error(`Failed to parse and verify canonical URL correctness: ${err.message}`);
          }
        }
      }
    },
  },
  robots: {
    type: "robots",
    name: "Robots Meta Tag",
    validate: async (page, config) => {
      if (config.robots?.required) {
        const robotsLocator = page.locator('meta[name="robots"]');
        await expect(robotsLocator, "Meta robots tag should exist").toHaveCount(1);

        if (config.robots.expectedContent) {
          const content = await robotsLocator.getAttribute("content");
          expect(
            content,
            `Expected meta robots content to be '${config.robots.expectedContent}', but got '${content}'`
          ).toBe(config.robots.expectedContent);
        }
      }
    },
  },
  openGraph: {
    type: "openGraph",
    name: "Open Graph Tags",
    validate: async (page, config) => {
      if (config.openGraph?.required && config.openGraph.expectedTags) {
        for (const tag of config.openGraph.expectedTags) {
          const ogLocator = page.locator(`meta[property="${tag}"]`);
          await expect(ogLocator, `Open Graph tag '${tag}' should exist`).toHaveCount(1);

          const content = await ogLocator.getAttribute("content");
          expect(content, `Open Graph tag '${tag}' content should be defined`).not.toBeNull();
          expect(content!.trim(), `Open Graph tag '${tag}' content should not be empty`).not.toBe("");
        }
      }
    },
  },
  twitter: {
    type: "twitter",
    name: "Twitter Meta Tags",
    validate: async (page, config) => {
      if (config.twitter?.required && config.twitter.expectedTags) {
        for (const tag of config.twitter.expectedTags) {
          const twitterLocator = page.locator(`meta[name="${tag}"], meta[property="${tag}"]`);
          await expect(
            twitterLocator.first(),
            `Twitter tag '${tag}' should exist`
          ).toHaveCount(1);

          const content = await twitterLocator.first().getAttribute("content");
          expect(content, `Twitter tag '${tag}' content should be defined`).not.toBeNull();
          expect(content!.trim(), `Twitter tag '${tag}' content should not be empty`).not.toBe("");
        }
      }
    },
  },
};
