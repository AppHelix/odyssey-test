/**
 * Validator self-test ("a mock test for testing all validators").
 *
 * Unlike the main suite (tests/page-validation.spec.ts), which RUNS the validators
 * against a target site and reports pass/fail, this suite TESTS THE VALIDATORS
 * THEMSELVES against controlled mock fixtures. For every validator it asserts two
 * properties on known markup:
 *
 *   - No false positives: on a well-formed GOOD fixture, every sub-check must PASS.
 *   - No false negatives: on a broken BAD fixture, the relevant sub-check must FAIL.
 *
 * It drives each validator's exported sub-check registry directly (the registry
 * entries throw on a real failure, unlike the soft-wrapped public validateX()
 * functions), so we can capture per-sub-check pass/fail precisely.
 *
 * Run it standalone (it starts its own mock server and ignores .env):
 *   npx playwright test --config=playwright.selftest.config.ts
 *   npm run test:validators
 */
import { test, expect, Page } from "@playwright/test";
import { defaultConfig } from "../config/page-validation.config";
import { HomePage } from "../pages/HomePage";
import { SEO_CHECK_REGISTRY, SeoCheckType } from "../validations/seo.validator";
import { HEADER_CHECK_REGISTRY, HeaderCheckType } from "../validations/header.validator";
import { FOOTER_CHECK_REGISTRY, FooterCheckType } from "../validations/footer.validator";
import { HEALTH_CHECK_REGISTRY } from "../validations/page-health.validator";
import {
  SEMANTIC_SECTION_REGISTRY,
  ALL_SEMANTIC_CHECKS,
  SemanticSection,
} from "../validations/semantic.validator";

const BASE = "http://localhost:3001";

/** Runs a sub-check and returns null if it passed, or the failure message if it threw. */
async function outcome(fn: () => Promise<void>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err: any) {
    return err?.message || String(err);
  }
}

