import { Page, APIRequestContext } from "@playwright/test";
import {
  PageValidationConfig,
  defaultConfig,
  SeoValidationConfig,
  HeaderValidationConfig,
  FooterValidationConfig,
} from "../config/page-validation.config";
import { validatePageHealth } from "../validations/page-health.validator";
import { validateSeo } from "../validations/seo.validator";
import { validateHeader } from "../validations/header.validator";
import { validateFooter } from "../validations/footer.validator";

export interface TargetUrlConfig {
  url: string;
  expectedStatus?: number;
  expectedRedirectUrl?: string;
  seo?: Partial<SeoValidationConfig>;
  header?: Partial<HeaderValidationConfig>;
  footer?: Partial<FooterValidationConfig>;
}

export type ValidatorType = "health" | "seo" | "header" | "footer";

export interface ValidatorDefinition {
  type: ValidatorType;
  name: string;
  validate: (
    page: Page,
    requestContext: APIRequestContext,
    pageConfig: TargetUrlConfig,
    baseURL: string,
    service: PageValidationService
  ) => Promise<void>;
}

export class PageValidationService {
  readonly config: PageValidationConfig;

  // Enabled validator types resolved dynamically from the config (which processes environment variables)
  get activeValidators(): ValidatorType[] {
    return this.config.activeValidators;
  }

  constructor(config: PageValidationConfig = defaultConfig) {
    this.config = config;
  }

  /**
   * Returns definitions for all currently enabled validators.
   */
  getEnabledValidators(): ValidatorDefinition[] {
    return this.activeValidators
      .map((type) => VALIDATOR_REGISTRY[type])
      .filter((v): v is ValidatorDefinition => !!v);
  }

  /**
   * Coordinates the validation steps for a given page configuration.
   * Runs all enabled validation steps in sequence.
   */
  async validatePage(
    page: Page,
    requestContext: APIRequestContext,
    pageConfig: TargetUrlConfig,
    baseURL: string
  ): Promise<void> {
    const expectedStatus = pageConfig.expectedStatus || 200;
    const isRedirect = expectedStatus >= 300 && expectedStatus < 400;

    for (const validator of this.getEnabledValidators()) {
      if (isRedirect && validator.type !== "health") {
        continue; // Skip content checks for redirects
      }
      await validator.validate(page, requestContext, pageConfig, baseURL, this);
    }
  }

  async validateHealthOnly(
    page: Page,
    requestContext: APIRequestContext,
    pageConfig: TargetUrlConfig,
    baseURL: string
  ): Promise<void> {
    const expectedStatus = pageConfig.expectedStatus || 200;
    await validatePageHealth(
      page,
      requestContext,
      pageConfig.url,
      expectedStatus,
      pageConfig.expectedRedirectUrl,
      baseURL
    );
  }

  async validateSeoOnly(page: Page, pageConfig: TargetUrlConfig): Promise<void> {
    const seoConfig: SeoValidationConfig = {
      title: { ...this.config.seoDefaults.title, ...pageConfig.seo?.title },
      description: { ...this.config.seoDefaults.description, ...pageConfig.seo?.description },
      canonical: { ...this.config.seoDefaults.canonical, ...pageConfig.seo?.canonical },
      robots: { ...this.config.seoDefaults.robots, ...pageConfig.seo?.robots },
      openGraph: { ...this.config.seoDefaults.openGraph, ...pageConfig.seo?.openGraph },
      twitter: { ...this.config.seoDefaults.twitter, ...pageConfig.seo?.twitter },
    };

    await validateSeo(page, seoConfig);
  }

  async validateHeaderOnly(
    page: Page,
    requestContext: APIRequestContext,
    pageConfig: TargetUrlConfig,
    baseURL: string
  ): Promise<void> {
    const headerConfig: HeaderValidationConfig = {
      ...this.config.headerDefaults,
      ...pageConfig.header,
    };
    
    if (headerConfig.required) {
      await validateHeader(page, requestContext, headerConfig, baseURL);
    }
  }

  async validateFooterOnly(
    page: Page,
    requestContext: APIRequestContext,
    pageConfig: TargetUrlConfig,
    baseURL: string
  ): Promise<void> {
    const footerConfig: FooterValidationConfig = {
      ...this.config.footerDefaults,
      ...pageConfig.footer,
      socialLinks: {
        ...this.config.footerDefaults.socialLinks,
        ...pageConfig.footer?.socialLinks,
      },
      languageSelector: {
        ...this.config.footerDefaults.languageSelector,
        ...pageConfig.footer?.languageSelector,
      },
      copyright: {
        ...this.config.footerDefaults.copyright,
        ...pageConfig.footer?.copyright,
      },
      mobileStoreLinks: {
        ...this.config.footerDefaults.mobileStoreLinks,
        ...pageConfig.footer?.mobileStoreLinks,
      },
    };

    if (footerConfig.required) {
      await validateFooter(
        page,
        requestContext,
        footerConfig,
        this.config.checkExternalLinks,
        baseURL
      );
    }
  }
}

/**
 * Registry mapping each validator type to its runner implementation.
 */
const VALIDATOR_REGISTRY: Record<ValidatorType, ValidatorDefinition> = {
  health: {
    type: "health",
    name: "HTTP Status & Health",
    validate: async (page, requestContext, pageConfig, baseURL, service) => {
      await service.validateHealthOnly(page, requestContext, pageConfig, baseURL);
    },
  },
  seo: {
    type: "seo",
    name: "SEO Metadata",
    validate: async (page, requestContext, pageConfig, baseURL, service) => {
      await service.validateSeoOnly(page, pageConfig);
    },
  },
  header: {
    type: "header",
    name: "Header Functionality",
    validate: async (page, requestContext, pageConfig, baseURL, service) => {
      await service.validateHeaderOnly(page, requestContext, pageConfig, baseURL);
    },
  },
  footer: {
    type: "footer",
    name: "Footer Functionality",
    validate: async (page, requestContext, pageConfig, baseURL, service) => {
      await service.validateFooterOnly(page, requestContext, pageConfig, baseURL);
    },
  },
};

export const pageValidationService = new PageValidationService();
