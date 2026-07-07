import { Page, APIRequestContext } from "@playwright/test";
import {
  PageValidationConfig,
  defaultConfig,
  SeoValidationConfig,
  HeaderValidationConfig,
  FooterValidationConfig,
  SemanticValidationConfig,
  ValidatorTypeName,
} from "../config/page-validation.config";
import { validatePageHealth } from "../validations/page-health.validator";
import { validateSeo } from "../validations/seo.validator";
import { validateHeader } from "../validations/header.validator";
import { validateFooter } from "../validations/footer.validator";
import { validateSemantic } from "../validations/semantic.validator";

export interface TargetUrlConfig {
  url: string;
  expectedStatus?: number;
  expectedRedirectUrl?: string;
  seo?: Partial<SeoValidationConfig>;
  header?: Partial<HeaderValidationConfig>;
  footer?: Partial<FooterValidationConfig>;
  semantic?: Partial<SemanticValidationConfig>;
}

export type ValidatorType = ValidatorTypeName;

/**
 * Which kind of test a validator belongs to. Today the framework only runs per-URL
 * page validation; this field reserves a home for future sibling test types (e.g.
 * "unit") so they can share the registry/reporter conventions without a refactor.
 */
export type TestCategory = "page-validation"; // future: | "unit" | "integration"

export interface ValidatorDefinition {
  type: ValidatorType;
  category: TestCategory;
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

  async validateSemanticOnly(page: Page, pageConfig: TargetUrlConfig): Promise<void> {
    const d = this.config.semanticDefaults;
    const o = pageConfig.semantic;
    const semanticConfig: SemanticValidationConfig = {
      document: { ...d.document!, ...o?.document },
      headings: { ...d.headings!, ...o?.headings },
      landmarks: {
        ...d.landmarks!,
        ...o?.landmarks,
        landmarkSelectors: { ...d.landmarks?.landmarkSelectors, ...o?.landmarks?.landmarkSelectors },
      },
      media: { ...d.media!, ...o?.media },
      links: { ...d.links!, ...o?.links },
      forms: { ...d.forms!, ...o?.forms },
      tables: { ...d.tables!, ...o?.tables },
      ariaIntegrity: { ...d.ariaIntegrity!, ...o?.ariaIntegrity },
      markup: { ...d.markup!, ...o?.markup },
    };

    await validateSemantic(page, semanticConfig);
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
    category: "page-validation",
    name: "HTTP Status & Health",
    validate: async (page, requestContext, pageConfig, baseURL, service) => {
      await service.validateHealthOnly(page, requestContext, pageConfig, baseURL);
    },
  },
  seo: {
    type: "seo",
    category: "page-validation",
    name: "SEO Metadata",
    validate: async (page, requestContext, pageConfig, baseURL, service) => {
      await service.validateSeoOnly(page, pageConfig);
    },
  },
  header: {
    type: "header",
    category: "page-validation",
    name: "Header Functionality",
    validate: async (page, requestContext, pageConfig, baseURL, service) => {
      await service.validateHeaderOnly(page, requestContext, pageConfig, baseURL);
    },
  },
  footer: {
    type: "footer",
    category: "page-validation",
    name: "Footer Functionality",
    validate: async (page, requestContext, pageConfig, baseURL, service) => {
      await service.validateFooterOnly(page, requestContext, pageConfig, baseURL);
    },
  },
  semantic: {
    type: "semantic",
    category: "page-validation",
    name: "Semantic HTML Structure",
    validate: async (page, requestContext, pageConfig, baseURL, service) => {
      await service.validateSemanticOnly(page, pageConfig);
    },
  },
};

export const pageValidationService = new PageValidationService();
