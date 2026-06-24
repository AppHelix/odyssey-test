import { Page, APIRequestContext, expect } from "@playwright/test";
import { FooterValidationConfig } from "../config/page-validation.config";
import { HomePage } from "../pages/HomePage";
import { isValidUrl, verifyHttpStatus } from "../utils/network";

export type FooterCheckType = "container" | "sections" | "socialLinks" | "languageSelector" | "copyright" | "mobileStoreLinks";

export interface FooterCheckDefinition {
  type: FooterCheckType;
  name: string;
  validate: (
    page: Page,
    requestContext: APIRequestContext,
    config: FooterValidationConfig,
    checkExternalLinks: boolean,
    baseURL: string,
    homePage: HomePage
  ) => Promise<void>;
}

// Configurable list of active footer checks. Comment out elements to toggle validations.
export const ACTIVE_FOOTER_CHECKS: FooterCheckType[] = [
  "container",
  "sections",
  "socialLinks",
  "languageSelector",
  "copyright",
  "mobileStoreLinks",
];

/**
 * Validates the footer elements, section counts, social links, locale switcher, and copyright year.
 */
export async function validateFooter(
  page: Page,
  requestContext: APIRequestContext,
  config: FooterValidationConfig,
  checkExternalLinks: boolean,
  baseURL: string
): Promise<void> {
  const homePage = new HomePage(page, {
    footerDefaults: config,
  } as any);

  for (const checkType of ACTIVE_FOOTER_CHECKS) {
    const check = FOOTER_CHECK_REGISTRY[checkType];
    if (check) {
      await check.validate(page, requestContext, config, checkExternalLinks, baseURL, homePage);
    }
  }
}

/**
 * Registry mapping footer check types to their respective validation logic.
 */
