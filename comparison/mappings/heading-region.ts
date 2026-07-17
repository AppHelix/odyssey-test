import {
  extractHeadingRegion,
  extractPrecedingHeadingRegion,
  type HeadingRegionSpec,
  type PrecedingHeadingSpec,
} from "../engine/heading-region";
import type { ComponentSelectorSet } from "./types";

/**
 * Adapts the generic `extractHeadingRegion` engine primitive into a `ComponentSelectorSet`, so
 * mapping files can plug it in wherever a legacy section's DOM shape varies page-to-page, and its
 * heading follows a consistent text template across topics (see
 * comparison/mappings/learn/course/fragile-legacy-selectors.md for which components need this).
 *
 * `root: "body"` is a formality only — the extractor's present/absent decision comes from
 * `extractHeadingRegion` returning `null` (no matching heading found), not from this root locator.
 */
export function headingRegionSet(spec: HeadingRegionSpec): ComponentSelectorSet {
  return {
    root: "body",
    fields: [],
    extract: (root) => extractHeadingRegion(root.page(), spec),
  };
}

/**
 * Adapts `extractPrecedingHeadingRegion` into a `ComponentSelectorSet` — for sections whose
 * heading wording is freely authored per topic (no common pattern to match directly), located
 * instead by position relative to another, reliably-found heading.
 */
export function precedingHeadingRegionSet(spec: PrecedingHeadingSpec): ComponentSelectorSet {
  return {
    root: "body",
    fields: [],
    extract: (root) => extractPrecedingHeadingRegion(root.page(), spec),
  };
}
