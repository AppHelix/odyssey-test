import { Reporter, TestCase, TestResult, TestStep, FullResult } from "@playwright/test/reporter";
import { defaultConfig } from "../../config/page-validation.config";
import { getActiveSemanticSubtestNames, getSemanticRemediationByName } from "../../validations/semantic.validator";

// ---------------------------------------------------------------------------
// Shared report artifact names. Kept here so every reporter (and the cleanup
// logic) agrees on which files in test-results/ are "ours" and must be preserved.
// ---------------------------------------------------------------------------

/** Per-category Markdown report filenames, keyed by validator category. */
export const FILE_MAPPING: Record<string, string> = {
  "HTTP Status & Health": "health-validation-report.md",
  "SEO Metadata": "seo-validation-report.md",
  "Header Functionality": "header-validation-report.md",
  "Footer Functionality": "footer-validation-report.md",
  "Semantic HTML Structure": "semantic-validation-report.md",
};

/** Single Excel workbook produced by the Excel reporter. */
export const EXCEL_REPORT_FILE = "validation-report.xlsx";

/** Every file this framework's reporters own inside test-results/. */
export const KNOWN_REPORT_FILES: string[] = [...Object.values(FILE_MAPPING), EXCEL_REPORT_FILE];

// Semantic sub-test (rule) display names, derived from the rule registry + the active
// sections (ACTIVE_SEMANTIC_CHECKS) + each rule's enabled() config flag. Adding, removing,
// or toggling a rule flows into the report automatically — no edit needed here.
const SEMANTIC_SUBTESTS: string[] = [
  ...getActiveSemanticSubtestNames(defaultConfig.semanticDefaults),
  "Page Navigation & Loading",
];

/** Ordered sub-tests that belong to each validator category (the report layout). */
export const CATEGORY_SUBTESTS: Record<string, string[]> = {
  "HTTP Status & Health": [
    "Browser Navigation Health",
    "HTTP Redirect Verification"
  ],
  "SEO Metadata": [
    "Page Title Tag",
    "Meta Description Tag",
    "Canonical Link Tag",
    "Robots Meta Tag",
    "Open Graph Tags",
    "Twitter Meta Tags",
    "Page Navigation & Loading"
  ],
  "Header Functionality": [
    "Header Container Visibility",
    "Navigation Bar Visibility",
    "Logo Render & Status",
    "Learn Mega Menu Interactive Drawer",
    "Search Input Interactive Focus",
    "Page Navigation & Loading"
  ],
  "Footer Functionality": [
    "Footer Container Visibility",
    "Footer Sections Layout & Count",
    "Social Links Integrity",
    "Language Dropdown Locale Application",
    "Copyright Text & Year Validation",
    "Mobile App Store Download Links",
    "Page Navigation & Loading"
  ],
  "Semantic HTML Structure": SEMANTIC_SUBTESTS
};

