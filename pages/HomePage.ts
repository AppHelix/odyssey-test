import { Page, Locator } from "@playwright/test";
import { PageValidationConfig, defaultConfig } from "../config/page-validation.config";

export class HomePage {
  readonly page: Page;
  readonly config: PageValidationConfig;

  constructor(page: Page, config: PageValidationConfig = defaultConfig) {
    this.page = page;
    this.config = config;
  }

  /**
   * Navigates to the specified path (absolute or relative to baseURL).
   */
  async navigate(path: string = "/"): Promise<void> {
    await this.page.goto(path);
  }

  // --- Header Getters ---

  getHeader(): Locator {
    return this.page.locator(this.config.headerDefaults.headerSelector);
  }

  getLogo(): Locator {
    return this.page.locator(this.config.headerDefaults.logoSelector);
  }

  getLogoImage(): Locator {
    return this.page.locator(this.config.headerDefaults.logoImageSelector);
  }

  getLogoLink(): Locator {
    return this.page.locator(this.config.headerDefaults.logoLinkSelector);
  }

  getNavigation(): Locator {
    return this.page.locator(this.config.headerDefaults.navSelector);
  }

  getLearnButton(): Locator {
    return this.page.locator(this.config.headerDefaults.learnButtonSelector);
  }

  getMegaMenu(): Locator {
    return this.page.locator(this.config.headerDefaults.megaMenuSelector);
  }

  getSearchButton(): Locator {
    return this.page.locator(this.config.headerDefaults.searchButtonSelector);
  }

  getSearchInput(): Locator {
    return this.page.locator(this.config.headerDefaults.searchInputSelector);
  }

  // --- Footer Getters ---

  getFooter(): Locator {
    return this.page.locator(this.config.footerDefaults.footerSelector);
  }

  getFooterSections(): Locator {
    const selector = this.config.footerDefaults.sectionSelectors.join(", ");
    return this.page.locator(selector);
  }

  getSocialLinks(): Locator {
    // Construct search domains for a[href] filter.
    const domains = this.config.footerDefaults.socialLinks.expectedDomains;
    const hrefFilters = domains.map((domain) => `a[href*="${domain}"]`).join(", ");
    return this.getFooter().locator(hrefFilters || "a");
  }

  getLanguageSelector(): Locator {
    return this.page.locator(this.config.footerDefaults.languageSelector.selector);
  }

  getLanguageApplyButton(): Locator {
    return this.page.locator(this.config.footerDefaults.languageSelector.applyButtonSelector);
  }

  getCopyrightElement(): Locator {
    return this.page.locator(this.config.footerDefaults.copyright.selector);
  }

  getAppStoreLink(): Locator {
    return this.page.locator(this.config.footerDefaults.mobileStoreLinks.appStoreSelector);
  }

  getPlayStoreLink(): Locator {
    return this.page.locator(this.config.footerDefaults.mobileStoreLinks.playStoreSelector);
  }
}
