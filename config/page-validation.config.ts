import dotenv from "dotenv";
import path from "path";

// Load environment variables from the .env file in the framework root
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

/**
 * Single source of truth for the set of validator "types" (the test categories that
 * make up the page-validation suite). Add a new type here once and everything that
 * needs the full list — the config union below, the env allow-list in
 * parseActiveValidators, and the VALIDATOR_REGISTRY in the service — stays in sync.
 */
export const ALL_VALIDATOR_TYPES = ["health", "seo", "header", "footer", "semantic"] as const;
export type ValidatorTypeName = (typeof ALL_VALIDATOR_TYPES)[number];

export interface PageValidationConfig {
  useSitemap: boolean;
  sitemapPath: string;
  checkExternalLinks: boolean;
  manualUrls: ManualUrlConfig[];
  seoDefaults: SeoValidationConfig;
  headerDefaults: HeaderValidationConfig;
  footerDefaults: FooterValidationConfig;
  semanticDefaults: SemanticValidationConfig;
  activeValidators: ValidatorTypeName[];
}

export interface ManualUrlConfig {
  url: string;
  expectedStatus?: number;
  expectedRedirectUrl?: string; // relative or absolute redirect destination
  seo?: Partial<SeoValidationConfig>;
  header?: Partial<HeaderValidationConfig>;
  footer?: Partial<FooterValidationConfig>;
  semantic?: Partial<SemanticValidationConfig>;
}

export interface SeoValidationConfig {
  title?: {
    required: boolean;
    pattern?: string | RegExp;
  };
  description?: {
    required: boolean;
    pattern?: string | RegExp;
  };
  canonical?: {
    required: boolean;
    verifyFormat?: boolean;
  };
  robots?: {
    required: boolean;
    expectedContent?: string;
  };
  openGraph?: {
    required: boolean;
    expectedTags?: string[];
  };
  twitter?: {
    required: boolean;
    expectedTags?: string[];
  };
}

/**
 * WAI-ARIA landmark region names supported by the semantic validator.
 */
export type LandmarkName = "main" | "nav" | "banner" | "contentinfo";

/**
 * Configuration for the deterministic "Semantic HTML Structure" validator.
 * Each key maps 1:1 to a sub-check; `required` gates the whole sub-check and the
 * remaining booleans toggle individual rules within it. Per-URL overrides supply a
 * Partial of this shape (see ManualUrlConfig.semantic).
 */
export interface SemanticValidationConfig {
  document?: {
    required: boolean;
    htmlLangValid: boolean;
    langPattern?: string; // serialized RegExp source; validator compiles it
    singleNonEmptyTitle: boolean;
    charsetPresent: boolean;
    viewportPresent: boolean;
    doctypeHtml: boolean;
  };
  headings?: {
    required: boolean;
    requireH1: boolean;
    requireSingleH1: boolean;
    enforceNoSkippedLevels: boolean;
    disallowEmptyHeadings: boolean;
    includeAriaHeadings: boolean;
    ignoreHidden: boolean;
  };
  landmarks?: {
    required: boolean;
    requiredLandmarks: LandmarkName[];
    requireSingleMain: boolean;
    requireUniqueLandmarkNames: boolean;
    requireContentInLandmarks: boolean;
    landmarkSelectors?: Partial<Record<LandmarkName, string>>;
  };
  media?: {
    required: boolean;
    requireImgAlt: boolean;
    allowDecorativeEmptyAlt: boolean;
    ignoreAriaHidden: boolean;
    disallowFilenameAlt: boolean;
    filenameAltPattern?: string; // serialized RegExp source; validator compiles it
    requireIframeTitle: boolean;
    requireSvgAccessibleName: boolean;
    requireFigcaption: boolean;
  };
  links?: {
    required: boolean;
    requireDiscernibleText: boolean;
    disallowHrefLessAnchors: boolean;
    requireBlankRelSafe: boolean;
    disallowAmbiguousText: boolean;
    ambiguousPhrases?: string[];
    requireSkipLink: boolean;
  };
  forms?: {
    required: boolean;
    requireControlLabels: boolean;
    requireRequiredMarked: boolean;
    requireFieldsetLegend: boolean;
  };
  tables?: {
    required: boolean;
    requireHeaderCells: boolean;
    requireScopeOrHeaders: boolean;
    requireCaption: boolean;
    disallowLayoutTables: boolean;
  };
  ariaIntegrity?: {
    required: boolean;
    noDuplicateIds: boolean;
    validRoles: boolean;
    referentialIntegrity: boolean;
    noAriaHiddenFocusable: boolean;
    noPositiveTabindex: boolean;
    noRedundantRoles: boolean;
  };
  markup?: {
    required: boolean;
    enforceListItemParent: boolean;
    disallowNestedInteractive: boolean;
    enforceRoleButtonFocusable: boolean;
    requireButtonAccessibleName: boolean;
    disallowInlineClickHandlersOnDivs: boolean;
  };
}

// NOTE: the list of semantic sections and the ACTIVE_SEMANTIC_CHECKS env resolution live in
// validations/semantic.validator.ts (SEMANTIC_SECTION_REGISTRY is their single source of
// truth). This file only owns the per-section config SHAPE (SemanticValidationConfig) and
// the default values (semanticDefaults).

export interface HeaderValidationConfig {
  required: boolean;
  headerSelector: string;
  logoSelector: string;
  logoImageSelector: string;
  logoLinkSelector: string;
  navSelector: string;
  learnButtonSelector: string;
  megaMenuSelector: string;
  searchButtonSelector: string;
  searchInputSelector: string;
}

