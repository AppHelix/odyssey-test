import type { Locator } from "@playwright/test";
import type { NormalizedField } from "../engine/types";

/**
 * Mapping-layer types: the ONLY place that carries page-specific and selector-specific
 * knowledge. Odyssey selectors are derived from the Odyssey codebase; legacy selectors are
 * authored by hand (see each *.map.ts). The generic extractor consumes these to produce
 * NormalizedComponents; the comparison engine never sees a selector.
 */

/** How to pull ONE field's text from within a component's root element. */
export interface FieldSpec {
  /** Stable field name compared across sites, e.g. "heading", "body", "cta". */
  name: string;
  /** CSS (or Playwright) selector RELATIVE to the component root. Use ":scope" for the root itself. */
  selector: string;
  /** "text" = first match's text; "list" = every match becomes a value. */
  kind: "text" | "list";
  /** For list items with sub-structure, the sub-fields extracted per item (recursively). */
  itemFields?: FieldSpec[];
  /** When true, an empty/missing value on the odyssey side is acceptable and never a mismatch. */
  optional?: boolean;
  /**
   * When true (only meaningful for `kind: "list"`), the comparator treats every collected value as
   * one JOINED block of text (holistic similarity) instead of aligning items 1:1. Use for prose
   * whose split into multiple elements (e.g. several `<p>` tags) is a formatting choice, not a
   * semantically distinct list — unlike FAQ Q&A pairs, job titles, or card titles, which stay
   * list-compared since those genuinely are discrete, individually comparable items.
   */
  compareAsText?: boolean;
}

/** How to locate and extract one component on ONE site. */
export interface ComponentSelectorSet {
  /** Selector for the component root; the scope for every field selector below. */
  root: string;
  /**
   * Which match to use when `root` matches more than one element. Default `"first"`. Use `"last"`
   * for a selector anchored to "the nearest matching section before a known later landmark" (e.g.
   * `:has(~ #explore-jobs)`, a general-sibling match) where the closest match to the anchor is the
   * correct one, and an earlier unrelated match could otherwise be picked up first.
   */
  pick?: "first" | "last";
  /** Ordered field specs, each extracted relative to `root`. */
  fields: FieldSpec[];
  /**
   * Escape hatch for components that declarative selectors can't express. When provided it is
   * called with the located root and REPLACES declarative field extraction and present-detection:
   * return `null` to signal the component is absent (e.g. no heading matched), or the extracted
   * fields when found. Use this when `root` alone (e.g. "body") can't express presence — see
   * comparison/mappings/heading-region.ts for the canonical example.
   */
  extract?: (root: Locator) => Promise<NormalizedField[] | null>;
}

/** One logical component and how to extract it from each site. */
export interface ComponentMapping {
  /** Logical component type key, e.g. "hero", "richText", "faq", "cardGrid". */
  type: string;
  /** Human-readable name used in the report. */
  label: string;
  /** Odyssey extraction (derived from the Odyssey codebase). */
  odyssey: ComponentSelectorSet;
  /** Legacy extraction — `null` until a human fills in the www.edx.org selectors. */
  legacy: ComponentSelectorSet | null;
}

/** All logical components for one page type. */
export interface PageComparisonMap {
  /** Route pattern this map applies to, e.g. "learn/[slug]". Matches a key in MAP_REGISTRY. */
  pageType: string;
  components: ComponentMapping[];
}
