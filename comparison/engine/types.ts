/**
 * Engine-layer types for the content comparison framework.
 *
 * These describe NORMALIZED, page-/selector-agnostic content. The extractor turns any
 * ComponentSelectorSet (mappings layer) into a NormalizedComponent; the comparator walks
 * NormalizedComponents only. Nothing here knows about specific pages, sites, or selectors —
 * that is what keeps the comparison engine generic and reusable across page types.
 */

/** Kind of a field value: a single text value, or a list of values. */
export type FieldKind = "text" | "list";

/**
 * Normalized extraction result for one field of one component, on one site.
 * - kind "text": exactly one entry in `values`.
 * - kind "list": zero or more entries in `values`; when the list items have sub-structure
 *   (e.g. FAQ question+answer, card title+description), `items[i]` holds the parallel
 *   sub-fields for `values[i]`.
 */
export interface NormalizedField {
  name: string;
  kind: FieldKind;
  values: string[];
  items?: NormalizedField[][];
  optional?: boolean;
  /**
   * When true (only meaningful for `kind: "list"`), compare `values` as one joined block of text
   * instead of aligning items 1:1 — see compareField in comparison/engine/compare.ts. Carried
   * through from FieldSpec.compareAsText / HeadingRegionField.compareAsText at extraction time.
   */
  compareAsText?: boolean;
}

/** Normalized extraction result for one logical component on one site. */
export interface NormalizedComponent {
  type: string;
  label: string;
  /** Whether the component root was found on the page at all. */
  present: boolean;
  fields: NormalizedField[];
}

/**
 * Parity status of a field or component, expressed relative to LEGACY as the source of truth:
 * - match:             content is equivalent (similarity >= threshold)
 * - modified:          present on both sides but differs (similarity < threshold)
 * - missing:           present in legacy, absent/empty in odyssey
 * - extra:             present in odyssey, absent/empty in legacy
 * - component-missing: whole component present in legacy, absent in odyssey
 * - component-extra:   whole component present in odyssey, absent in legacy
 * - unmapped:          legacy mapping not yet authored (TODO placeholder) — excluded from scoring
 */
export type ParityStatus =
  | "match"
  | "modified"
  | "missing"
  | "extra"
  | "component-missing"
  | "component-extra"
  | "unmapped";

/** Diff result for one field (or one list item / sub-field). */
export interface FieldDiff {
  name: string;
  status: ParityStatus;
  /** Normalized (display) legacy value(s). */
  legacy: string[];
  /** Normalized (display) odyssey value(s). */
  odyssey: string[];
  /** 0..1 text similarity used to decide match vs modified (1 = exact, 0 = absent on one side). */
  similarity: number;
  /** Word/char-level inline diff, rendered only for "modified" fields. */
  inlineDiff?: string;
  /** Nested per-item diffs for list fields. */
  children?: FieldDiff[];
}

/** Diff result for one logical component. */
export interface ComponentDiff {
  type: string;
  label: string;
  status: ParityStatus;
  fields: FieldDiff[];
  /** Fraction (0..1) of comparable fields/items that matched. */
  parityScore: number;
  /** Whether the component root was found on each site (retained even when `fields` is empty). */
  odysseyPresent: boolean;
  legacyPresent: boolean;
  /** Whether the legacy selectors were authored (mapping.legacy !== null). */
  legacyMapped: boolean;
  /** Short identifying text (heading/content) extracted from each side; "" when absent. */
  odysseySnippet: string;
  legacySnippet: string;
}

/** Diff result for one page pair (attached to the Playwright test for the reporter to collect). */
export interface PageDiff {
  odysseyUrl: string;
  legacyUrl: string;
  pageType: string;
  components: ComponentDiff[];
  parityScore: number;
}
