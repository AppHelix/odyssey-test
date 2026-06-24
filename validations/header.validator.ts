import { Page, APIRequestContext, expect } from "@playwright/test";
import { HeaderValidationConfig } from "../config/page-validation.config";
import { HomePage } from "../pages/HomePage";
import { verifyHttpStatus } from "../utils/network";

export type HeaderCheckType = "container" | "navigation" | "logo" | "learnMenu" | "search";

export interface HeaderCheckDefinition {
  type: HeaderCheckType;
  name: string;
  validate: (
    page: Page,
    requestContext: APIRequestContext,
    config: HeaderValidationConfig,
    baseURL: string,
    homePage: HomePage
  ) => Promise<void>;
}

// Configurable list of active header checks. Comment out elements to toggle validations.
export const ACTIVE_HEADER_CHECKS: HeaderCheckType[] = [
  "container",
  "navigation",
  "logo",
  "learnMenu",
  "search",
];

/**
 * Validates the header elements, logo, navigation links, and interactive menus/search trigger.
 */
export async function validateHeader(
  page: Page,
  requestContext: APIRequestContext,
  config: HeaderValidationConfig,
  baseURL: string
): Promise<void> {
  const homePage = new HomePage(page, {
    headerDefaults: config,
  } as any);

  for (const checkType of ACTIVE_HEADER_CHECKS) {
    const check = HEADER_CHECK_REGISTRY[checkType];
    if (check) {
      await check.validate(page, requestContext, config, baseURL, homePage);
    }
  }
}

/**
 * Registry mapping header check types to their respective validation logic.
 */
const HEADER_CHECK_REGISTRY: Record<HeaderCheckType, HeaderCheckDefinition> = {
  container: {
    type: "container",
    name: "Header Container Visibility",
    validate: async (page, requestContext, config, baseURL, homePage) => {
      const header = homePage.getHeader();
      await expect(header, "Header should be visible").toBeVisible();
    },
  },
  navigation: {
    type: "navigation",
    name: "Navigation Bar Visibility",
    validate: async (page, requestContext, config, baseURL, homePage) => {
      const nav = homePage.getNavigation();
      await expect(nav, "Header navigation should be visible").toBeVisible();
    },
  },
  logo: {
    type: "logo",
    name: "Logo Render & Status",
    validate: async (page, requestContext, config, baseURL, homePage) => {
      const logo = homePage.getLogo();
      await expect(logo.first(), "Logo container should be visible").toBeVisible();

      const logoImg = homePage.getLogoImage();
      await expect(logoImg.first(), "Logo image should be visible").toBeVisible();

      const isLogoLoaded = await logoImg.first().evaluate((el: HTMLImageElement) => {
        return el.complete && el.naturalWidth > 0;
      });
      expect(isLogoLoaded, "Logo image did not load successfully in the browser").toBe(true);

      const logoSrc = await logoImg.first().getAttribute("src");
      expect(logoSrc, "Logo image source should not be empty").not.toBeNull();
      
      const logoUrlResult = await verifyHttpStatus(requestContext, logoSrc!, 200, { baseUrl: baseURL });
      expect(
        logoUrlResult.success,
        `Logo image source URL status check failed for '${logoSrc}': ${logoUrlResult.error}`
      ).toBe(true);
    },
  },
  learnMenu: {
    type: "learnMenu",
    name: "Learn Mega Menu Interactive Drawer",
    validate: async (page, requestContext, config, baseURL, homePage) => {
      const learnBtn = homePage.getLearnButton();
      await expect(learnBtn.first(), "Learn button should be visible").toBeVisible();
      
      await learnBtn.first().click();
      const megaMenu = homePage.getMegaMenu();
      await expect(megaMenu.first(), "Mega menu should become visible after clicking Learn button").toBeVisible();

      // Close the mega menu drawer to restore initial state
      await learnBtn.first().click();
      await expect(megaMenu.first(), "Mega menu should close").not.toBeVisible();
    },
  },
  search: {
    type: "search",
    name: "Search Input Interactive Focus",
    validate: async (page, requestContext, config, baseURL, homePage) => {
      const searchInput = homePage.getSearchInput();
      const searchBtn = homePage.getSearchButton();

      // Check if search input is already visible inline (e.g. desktop view)
      const isSearchInputVisible = await searchInput.first().isVisible().catch(() => false);

      if (!isSearchInputVisible) {
        // If not visible inline, we expect a search trigger button to exist and be visible
        await expect(searchBtn.first(), "Search button trigger should be visible since search input is not inline").toBeVisible();
        await searchBtn.first().click();
        
        // After clicking the trigger, the search input should become visible and receive focus
        await expect(searchInput.first(), "Search input should be visible after clicking Search trigger").toBeVisible();
        await expect(searchInput.first(), "Search input should be focused after clicking Search trigger").toBeFocused();

        // Close the search modal/overlay by pressing Escape
        await page.keyboard.press("Escape");
        await expect(searchInput.first(), "Search modal should close").not.toBeVisible();
      } else {
        // If already visible inline, just assert its visibility and verify that we can focus it
        await expect(searchInput.first(), "Search input should be visible inline").toBeVisible();
        await searchInput.first().focus();
        await expect(searchInput.first(), "Search input should receive focus").toBeFocused();
      }
    },
  },
};
