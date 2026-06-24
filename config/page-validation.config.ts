import dotenv from "dotenv";
import path from "path";

// Load environment variables from the .env file in the framework root
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

export interface PageValidationConfig {
  useSitemap: boolean;
  sitemapPath: string;
  checkExternalLinks: boolean;
  manualUrls: ManualUrlConfig[];
  seoDefaults: SeoValidationConfig;
  headerDefaults: HeaderValidationConfig;
  footerDefaults: FooterValidationConfig;
  activeValidators: ("health" | "seo" | "header" | "footer")[];
}

export interface ManualUrlConfig {
  url: string;
  expectedStatus?: number;
  expectedRedirectUrl?: string; // relative or absolute redirect destination
  seo?: Partial<SeoValidationConfig>;
  header?: Partial<HeaderValidationConfig>;
  footer?: Partial<FooterValidationConfig>;
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

const parseActiveValidators = (): ("health" | "seo" | "header" | "footer")[] => {
  const envVal = process.env.ACTIVE_VALIDATORS;
  if (!envVal) {
    return ["health", "seo", "header", "footer"];
  }
  const allowed: ("health" | "seo" | "header" | "footer")[] = ["health", "seo", "header", "footer"];
  return envVal
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is ("health" | "seo" | "header" | "footer") => allowed.includes(v as any));
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
