import type { PageComparisonMap } from "../types";
import {
  bannerHeroFields,
  uspBlockFields,
  cardGridFields,
  topicDirectoryFields,
  faqFields,
} from "../presets";

/**
 * Component mapping for the Learn hub page — pageType "learn" (route `/learn`), rendered by
 * odyssey/src/app/[locale]/learn/page.tsx.
 *
 * ODYSSEY selectors below were derived by directly reading page.tsx and each component's source
 * (not guessed) — see the plan for this change for the full per-component verification notes.
 * LEGACY selectors were derived from real DOM pasted into
 * comparison/mappings/learn/legacy-dom-input-learn.md (not guessed). One component is still `null`:
 * - `uspBlock`: no DOM was pasted for this section at all — either it doesn't exist on
 *   www.edx.org/learn, or it was skipped by mistake. Needs a fresh paste to confirm either way.
 *
 * `faq`'s legacy DOM was pasted separately into
 * comparison/mappings/learn/legacy-dom-input-learn-blank.md and has a known caveat — see the
 * comment on its `legacy` field below.
 *
 * Excluded (locale-only chrome, zero CMS content): `ExploreCourses` (`<ExploreCourses />` with no
 * props — every field falls back to i18n; `description` never renders since there's no fallback).
 */
export const learnMap: PageComparisonMap = {
  pageType: "learn",
  components: [
    {
      type: "hero",
      label: "Hero",
      // Same ImageBanner component/shape as learn/[topic]'s hero. Note: the outer learn/layout.tsx
      // <section> also carries "full-bleed main-grid", so `.first()` may resolve to that wrapper
      // rather than ImageBanner's own <section> — harmless since h1/body are still descendants
      // (same pre-existing nuance as the topic page's hero).
      odyssey: { root: "section.full-bleed.main-grid", fields: bannerHeroFields() },
      // Root: "bg-primary mx-break-out" is a distinctive combo (confirmed from pasted DOM) unique
      // to this hero wrapper. Body is a plain <p> (no line-clamp class on legacy), unlike Odyssey's
      // `[class*='line-clamp']` target — same `body` field name, different underlying markup.
      legacy: {
        root: "div.bg-primary.mx-break-out",
        fields: [
          { name: "heading", selector: "h1", kind: "text" },
          { name: "body", selector: "p", kind: "text", optional: true },
        ],
      },
    },
    {
      type: "uspBlock",
      label: "USP Block",
      // No id/data-slot/hand-written class exists anywhere in usp-block.tsx (confirmed by reading
      // it) — the section's own heading is locale-fixed ("Why millions of learners choose edX",
      // src/messages/en/marketing.json), used here ONLY to locate the section, not as a compared
      // field. Cards are <div>, not <li> (confirmed).
      odyssey: {
        root: "section:has(h2:text-is('Why millions of learners choose edX'))",
        fields: uspBlockFields(),
      },
      // No DOM was pasted for this section in learn/legacy-dom-input-learn.md — left unmapped rather
      // than guessed. Needs a fresh paste (or confirmation the section doesn't exist on legacy).
      legacy: null,
    },
    {
      type: "trendingTopics",
      label: "Trending Topics",
      // #trending-topics-heading is a literal hardcoded id (topic-chip-grid.tsx, passed via
      // headingId="trending-topics-heading" from trending-topics-grid.tsx) — high confidence.
      // Chips are <Link> (<a>), no <li>.
      //
      // BUG FIXED: root was `section:has(#trending-topics-heading)` with no other qualifier. The
      // ENTIRE /learn page is itself wrapped in `<section className="full-bleed main-grid ...">`
      // (odyssey/src/app/[locale]/learn/layout.tsx) — that outer section also contains this
      // heading as a descendant, so it ALSO matched `:has(#trending-topics-heading)`. Since the
      // extractor defaults to `.first()` and an ancestor precedes its descendant in DOM order, the
      // page-wide layout section won — not TrendingTopicsGrid's own (confirmed from source,
      // trending-topics-grid.tsx:19) `<section className="py-4 gutter-padding w-full">`. `items:
      // "a"` then matched every link on the whole rendered page (trending-courses cards,
      // topic-directory's hundreds of subtopic links, etc.), not just the 4 topic chips. Fixed by
      // anchoring on `.gutter-padding`, a class the outer layout section does NOT carry (confirmed
      // its classes are exactly "full-bleed main-grid bg-color-primary min-h-screen") — narrows
      // `:has(#trending-topics-heading)` to the single correct, tightly-scoped section.
      odyssey: {
        root: "section.gutter-padding:has(#trending-topics-heading)",
        fields: [
          { name: "heading", selector: "h2", kind: "text", optional: true },
          { name: "items", selector: "a", kind: "list" },
        ],
      },
      // Confirmed from pasted DOM: legacy's equivalent ("Find the right course topic for your
      // goals") is NOT a flat chip list — it's 4 goal-based groups (h3 label + its own <ul> of
      // links, e.g. "Start a new career" / "Build technical skills" / "Learn for personal
      // interest" / "Advance in your role"), each with ~3 topic links. Odyssey's shape here has no
      // grouping field, so `items` is flattened across all 4 groups (`ul li a`) to match — the
      // group labels themselves are dropped, not compared. Expect this component to report
      // content differences (different topic curation/grouping), not selector bugs.
      legacy: {
        root: "div.fullwidth.bg-putty-200",
        fields: [
          { name: "heading", selector: "h2", kind: "text", optional: true },
          { name: "items", selector: "ul li a", kind: "list" },
        ],
      },
    },
    {
      type: "trendingCourses",
      label: "Trending Courses",
      // No #browse-courses wrapper on this page (confirmed: hub page renders <TrendingCourses/>
      // bare, unlike learn/[topic]'s `<div id="browse-courses">` wrapper) — anchor on the card
      // grid itself instead. Card grid DOM is identical to the topic page.
      odyssey: {
        root: "section:has(.course-card-grid)",
        fields: [{ name: "heading", selector: "h2", kind: "text", optional: true }, ...cardGridFields()],
      },
      // Root: "dynamic-grid" is a distinctive custom class (confirmed from pasted DOM) on the card
      // container. No heading was included in the pasted DOM at all (root + cards only) — `h2`
      // will simply find nothing here, which is fine since the field is `optional`. Cards are
      // <a> links wrapping the whole card (not <li>); title reuses the same `.line-clamp-2`
      // convention as the Odyssey side, confirmed exactly one match per card.
      legacy: {
        root: "div.dynamic-grid",
        fields: [
          { name: "heading", selector: "h2", kind: "text", optional: true },
          {
            name: "cards",
            selector: "a[href*='/learn/']",
            kind: "list",
            itemFields: [{ name: "title", selector: ".line-clamp-2", kind: "text" }],
          },
        ],
      },
    },
    {
      type: "topicDirectory",
      label: "Topic Directory",
      // #browse-topics is a literal hardcoded id (topic-directory.tsx) — high confidence.
      odyssey: { root: "#browse-topics", fields: topicDirectoryFields() },
      // Confirmed from pasted DOM: legacy's heading (`<h2 id="browse-topics">Browse online
      // courses by subject</h2>`) sits in a sibling wrapper (`div.Default_content__HO8we`)
      // separate from the category grid, so it can't anchor a shared root the way it does on
      // Odyssey — but since `topicDirectoryFields()` has no `heading` field anyway (matches
      // Odyssey's own root, which is also purely a locator here), it isn't needed as a compared
      // field. Root instead anchors directly on the category grid's real parent: 28 category
      // blocks were found, each `div.bg-light.shadow-section` (distinctive combo, confirmed) with
      // an `h4` label (NOT h3, unlike the goal-grouping above) and subtopic links separated by
      // literal `|` <span> dividers — `a` (not `span`) skips those, same convention as Odyssey's.
      legacy: {
        root: "div.mx-auto:has(> div.bg-light.shadow-section)",
        fields: [
          {
            name: "categories",
            selector: "div.bg-light.shadow-section",
            kind: "list",
            itemFields: [
              { name: "category", selector: "h4", kind: "text" },
              { name: "subtopics", selector: "a", kind: "list" },
            ],
          },
        ],
      },
    },
    {
      type: "faq",
      label: "FAQ",
      // Same faq.tsx component as learn/[topic], called directly here (not via LearnFAQ) — no
      // #faq wrapper exists, so a structural fallback root is needed (the project's own README
      // already documents this exact fallback pattern: "#faq, [data-slot='accordion']").
      odyssey: { root: "div:has(> h2):has([data-slot='accordion'])", fields: faqFields() },
      // Confirmed from pasted DOM (preceded by `<a id="frequently-asked-questions">`, corroborating
      // this is the right section): also a Radix accordion under the hood (`data-radix-collection-
      // item`, `aria-controls`/`id="radix-«...»"`), just a custom edX component ("AccordionTextItem")
      // instead of shadcn — `.AccordionTextItem_item__adF2E` is a CSS-module class, distinctive but,
      // like other hashed classes accepted elsewhere in this file, could change on a legacy redeploy.
      // `question` is confirmed reliable — exactly one `<span>` per item (the trigger button's label).
      // `answer` is UNVERIFIED: the pasted DOM has each item in its default closed state, and its
      // `[role='region']` content panel is completely empty there (no text nodes at all, not merely
      // visually hidden) — same underlying Radix behavior `heading-region.ts`'s `tabs` config was
      // built to work around for legacy tab widgets that lazy-mount only the active panel. Structural
      // selector kept below since it's correct *if* the content is present, but confirming `answer`
      // for real will need either a click-to-expand step before extraction, or a fresh paste taken
      // with an item expanded.
      legacy: {
        root: "div:has(> h2):has(.AccordionTextItem_item__adF2E)",
        fields: [
          { name: "heading", selector: "h2", kind: "text", optional: true },
          {
            name: "items",
            selector: ".AccordionTextItem_item__adF2E",
            kind: "list",
            itemFields: [
              { name: "question", selector: "span", kind: "text" },
              { name: "answer", selector: "[role='region']", kind: "text" },
            ],
          },
        ],
      },
    },
  ],
};