// ---------------------------------------------------------------------------
// Health validator
// ---------------------------------------------------------------------------
test.describe("health validator", () => {
  test("navigation: PASSES when a 200 page returns 200", async ({ page, request }) => {
    const err = await outcome(() =>
      HEALTH_CHECK_REGISTRY.navigation.validate(page, request, "/selftest/health-ok", 200, undefined, BASE)
    );
    expect(err, `navigation should pass on a healthy 200 page: ${err}`).toBeNull();
  });

  test("navigation: FAILS when a 404 page is expected to be 200", async ({ page, request }) => {
    const err = await outcome(() =>
      HEALTH_CHECK_REGISTRY.navigation.validate(page, request, "/selftest/not-found", 200, undefined, BASE)
    );
    expect(err, "navigation should fail when a 404 is served but 200 expected").not.toBeNull();
  });

  test("redirect: PASSES for a 301 with the correct Location", async ({ page, request }) => {
    const err = await outcome(() =>
      HEALTH_CHECK_REGISTRY.redirect.validate(
        page,
        request,
        "/selftest/health-redirect",
        301,
        "/selftest/health-target",
        BASE
      )
    );
    expect(err, `redirect should pass for a correct 301: ${err}`).toBeNull();
  });

  test("redirect: FAILS when a non-redirecting page is expected to redirect", async ({ page, request }) => {
    const err = await outcome(() =>
      HEALTH_CHECK_REGISTRY.redirect.validate(
        page,
        request,
        "/selftest/health-ok",
        301,
        "/selftest/health-target",
        BASE
      )
    );
    expect(err, "redirect should fail when a 200 page is served but 301 expected").not.toBeNull();
  });

  test("redirect: FAILS when the Location points to the wrong target", async ({ page, request }) => {
    const err = await outcome(() =>
      HEALTH_CHECK_REGISTRY.redirect.validate(
        page,
        request,
        "/selftest/health-redirect",
        301,
        "/selftest/wrong-target",
        BASE
      )
    );
    expect(err, "redirect should fail when Location does not match the expected target").not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SEO validator
// ---------------------------------------------------------------------------
test.describe("seo validator", () => {
  const cfg = defaultConfig.seoDefaults;
  const types = Object.keys(SEO_CHECK_REGISTRY) as SeoCheckType[];

  test("GOOD page: every SEO sub-check passes", async ({ page }) => {
    await page.goto(`${BASE}/selftest/seo-good`);
    for (const type of types) {
      const check = SEO_CHECK_REGISTRY[type];
      const err = await outcome(() => check.validate(page, cfg));
      expect(err, `'${check.name}' should PASS on the good page but failed: ${err}`).toBeNull();
    }
  });

  test("BAD page: every SEO sub-check fails", async ({ page }) => {
    await page.goto(`${BASE}/selftest/seo-bad`);
    for (const type of types) {
      const check = SEO_CHECK_REGISTRY[type];
      const err = await outcome(() => check.validate(page, cfg));
      expect(err, `'${check.name}' should FAIL on the bad page but passed`).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Header validator
// ---------------------------------------------------------------------------
test.describe("header validator", () => {
  const cfg = defaultConfig.headerDefaults;
  const types = Object.keys(HEADER_CHECK_REGISTRY) as HeaderCheckType[];

  test("GOOD page: every header sub-check passes", async ({ page, request }) => {
    await page.goto(`${BASE}/selftest/header-good`);
    const homePage = new HomePage(page, defaultConfig);
    for (const type of types) {
      const check = HEADER_CHECK_REGISTRY[type];
      const err = await outcome(() => check.validate(page, request, cfg, BASE, homePage));
      expect(err, `'${check.name}' should PASS on the good page but failed: ${err}`).toBeNull();
    }
  });

  test("BAD page (no <header>): every header sub-check fails", async ({ page, request }) => {
    await page.goto(`${BASE}/selftest/header-bad`);
    const homePage = new HomePage(page, defaultConfig);
    for (const type of types) {
      const check = HEADER_CHECK_REGISTRY[type];
      const err = await outcome(() => check.validate(page, request, cfg, BASE, homePage));
      expect(err, `'${check.name}' should FAIL on the bad page but passed`).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Footer validator
// ---------------------------------------------------------------------------
test.describe("footer validator", () => {
  const cfg = defaultConfig.footerDefaults;
  const types = Object.keys(FOOTER_CHECK_REGISTRY) as FooterCheckType[];

  test("GOOD page: every footer sub-check passes", async ({ page, request }) => {
    await page.goto(`${BASE}/selftest/footer-good`);
    const homePage = new HomePage(page, defaultConfig);
    for (const type of types) {
      const check = FOOTER_CHECK_REGISTRY[type];
      const err = await outcome(() => check.validate(page, request, cfg, false, BASE, homePage));
      expect(err, `'${check.name}' should PASS on the good page but failed: ${err}`).toBeNull();
    }
  });

  test("BAD page (no <footer>): every footer sub-check fails", async ({ page, request }) => {
    await page.goto(`${BASE}/selftest/footer-bad`);
    const homePage = new HomePage(page, defaultConfig);
    for (const type of types) {
      const check = FOOTER_CHECK_REGISTRY[type];
      const err = await outcome(() => check.validate(page, request, cfg, false, BASE, homePage));
      expect(err, `'${check.name}' should FAIL on the bad page but passed`).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Semantic validator (deterministic; uses each rule's pure evaluate())
// ---------------------------------------------------------------------------

/** Gather every ENABLED semantic rule's violations for the currently-loaded page. */
async function semanticViolations(page: Page): Promise<Record<string, string[]>> {
  const cfgAll: any = defaultConfig.semanticDefaults;
  const out: Record<string, string[]> = {};
  for (const sectionKey of ALL_SEMANTIC_CHECKS) {
    const section = SEMANTIC_SECTION_REGISTRY[sectionKey] as SemanticSection<any, any>;
    const cfg = cfgAll[section.configKey];
    if (!cfg || !cfg.required) continue; // section-level gate
    const snapshot = await section.gather(page, cfg);
    for (const rule of section.rules) {
      if (!rule.enabled(cfg)) continue;
      out[rule.key] = rule.evaluate(snapshot, cfg);
    }
  }
  return out;
}

test.describe("semantic validator", () => {
  test("GOOD page (/semantic-good): every enabled rule passes", async ({ page }) => {
    await page.goto(`${BASE}/semantic-good`);
    const violations = await semanticViolations(page);
    const failing = Object.entries(violations).filter(([, v]) => v.length > 0);
    expect(
      failing.length,
      `These rules false-positived on the good page:\n${failing
        .map(([k, v]) => `  ${k}: ${v.join("; ")}`)
        .join("\n")}`
    ).toBe(0);
  });

  // Rules that /semantic-bad is designed to violate (its violations are mutually
  // exclusive with a few rules — those live in /selftest/semantic-bad2 below).
  const EXPECTED_FAIL_ON_BAD = [
    "htmlLangValid",
    "charsetPresent",
    "viewportPresent",
    "requireSingleH1",
    "enforceNoSkippedLevels",
    "disallowEmptyHeadings",
    "requiredLandmarksPresent",
    "requireSingleMain",
    "requireUniqueLandmarkNames",
    "requireImgAlt",
    "disallowFilenameAlt",
    "requireIframeTitle",
    "requireDiscernibleText",
    "disallowHrefLessAnchors",
    "requireBlankRelSafe",
    "requireControlLabels",
    "requireHeaderCells",
    "noDuplicateIds",
    "validRoles",
    "referentialIntegrity",
    "noAriaHiddenFocusable",
    "noPositiveTabindex",
    "enforceListItemParent",
    "disallowNestedInteractive",
    "requireButtonAccessibleName",
  ];

  test("BAD page (/semantic-bad): each targeted rule fails", async ({ page }) => {
    await page.goto(`${BASE}/semantic-bad`);
    const violations = await semanticViolations(page);
    for (const key of EXPECTED_FAIL_ON_BAD) {
      expect(violations[key], `rule '${key}' was not evaluated on the bad page`).toBeDefined();
      expect(
        (violations[key] || []).length,
        `rule '${key}' should FAIL on /semantic-bad but reported no violation`
      ).toBeGreaterThan(0);
    }
  });

  // These rules cannot be violated on /semantic-bad without contradicting other
  // violations there (e.g. "no <h1>" vs "more than one <h1>"), so they get a
  // dedicated fixture.
  const EXPECTED_FAIL_ON_BAD2 = [
    "singleNonEmptyTitle",
    "doctypeHtml",
    "requireH1",
    "requireScopeOrHeaders",
    "enforceRoleButtonFocusable",
  ];

  test("BAD page (/selftest/semantic-bad2): the remaining rules fail", async ({ page }) => {
    await page.goto(`${BASE}/selftest/semantic-bad2`);
    const violations = await semanticViolations(page);
    for (const key of EXPECTED_FAIL_ON_BAD2) {
      expect(violations[key], `rule '${key}' was not evaluated on bad2`).toBeDefined();
      expect(
        (violations[key] || []).length,
        `rule '${key}' should FAIL on /selftest/semantic-bad2 but reported no violation`
      ).toBeGreaterThan(0);
    }
  });
});