/** Human-readable remediation guidance per sub-test, surfaced in every report format. */
export const REMEDIATION_STEPS: Record<string, string> = {
  "HTTP Status Check": "Verify that the backend server is running and accessible. Check server logs for internal errors (HTTP 500) or routing mismatches.",
  "HTTP Redirect Verification": "Check the server routing configuration (e.g., Next.js redirects or middleware). Ensure the redirect source URL maps correctly to the expected target path and returns a standard redirect status code (e.g., 301, 302).",
  "Browser Navigation Health": "Verify that the backend server is running and accessible. Ensure the path is correct and has the required permissions to load in a web browser.",
  "Page Navigation & Loading": "Make sure the dev server is active and the page loads without severe script or runtime compilation errors that crash the loading process.",
  "Page Title Tag": "Ensure a <title> tag exists inside the HTML <head> element. The title content should not be empty, should be descriptive of the page's content, and optionally match the configured naming conventions or patterns.",
  "Meta Description Tag": "Ensure a <meta name=\"description\"> tag is defined within the <head> element of the document. The content attribute must contain a non-empty, compelling summary of the page.",
  "Canonical Link Tag": "Verify that a <link rel=\"canonical\" href=\"...\"> tag exists in the <head> section. Ensure the href attribute is an absolute URL that exactly matches the authoritative version of this page's URL.",
  "Robots Meta Tag": "Ensure a <meta name=\"robots\" content=\"...\"> tag is present in the <head>. Verify that the content attribute matches the search index instructions (e.g., index, follow or noindex, nofollow) configured for this environment.",
  "Open Graph Tags": "Verify that all required Open Graph meta tags (e.g., og:title, og:description, og:url, og:image) are present in the HTML header with valid, non-empty content attributes.",
  "Twitter Meta Tags": "Verify that all required Twitter card tags (e.g., twitter:card, twitter:title, twitter:description, twitter:image) are present in the <head> with valid content attributes.",
  "Header Container Visibility": "Check that the <header> element is correctly rendered in the DOM, has visibility properties enabled, and is not hidden by CSS styles.",
  "Navigation Bar Visibility": "Ensure that the primary <nav> bar component exists inside the header structure, is visible to the user, and is not collapsed or obscured by layout bugs.",
  "Logo Render & Status": "Ensure the logo element and its <img> tags are correctly rendered. Verify that the logo image loads successfully (check source path), and ensure the logo link URL returns HTTP 200.",
  "Learn Mega Menu Interactive Drawer": "Verify that clicking the 'Learn' navigation menu trigger correctly executes the event handler and renders the mega-menu dropdown or drawer.",
  "Search Input Interactive Focus": "Ensure the search icon/button is visible and clickable. Verify that clicking it triggers the search bar overlay and dynamically calls .focus() on the search input element.",
  "Footer Container Visibility": "Ensure the <footer> element is rendered in the DOM, not hidden by CSS styles, and properly positioned at the bottom of the page layout.",
  "Footer Sections Layout & Count": "Verify that the footer contains the expected number of navigation sections. Check for layout rendering issues that might cause columns or sections to be hidden or collapsed.",
  "Social Links Integrity": "Ensure all social links are rendered correctly with valid, absolute URLs. Double-check that they target the correct social media domains and return successful HTTP statuses.",
  "Language Dropdown Locale Application": "Verify the language selector select element is visible and contains options for all configured locales. Make sure selecting a locale and clicking the 'Apply' button triggers redirect and updates the <html> element lang attribute.",
  "Copyright Text & Year Validation": "Check that the copyright text container exists and displays the correct copyright information. Verify that the text dynamically displays the current calendar year.",
  "Mobile App Store Download Links": "Verify that Apple App Store and Google Play Store download buttons are visible in the footer. Ensure their destination URLs (href) are formatted correctly and point to the correct app store publisher URLs."
};

// Semantic sub-tests are per-rule; pull their remediation straight from the rule registry
// so a new/removed rule needs no edit here.
Object.assign(REMEDIATION_STEPS, getSemanticRemediationByName());

interface UrlSets {
  passed: Set<string>;
  failed: Set<string>;
}

/** Resolved results for a single sub-test within a category. */
export interface SubtestResult {
  name: string;
  passed: string[]; // sorted ascending
  failed: string[]; // sorted ascending
  remediation: string;
}

/** Resolved results for a whole validator category, ready for any output format. */
export interface CategoryReport {
  category: string;
  /** Markdown filename for this category (from FILE_MAPPING). */
  fileName: string | undefined;
  /** Sub-tests in their configured display order. */
  subtests: SubtestResult[];
  /** Distinct URLs that produced at least one result for this category, sorted. */
  urls: string[];
  /** True when any sub-test recorded at least one pass/fail (i.e. the category ran). */
  hasData: boolean;
}

/**
 * Shared Playwright reporter base. Collects the per-URL / per-sub-test pass-fail matrix
 * from test steps and exposes it as format-agnostic `CategoryReport[]` via
 * `resolveReportData()`. Concrete reporters (Markdown, Excel, …) subclass this and only
 * implement `onEnd` to serialize that data — the collection logic lives here once.
 */
