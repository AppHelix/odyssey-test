import type { Page } from "@playwright/test";
import type { NormalizedField } from "./types";
import { normalizeText } from "./normalize";

/**
 * GENERIC "heading-anchored content region" extraction.
 *
 * Many legacy/CMS-authored pages render the same logical section with a DIFFERENT wrapper shape
 * per page — sometimes as flat siblings inside a shared rich-text div delimited by empty anchor
 * markers (`<a id="why">`), sometimes as its own self-contained wrapper div with no markers at
 * all. A fixed CSS root selector tuned for one shape silently fails (or grabs the wrong content)
 * on the other.
 *
 * Two ways to locate the starting heading:
 *   - `extractHeadingRegion`: by its OWN text pattern (e.g. "What is …", "Why learn …") — use this
 *     when the section's heading follows a consistent template across topics.
 *   - `extractPrecedingHeadingRegion`: by POSITION relative to another, reliably-found heading
 *     (walking backward, skipping known earlier components) — use this when the section's heading
 *     wording is freely authored per topic with no common template (e.g. "Curriculum": "How to get
 *     started in computer science" vs "Blender course curriculum" — no shared pattern to match).
 *
 * Both then collect the section's content the same way: walk forward from the found heading,
 * gathering `<p>`/`<li>` text until hitting the next heading or an anchor-marker element (an
 * element with a non-empty `id`, e.g. `<a id="why">`). An optional `tabs` config additionally
 * clicks through any Radix-style tab widget found in the region — some pages lazy-mount every tab
 * panel except the active one, so a plain (non-interactive) read only ever sees the first tab.
 */

/** One field to pull out of the located heading region. */
export interface HeadingRegionField {
  name: string;
  /**
   * "heading" = the matched heading's own text. "p"/"li" = only that descendant tag within the
   * region. "content" = <p> AND <li> text merged into one list — use when bullet items are just a
   * formatting variant of the same body prose (e.g. Curriculum's "areas to focus on" list), not a
   * separately meaningful list alongside the paragraphs.
   */
  tag: "heading" | "p" | "li" | "content";
  /**
   * When true (only meaningful for "p"/"li" list fields), the comparator treats every collected
   * value as one JOINED block of text (holistic similarity) instead of aligning items 1:1 — see
   * `comparison/engine/compare.ts`. Use for prose whose split into multiple <p>/<li> is a
   * formatting choice, not a semantically distinct list (unlike FAQ Q&A pairs or job titles).
   */
  compareAsText?: boolean;
}

interface BaseSpec {
  /**
   * Heading tag(s) to search for, as a `querySelectorAll`-compatible selector list (e.g. "h2" or
   * "h2, h3"). Defaults to ALL heading levels (h1-h6) — the exact tag a live page uses for a given
   * section has repeatedly proven unreliable to guess from source alone, so matching purely on text
   * pattern (or position) across every level removes that whole class of fragility.
   */
  headingTag?: string;
  fields: HeadingRegionField[];
  /**
   * When set, and a `[role="tablist"]` is found within the region, click through every VISIBLE tab
   * button (`:visible` naturally excludes a CSS-hidden mobile-duplicate widget at desktop
   * viewport) and fold each revealed panel's <p>/<li> text into the same accumulator as the plain
   * region walk. When no tablist is present, this is a no-op — pages using a simpler, non-tabbed
   * content style are read exactly as before.
   */
  tabs?: { tabButtonSelector: string };
}

export interface HeadingRegionSpec extends BaseSpec {
  /** Matches the heading's trimmed text. Bake case-insensitivity into the regex (`/i` flag). */
  headingPattern: RegExp;
}

export interface PrecedingHeadingSpec extends BaseSpec {
  /** Pattern for the reliably-found ANCHOR heading to walk backward FROM (e.g. Explore Jobs's). */
  anchorPattern: RegExp;
  /** Patterns for known EARLIER components' headings to skip past while walking backward. */
  excludePatterns: RegExp[];
}

interface RawRegionResult {
  headingText: string;
  paragraphs: string[];
  listItems: string[];
  hasTabs: boolean;
}

/** Locate a section by its OWN heading text pattern. Returns null if no heading matches. */
export async function extractHeadingRegion(
  page: Page,
  spec: HeadingRegionSpec
): Promise<NormalizedField[] | null> {
  const raw = await evaluateRegion(page, {
    mode: "direct",
    headingTag: spec.headingTag || DEFAULT_HEADING_TAGS,
    patternSource: spec.headingPattern.source,
    patternFlags: spec.headingPattern.flags,
  });
  return finishExtraction(page, spec, raw);
}

/**
 * Locate a section by POSITION: the nearest heading before a reliably-found anchor heading,
 * skipping any heading matching `excludePatterns`. Returns null if no such heading is found (the
 * section is genuinely absent — e.g. no Curriculum content for this topic).
 */
export async function extractPrecedingHeadingRegion(
  page: Page,
  spec: PrecedingHeadingSpec
): Promise<NormalizedField[] | null> {
  const raw = await evaluateRegion(page, {
    mode: "preceding",
    headingTag: spec.headingTag || DEFAULT_HEADING_TAGS,
    patternSource: spec.anchorPattern.source,
    patternFlags: spec.anchorPattern.flags,
    excludeSources: spec.excludePatterns.map((p) => p.source),
    excludeFlags: spec.excludePatterns.map((p) => p.flags),
  });
  return finishExtraction(page, spec, raw);
}