export interface FooterValidationConfig {
  required: boolean;
  footerSelector: string;
  sectionSelectors: string[];
  expectedSectionsCount: number;
  socialLinks: {
    required: boolean;
    expectedDomains: string[];
  };
  languageSelector: {
    required: boolean;
    selector: string;
    applyButtonSelector: string;
    testLocale: string;
    expectedLangAttribute: string;
  };
  copyright: {
    required: boolean;
    selector: string;
    expectedYear?: number;
  };
  mobileStoreLinks: {
    required: boolean;
    appStoreSelector: string;
    playStoreSelector: string;
  };
}

const parseActiveValidators = (): ValidatorTypeName[] => {
  const allowed: readonly ValidatorTypeName[] = ALL_VALIDATOR_TYPES;
  const envVal = process.env.ACTIVE_VALIDATORS;
  if (!envVal) {
    return [...ALL_VALIDATOR_TYPES];
  }
  return envVal
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is ValidatorTypeName => allowed.includes(v as ValidatorTypeName));
};

export const defaultConfig: PageValidationConfig = {
  useSitemap: process.env.USE_SITEMAP === "true",
  sitemapPath: process.env.SITEMAP_PATH || "/sitemap.xml",
  checkExternalLinks: process.env.CHECK_EXTERNAL_LINKS === "true",
  activeValidators: parseActiveValidators(),
  manualUrls: [
    { url: "/" },
    { url: "/redirect-source", expectedStatus: 301, expectedRedirectUrl: "/redirect-target" },
    { url: "/redirect-target", expectedStatus: 200 },
  ],
  seoDefaults: {
    title: {
      required: true,
    },
    description: {
      required: true,
    },
    canonical: {
      required: true,
      verifyFormat: true,
    },
    robots: {
      required: true,
    },
    openGraph: {
      required: true,
      expectedTags: ["og:title", "og:description", "og:locale", "og:type"],
    },
    twitter: {
      required: true,
      expectedTags: ["twitter:card", "twitter:title", "twitter:description"],
    },
  },
  semanticDefaults: {
    document: {
      required: true,
      htmlLangValid: true,
      langPattern: "^[a-z]{2}(-[A-Za-z]{2,})?$",
      singleNonEmptyTitle: true,
      charsetPresent: true,
      viewportPresent: true,
      doctypeHtml: true,
    },
    headings: {
      required: true,
      requireH1: true,
      requireSingleH1: true,
      enforceNoSkippedLevels: true,
      disallowEmptyHeadings: true,
      includeAriaHeadings: false,
      ignoreHidden: true,
    },
    landmarks: {
      required: true,
      requiredLandmarks: ["main", "nav", "banner", "contentinfo"],
      requireSingleMain: true,
      requireUniqueLandmarkNames: true,
      requireContentInLandmarks: false,
    },
    media: {
      required: true,
      requireImgAlt: true,
      allowDecorativeEmptyAlt: true,
      ignoreAriaHidden: true,
      disallowFilenameAlt: true,
      requireIframeTitle: true,
      requireSvgAccessibleName: false,
      requireFigcaption: false,
    },
    links: {
      required: true,
      requireDiscernibleText: true,
      disallowHrefLessAnchors: true,
      requireBlankRelSafe: true,
      disallowAmbiguousText: false,
      requireSkipLink: false,
    },
    forms: {
      required: true,
      requireControlLabels: true,
      requireRequiredMarked: false,
      requireFieldsetLegend: false,
    },
    tables: {
      required: true,
      requireHeaderCells: true,
      requireScopeOrHeaders: true,
      requireCaption: false,
      disallowLayoutTables: false,
    },
    ariaIntegrity: {
      required: true,
      noDuplicateIds: true,
      validRoles: true,
      referentialIntegrity: true,
      noAriaHiddenFocusable: true,
      noPositiveTabindex: true,
      noRedundantRoles: false,
    },
    markup: {
      required: true,
      enforceListItemParent: true,
      disallowNestedInteractive: true,
      enforceRoleButtonFocusable: true,
      requireButtonAccessibleName: true,
      disallowInlineClickHandlersOnDivs: false,
    },
  },
  headerDefaults: {
    required: true,
    headerSelector: "header",
    logoSelector: "header a[href='/'], header a.logo, header .logo-container",
    logoImageSelector: "header a[href='/'] img, header a.logo img, header .logo-container img",
    logoLinkSelector: "header a[href='/'], header a.logo, header .logo-container a",
    navSelector: "header nav",
    learnButtonSelector: "header button:has-text('Learn')",
    megaMenuSelector: "[data-testid='mega-menu'], .mega-menu-drawer, .mega-menu",
    searchButtonSelector: "header button:has-text('Search'), header .search-trigger",
    searchInputSelector: "input[type='search'], .search-modal input",
  },
  footerDefaults: {
    required: true,
    footerSelector: "footer.mx-auto, footer:not([class*='text-white'])",
    sectionSelectors: ["footer div.grow", "footer .footer-section", "footer nav section"],
    expectedSectionsCount: 4,
    socialLinks: {
      required: true,
      expectedDomains: ["facebook.com", "twitter.com", "linkedin.com", "instagram.com"],
    },
    languageSelector: {
      required: true,
      selector: "footer .language-selector select, footer button[aria-haspopup='dialog']",
      applyButtonSelector: "footer .language-selector button.apply, footer button:has-text('Apply')",
      testLocale: "es",
      expectedLangAttribute: "es",
    },
    copyright: {
      required: true,
      selector: "footer .copyright, footer div.text-mid",
      expectedYear: new Date().getFullYear(),
    },
    mobileStoreLinks: {
      required: true,
      appStoreSelector: "footer a[href*='apple.com']",
      playStoreSelector: "footer a[href*='google.com']",
    },
  },
};
