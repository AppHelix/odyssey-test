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
 * To support a new page type: author a `<page>.map.ts` and add one entry here. Every URL in
 * config/urls.json is automatically checked against these keys via `resolvePageType()` below —
 * there's nothing to annotate per-URL; a new hub's pages are picked up as soon as its pattern is
 * registered here.
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

const isPlaceholderSegment = (segment: string): boolean => segment.startsWith("[") && segment.endsWith("]");

/**
 * Match a URL path (e.g. "/learn/bookkeeping") against every registered pageType pattern (e.g.
 * "learn/[slug]") and return the best match, or undefined if the URL isn't a comparison target.
 * A pattern matches when segment counts are equal and every non-placeholder segment matches
 * literally; placeholder segments (`[slug]`, `[slug2]`, ...) match anything. Among matching
 * patterns, the one with the most literal-segment matches wins — not ambiguous for any pageType
 * registered today (each hub has a distinct literal first segment), but on a genuine future tie
 * this silently keeps whichever pattern is declared first in MAP_REGISTRY.
 */
export function resolvePageType(urlPath: string): PageType | undefined {
  const segments = urlPath.split("/").filter(Boolean);
  let best: { pageType: PageType; score: number } | undefined;

  for (const pageType of Object.keys(MAP_REGISTRY) as PageType[]) {
    const patternSegments = pageType.split("/").filter(Boolean);
    if (patternSegments.length !== segments.length) continue;

    let score = 0;
    let matches = true;
    for (let i = 0; i < patternSegments.length; i++) {
      if (isPlaceholderSegment(patternSegments[i])) continue;
      if (patternSegments[i] !== segments[i]) {
        matches = false;
        break;
      }
      score++;
    }

    if (matches && (!best || score > best.score)) {
      best = { pageType, score };
    }
  }

  return best?.pageType;
}
