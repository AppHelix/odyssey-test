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
    },
  },
  search: {
    type: "search",
    name: "Search Input Interactive Focus",
    validate: async (page, requestContext, config, baseURL, homePage) => {
      const searchBtn = homePage.getSearchButton();
      await expect(searchBtn.first(), "Search button trigger should be visible").toBeVisible();

      await searchBtn.first().click();
      const searchInput = homePage.getSearchInput();
      await expect(searchInput.first(), "Search input should be visible after clicking Search trigger").toBeVisible();
      await expect(searchInput.first(), "Search input should be focused after clicking Search trigger").toBeFocused();
    },
  },
};
