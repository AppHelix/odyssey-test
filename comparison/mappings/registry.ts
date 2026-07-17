import type { PageComparisonMap } from "./types";
import { learnCourseMap } from "./learn/course/learn-course.map";
import { learnMap } from "./learn/learn.map";
import { learnDeepMap } from "./learn/deep/learn-deep.map";
import { becomeMap } from "./become/become.map";
import { becomeArticleMap } from "./become/article/become-article.map";

/**
 * Single source of truth mapping a pageType -> its PageComparisonMap. Mirrors the
 * SEMANTIC_SECTION_REGISTRY idiom (`satisfies` so literal keys survive for `keyof typeof`).
 *
 * To support a new page type: author a `<page>.map.ts` and add one entry here. URL pairs in
 * config/comparison-url-pairs.json reference these keys via their `pageType` field.
 */
export const MAP_REGISTRY = {
  "learn/[slug]": learnCourseMap,
  "learn": learnMap,
  "learn/[slug]/[slug2]": learnDeepMap,
  "become": becomeMap,
  "become/[slug]": becomeArticleMap,
} satisfies Record<string, PageComparisonMap>;

export type PageType = keyof typeof MAP_REGISTRY;

/** Look up a mapping by pageType (undefined if none registered). */
export function getMap(pageType: string): PageComparisonMap | undefined {
  return (MAP_REGISTRY as Record<string, PageComparisonMap>)[pageType];
}