const FOOTER_CHECK_REGISTRY: Record<FooterCheckType, FooterCheckDefinition> = {
  container: {
    type: "container",
    name: "Footer Container Visibility",
    validate: async (page, requestContext, config, checkExternalLinks, baseURL, homePage) => {
      const footer = homePage.getFooter();
      await expect(footer, "Footer should be visible").toBeVisible();
    },
  },
  sections: {
    type: "sections",
    name: "Footer Sections Layout & Count",
    validate: async (page, requestContext, config, checkExternalLinks, baseURL, homePage) => {
      const sections = homePage.getFooterSections();
      await expect(sections, `Expected ${config.expectedSectionsCount} footer sections`).toHaveCount(
        config.expectedSectionsCount
      );
      
      const sectionsCount = await sections.count();
      for (let i = 0; i < sectionsCount; i++) {
        await expect(sections.nth(i), `Footer section at index ${i} should be visible`).toBeVisible();
      }
    },
  },
  socialLinks: {
    type: "socialLinks",
    name: "Social Links Integrity",
    validate: async (page, requestContext, config, checkExternalLinks, baseURL, homePage) => {
      if (config.socialLinks.required) {
        const socialLinks = homePage.getSocialLinks();
        const count = await socialLinks.count();
        expect(count, "Expected at least one social link to exist").toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
          const link = socialLinks.nth(i);
          const href = await link.getAttribute("href");
          expect(href, `Social link at index ${i} href should be defined`).not.toBeNull();
          expect(
            isValidUrl(href!),
            `Social link URL '${href}' has an invalid format`
          ).toBe(true);

          const parsedUrl = new URL(href!);
          const expectedDomains = config.socialLinks.expectedDomains;
          const matchesDomain = expectedDomains.some((domain) => parsedUrl.hostname.includes(domain));
          expect(
            matchesDomain,
            `Social link hostname '${parsedUrl.hostname}' does not match any expected domain: [${expectedDomains.join(", ")}]`
          ).toBe(true);

          if (checkExternalLinks) {
            const result = await verifyHttpStatus(requestContext, href!, 200);
            expect(
              result.success,
              `External social link status check failed for ${href}: ${result.error}`
            ).toBe(true);
          }
        }
      }
    },
  },
  languageSelector: {
    type: "languageSelector",
    name: "Language Dropdown Locale Application",
    validate: async (page, requestContext, config, checkExternalLinks, baseURL, homePage) => {
      if (config.languageSelector.required) {
        const langSelect = homePage.getLanguageSelector();
        await expect(langSelect, "Language selector select element should be visible").toBeVisible();

        const testLocale = config.languageSelector.testLocale;
        const tagName = await langSelect.evaluate((el) => el.tagName.toLowerCase());

        if (tagName === "select") {
          const option = langSelect.locator(`option[value="${testLocale}"]`);
          await expect(option, `Language option for locale '${testLocale}' should exist`).toHaveCount(1);
          await langSelect.selectOption(testLocale);
        } else {
          // Trigger Radix Popover
          await langSelect.click();
          // Find option and click it (supports translations e.g. "Spanish" for "es")
          const popoverOption = page.locator(`li.cursor-pointer:has-text("Spanish"), [role="option"]:has-text("Spanish")`);
          await expect(popoverOption.first(), "Spanish option should be visible").toBeVisible();
          await popoverOption.first().click();
        }

        const applyBtn = homePage.getLanguageApplyButton();
        await expect(applyBtn, "Language apply button should be visible").toBeVisible();
        await applyBtn.click();

        const expectedLang = config.languageSelector.expectedLangAttribute;
        // Wait for the URL path to update if a redirect occurs
        await page.waitForURL(url => url.pathname.includes(`/${testLocale}`) || url.pathname.endsWith(`/${testLocale}`), { timeout: 5000 }).catch(() => {});

        // Accept either the HTML lang attribute updating, or URL redirecting to /es
        const htmlLocator = page.locator("html");
        const hasCorrectLang = await htmlLocator.getAttribute("lang").then(l => l === expectedLang).catch(() => false);
        const hasCorrectUrl = page.url().includes(`/${testLocale}`) || page.url().endsWith(`/${testLocale}`);
        
        expect(
          hasCorrectLang || hasCorrectUrl,
          `Expected either HTML lang attribute to be updated to '${expectedLang}' or URL path to contain '/${testLocale}'`
        ).toBe(true);
      }
    },
  },
  copyright: {
    type: "copyright",
    name: "Copyright Text & Year Validation",
    validate: async (page, requestContext, config, checkExternalLinks, baseURL, homePage) => {
      if (config.copyright.required) {
        const copyright = homePage.getCopyrightElement();
        await expect(copyright, "Copyright section should be visible").toBeVisible();

        const copyrightText = await copyright.textContent();
        expect(copyrightText, "Copyright text should not be empty").not.toBeNull();
        
        const expectedYear = config.copyright.expectedYear || new Date().getFullYear();
        expect(
          copyrightText!,
          `Copyright text does not contain expected year '${expectedYear}'`
        ).toContain(String(expectedYear));
      }
    },
  },
  mobileStoreLinks: {
    type: "mobileStoreLinks",
    name: "Mobile App Store Download Links",
    validate: async (page, requestContext, config, checkExternalLinks, baseURL, homePage) => {
      if (config.mobileStoreLinks.required) {
        const appStoreLink = homePage.getAppStoreLink();
        await expect(appStoreLink, "App Store link should be visible").toBeVisible();
        const appStoreHref = await appStoreLink.getAttribute("href");
        expect(appStoreHref, "App Store href should be defined").not.toBeNull();
        expect(
          isValidUrl(appStoreHref!),
          `App Store URL '${appStoreHref}' has an invalid format`
        ).toBe(true);

        const playStoreLink = homePage.getPlayStoreLink();
        await expect(playStoreLink, "Play Store link should be visible").toBeVisible();
        const playStoreHref = await playStoreLink.getAttribute("href");
        expect(playStoreHref, "Play Store href should be defined").not.toBeNull();
        expect(
          isValidUrl(playStoreHref!),
          `Play Store URL '${playStoreHref}' has an invalid format`
        ).toBe(true);
      }
    },
  },
};
