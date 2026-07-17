import { test, expect, Page } from "@playwright/test";
import { compareConfig, loadUrlPairs } from "../comparison/comparison.config";
import { getMap } from "../comparison/mappings/registry";
import { extractComponent } from "../comparison/engine/extractor";
import { compareComponents, pageParityScore } from "../comparison/engine/compare";
import type { ComponentMapping } from "../comparison/mappings/types";
import type { ComponentDiff, NormalizedComponent, PageDiff } from "../comparison/engine/types";

/**
 * Content parity runner. For each configured URL pair it loads BOTH origins (legacy + odyssey)
 * in their own pages, extracts each mapped component from both, and diffs them with the generic
 * comparison engine. The full PageDiff is attached to the test so the comparison reporter can
 * render the detailed parity report; a soft per-component assertion also surfaces mismatches in
 * Playwright's own output.
 *
 * Run with: npm run test:compare  (uses playwright.compare.config.ts). This spec lives in its own
 * directory so the main validation suite (`npm test`) never collects it.
 */

const pairs = loadUrlPairs();

/** How long a component's root is allowed to take to render before it's called genuinely absent. */
const PRESENCE_TIMEOUT_MS = 8000;

test.describe("Content parity: legacy vs odyssey", () => {
  if (pairs.length === 0) {
    test("no URL pairs configured", () => {
      test.skip(true, "Add a \"pageType\" to one or more entries in config/urls.json (or set URLS_FILE).");
    });
    return;
  }

  for (const pair of pairs) {
    const title = `PARITY: ${pair.odyssey} vs ${pair.legacy} [${pair.pageType}]`;

    test(title, async ({ browser }, testInfo) => {
      const map = getMap(pair.pageType);
      expect(map, `No mapping registered for pageType "${pair.pageType}"`).toBeTruthy();

      const odysseyUrl = compareConfig.odysseyBaseUrl + pair.odyssey;
      const legacyUrl = compareConfig.legacyBaseUrl + pair.legacy;

      const odysseyPage = await browser.newPage();
      const legacyPage = await browser.newPage();
      const componentDiffs: ComponentDiff[] = [];

      try {
        await gotoAndPrepare(odysseyPage, odysseyUrl);
        await gotoAndPrepare(legacyPage, legacyUrl);

        // Live sites can render a section's content client-side well after networkidle + the
        // auto-scroll pass in gotoAndPrepare have both settled (confirmed via a direct diagnostic
        // against a real course page — Course Hero/About This Course/Course Pricing rendered
        // several seconds late on one run, well past the default presence wait) — so real
        // comparison runs opt into a much more patient presence wait than the engine's default
        // (which stays small so fixture-backed self-tests aren't slowed down).
        const results = new Map<string, { mapping: ComponentMapping; legacy: NormalizedComponent; odyssey: NormalizedComponent }>();
        for (const mapping of map!.components) {
          const [legacy, odyssey] = await Promise.all([
            extractComponent(legacyPage, mapping.type, mapping.label, mapping.legacy, {
              presenceTimeoutMs: PRESENCE_TIMEOUT_MS,
            }),
            extractComponent(odysseyPage, mapping.type, mapping.label, mapping.odyssey, {
              presenceTimeoutMs: PRESENCE_TIMEOUT_MS,
            }),
          ]);
          results.set(mapping.type, { mapping, legacy, odyssey });
        }

        // A component mapped on BOTH sides but present on only one is either a genuine parity bug
        // or a transient failure on the live legacy site: edx.org's course-detail page fetches
        // Course Hero/About This Course/Meet the Instructors/Testimonials/Course Pricing from one
        // client-side call that intermittently errors (visible in the console as repeated 401/404s
        // from its "Monarch" personalization API), silently dropping all five for that ENTIRE page
        // load — confirmed live on a real course page, reproducing on ~30% of loads. Confirmed NOT
        // tied to cookies/session or browser process (a fresh incognito context and even a fresh
        // browser process both still hit it) — it's a plain per-request failure rate on the live
        // site's backend that happens to take out several components at once (they share the one
        // failing fetch), so a single reload is one independent draw against that same ~30% odds
        // for the WHOLE page, not per component — retrying per-component compounds into a runaway
        // reload storm (and previously blew the test timeout) for no extra benefit, since the
        // affected components always move together. Re-extraction after reload is scoped to just
        // the mismatched mappings, not the whole page, since everything else already matched.
        // A symmetric result (present on both, or absent on both) is never retried: that's either
        // healthy parity or a genuinely-absent component on both sites, and retrying it would just
        // add reloads for no benefit across the many legitimately-unmapped components each page has.
        const MAX_PAGE_RETRIES = 2;
        for (let attempt = 0; attempt < MAX_PAGE_RETRIES; attempt++) {
          const mismatched = [...results.values()].filter(
            (r) => r.mapping.legacy && r.mapping.odyssey && r.legacy.present !== r.odyssey.present
          );
          if (mismatched.length === 0) break;

          const reloadLegacy = mismatched.some((r) => !r.legacy.present);
          const reloadOdyssey = mismatched.some((r) => !r.odyssey.present);
          if (reloadLegacy) await gotoAndPrepare(legacyPage, legacyUrl);
          if (reloadOdyssey) await gotoAndPrepare(odysseyPage, odysseyUrl);

          for (const r of mismatched) {
            if (reloadLegacy && !r.legacy.present) {
              r.legacy = await extractComponent(legacyPage, r.mapping.type, r.mapping.label, r.mapping.legacy, {
                presenceTimeoutMs: PRESENCE_TIMEOUT_MS,
              });
            }
            if (reloadOdyssey && !r.odyssey.present) {
              r.odyssey = await extractComponent(odysseyPage, r.mapping.type, r.mapping.label, r.mapping.odyssey, {
                presenceTimeoutMs: PRESENCE_TIMEOUT_MS,
              });
            }
          }
        }

        for (const mapping of map!.components) {
          const { legacy, odyssey } = results.get(mapping.type)!;
          const diff = compareComponents(
            legacy,
            odyssey,
            { matchThreshold: compareConfig.matchThreshold, ignoreCase: compareConfig.ignoreCase },
            mapping.legacy !== null
          );
          componentDiffs.push(diff);

          await test.step(mapping.label, async () => {
            const ok = diff.status === "match" || diff.status === "unmapped";
            expect
              .soft(ok, `${mapping.label}: ${diff.status} (parity ${(diff.parityScore * 100).toFixed(0)}%)`)
              .toBe(true);
          });
        }
      } finally {
        await odysseyPage.close();
        await legacyPage.close();
      }

      const pageDiff: PageDiff = {
        odysseyUrl,
        legacyUrl,
        pageType: pair.pageType,
        components: componentDiffs,
        parityScore: pageParityScore(componentDiffs),
      };
      await testInfo.attach("page-diff", {
        body: JSON.stringify(pageDiff),
        contentType: "application/json",
      });
    });
  }
});

/**
 * Navigate and settle a client-rendered page: wait for network to go idle (best-effort), then
 * scroll through the page to trigger lazily-mounted sections before extraction.
 */
async function gotoAndPrepare(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await autoScroll(page);
  await page.waitForTimeout(500);
}

/** Scroll top-to-bottom (then back to top) to force lazy-render / intersection-observer content. */
async function autoScroll(page: Page): Promise<void> {
  await page
    .evaluate(async () => {
      await new Promise<void>((resolve) => {
        let total = 0;
        const step = Math.max(window.innerHeight, 400);
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          total += step;
          if (total >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    })
    .catch(() => {});
}