const DEFAULT_HEADING_TAGS = "h1, h2, h3, h4, h5, h6";

/** Shared in-browser walk: find the starting heading (by mode), then collect forward. */
async function evaluateRegion(
  page: Page,
  args: {
    mode: "direct" | "preceding";
    headingTag: string;
    patternSource: string;
    patternFlags: string;
    excludeSources?: string[];
    excludeFlags?: string[];
  }
): Promise<RawRegionResult | null> {
  return page.evaluate((a) => {
    const isHeadingTag = (el: Element) => /^H[1-6]$/.test(el.tagName);
    const hasNonEmptyId = (el: Element) => !!el.id && el.id.trim() !== "";

    const headings = Array.from(document.querySelectorAll(a.headingTag));
    const pattern = new RegExp(a.patternSource, a.patternFlags);

    let heading: Element | undefined;
    if (a.mode === "direct") {
      heading = headings.find((h) => pattern.test((h.textContent || "").trim()));
    } else {
      const anchorIdx = headings.findIndex((h) => pattern.test((h.textContent || "").trim()));
      if (anchorIdx > 0) {
        const excludes = (a.excludeSources || []).map((s, i) => new RegExp(s, a.excludeFlags![i]));
        // Skip headings nested inside a tab widget (e.g. "1. Focus on foundations" inside a tab
        // panel) — those are internal sub-structure of ANOTHER section's content, not a distinct
        // section's own heading, even though they may sit textually closer to the anchor.
        const isNestedInWidget = (el: Element) => !!el.closest('[role="tabpanel"], [role="tablist"]');
        for (let i = anchorIdx - 1; i >= 0; i--) {
          if (isNestedInWidget(headings[i])) continue;
          const text = (headings[i].textContent || "").trim();
          if (excludes.some((ex) => ex.test(text))) continue;
          heading = headings[i];
          break;
        }
      }
    }
    if (!heading) return null;

    const region: Element[] = [];
    let node: Element | null = heading.nextElementSibling;
    while (node && !isHeadingTag(node) && !hasNonEmptyId(node)) {
      region.push(node);
      node = node.nextElementSibling;
    }

    const paragraphs = region.filter((el) => el.tagName === "P").map((el) => (el.textContent || "").trim());
    const listItems = region
      .flatMap((el) => Array.from(el.querySelectorAll("li")))
      .map((el) => (el.textContent || "").trim());
    const hasTabs = region.some((el) => el.matches('[role="tablist"]') || !!el.querySelector('[role="tablist"]'));

    return { headingText: (heading.textContent || "").trim(), paragraphs, listItems, hasTabs };
  }, args);
}

/** Optionally click through a tab widget found in the region, then build the final NormalizedField[]. */
async function finishExtraction(
  page: Page,
  spec: BaseSpec,
  raw: RawRegionResult | null
): Promise<NormalizedField[] | null> {
  if (!raw) return null;

  let paragraphs = raw.paragraphs;
  let listItems = raw.listItems;
  if (raw.hasTabs && spec.tabs) {
    const headingTag = spec.headingTag || DEFAULT_HEADING_TAGS;
    const tabContent = await clickThroughTabs(page, headingTag, raw.headingText, spec.tabs.tabButtonSelector);
    paragraphs = [...paragraphs, ...tabContent.paragraphs];
    listItems = [...listItems, ...tabContent.listItems];
  }

  return spec.fields.map((f) => {
    if (f.tag === "heading") {
      return { name: f.name, kind: "text", values: [normalizeText(raw.headingText)] };
    }
    const source = f.tag === "p" ? paragraphs : f.tag === "li" ? listItems : [...paragraphs, ...listItems];
    const values = source.map((v) => normalizeText(v)).filter((v) => v !== "");
    const field: NormalizedField = { name: f.name, kind: "list", values };
    if (f.compareAsText) field.compareAsText = true;
    return field;
  });
}

/**
 * Re-locates the heading via a Playwright locator (exact-text match on the already-resolved
 * heading text), finds the nearest following-sibling container holding a tablist, clicks every
 * VISIBLE tab button in turn, and accumulates each revealed panel's <p>/<li> text.
 */
async function clickThroughTabs(
  page: Page,
  headingTag: string,
  resolvedHeadingText: string,
  tabButtonSelector: string
): Promise<{ paragraphs: string[]; listItems: string[] }> {
  const escaped = resolvedHeadingText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = page.locator(headingTag).filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).first();
  const tabsContainer = heading.locator("xpath=following-sibling::*[.//*[@role='tablist']][1]");
  const tabButtons = tabsContainer.locator(`${tabButtonSelector}:visible`);

  const count = await tabButtons.count();
  const paragraphs: string[] = [];
  const listItems: string[] = [];
  const activePanel = tabsContainer.locator('[role="tabpanel"][data-state="active"]').first();

  for (let i = 0; i < count; i++) {
    await tabButtons.nth(i).click();
    await activePanel.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
    const [pTexts, liTexts] = await Promise.all([
      activePanel.locator("p").allTextContents(),
      activePanel.locator("li").allTextContents(),
    ]);
    paragraphs.push(...pTexts.map((t) => t.trim()));
    listItems.push(...liTexts.map((t) => t.trim()));
  }

  return { paragraphs, listItems };
}