export abstract class BaseValidationReporter implements Reporter {
  // Map of Category -> SubcheckName -> UrlSets
  protected categoryReports: Map<string, Map<string, UrlSets>> = new Map();
  protected allUrls: Set<string> = new Set();
  protected executedCategories: Map<string, Set<string>> = new Map();

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    const categories = Object.keys(CATEGORY_SUBTESTS);
    const url = test.title.replace(/^URL:\s*/, "").replace(/\s*\(Health Only\)$/, "");
    this.allUrls.add(url);

    // 1. Identify Sub-Check Step (parent is one of our categories, parent.parent is undefined)
    if (step.parent && categories.includes(step.parent.title) && !step.parent.parent) {
      const categoryName = step.parent.title;
      const subCheckName = step.title;
      const passed = !step.error;

      let categoryMap = this.categoryReports.get(categoryName);
      if (!categoryMap) {
        categoryMap = new Map();
        this.categoryReports.set(categoryName, categoryMap);
      }

      let subCheckData = categoryMap.get(subCheckName);
      if (!subCheckData) {
        subCheckData = { passed: new Set(), failed: new Set() };
        categoryMap.set(subCheckName, subCheckData);
      }

      if (passed) {
        subCheckData.passed.add(url);
      } else {
        subCheckData.failed.add(url);
      }
    }

    // 2. Identify Category Step itself (parent is undefined, title matches one of categories)
    if (!step.parent && categories.includes(step.title)) {
      const categoryName = step.title;

      let executed = this.executedCategories.get(url);
      if (!executed) {
        executed = new Set();
        this.executedCategories.set(url, executed);
      }
      executed.add(categoryName);
    }
  }

  /**
   * Collapses the collected step data into ordered, format-agnostic per-category results.
   * Derives the synthetic "Page Navigation & Loading" sub-test (a URL passes it when any
   * real sub-check ran for that category, else fails) exactly as the original reporter did.
   */
  protected resolveReportData(): CategoryReport[] {
    const categories = Object.keys(CATEGORY_SUBTESTS);
    const reports: CategoryReport[] = [];

    for (const category of categories) {
      const categoryMap = this.categoryReports.get(category) || new Map<string, UrlSets>();
      const subcheckNames = CATEGORY_SUBTESTS[category] || [];

      // Derive "Page Navigation & Loading" dynamically when it is part of this category.
      if (subcheckNames.includes("Page Navigation & Loading")) {
        const navSets: UrlSets = { passed: new Set<string>(), failed: new Set<string>() };
        for (const url of this.allUrls) {
          const executed = this.executedCategories.get(url);
          if (executed && executed.has(category)) {
            let anySubcheckRan = false;
            for (const [subName, sets] of categoryMap.entries()) {
              if (subName === "Page Navigation & Loading") continue;
              if (sets.passed.has(url) || sets.failed.has(url)) {
                anySubcheckRan = true;
                break;
              }
            }
            if (anySubcheckRan) {
              navSets.passed.add(url);
            } else {
              navSets.failed.add(url);
            }
          }
        }
        categoryMap.set("Page Navigation & Loading", navSets);
      }

      const urlSet = new Set<string>();
      const subtests: SubtestResult[] = subcheckNames.map((subcheck) => {
        const data = categoryMap.get(subcheck) || { passed: new Set<string>(), failed: new Set<string>() };
        data.passed.forEach((u) => urlSet.add(u));
        data.failed.forEach((u) => urlSet.add(u));
        return {
          name: subcheck,
          passed: Array.from(data.passed).sort(),
          failed: Array.from(data.failed).sort(),
          remediation: REMEDIATION_STEPS[subcheck] || "Check component configuration and DOM structure for errors.",
        };
      });

      const hasData = subtests.some((s) => s.passed.length + s.failed.length > 0);
      reports.push({
        category,
        fileName: FILE_MAPPING[category],
        subtests,
        urls: Array.from(urlSet).sort(),
        hasData,
      });
    }

    return reports;
  }

  abstract onEnd(result: FullResult): Promise<void> | void;
}
