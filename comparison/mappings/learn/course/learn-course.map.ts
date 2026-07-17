import type { PageComparisonMap } from "../../types";
import {
  bannerHeroFields,
  navbarFields,
  topicOverviewFields,
  cardGridFields,
  programListingFields,
  relatedTopicsFields,
  proseSectionFields,
  listSectionFields,
  programGuideFields,
  jobsAccordionFields,
  faqFields,
  referencesFields,
} from "../../presets";
import { headingRegionSet, precedingHeadingRegionSet } from "../../heading-region";

/**
 * Component mapping for the learn-topic page — pageType "learn/[slug]" (e.g. /learn/blender),
 * rendered by odyssey/src/app/[locale]/learn/[topic]/page.tsx.
 *
 * ODYSSEY selectors are filled from the codebase. LEGACY selectors were derived from the DOM
 * pasted into learn/course/legacy-dom-input-learn-course.md (www.edx.org/learn/computer-science).
 * Notes:
 *
 * - The legacy site is itself a Tailwind/Next.js app with mostly utility classes. Where a stable
 *   hook exists we use it: page anchors, `role`/`data-*`, hashed CSS-module classes matched by
 *   prefix (e.g. `[class*="AccordionTextItem_item"]`), or the section's unique <h2> text
 *   (`h2:has-text("…")`) + relative XPath for its sibling content.
 * - `[APPROX]` marks mappings whose legacy structure diverges from odyssey (tabs vs bullets,
 *   table vs sections, collapsed content) — expect partial parity; tune after a live run.
 * - `legacy: null` = unmapped (reports N/A, excluded from the parity score).
 *
 * NOT VALIDATED against the live site — verify with `npm run test:compare` and tune. Known caveats
 * are called out per component below.
 */
export const learnCourseMap: PageComparisonMap = {
  pageType: "learn/[slug]",
  components: [
    {
      type: "hero",
      label: "Hero (Topic)",
      odyssey: { root: "section.full-bleed.main-grid", fields: bannerHeroFields() },
      // Legacy: full-width hero band holding the single <h1> + line-clamped intro.
      legacy: { root: "div.fullwidth:has(h1)", fields: bannerHeroFields() },
    },
    {
      type: "navbar",
      label: "Topic Navbar",
      odyssey: { root: ".bg-fern-500", fields: navbarFields() },
      // Legacy: sticky sub-nav; in-page anchor links (href="#…"); the CTA (external href) is excluded.
      legacy: {
        root: "div.fullwidth.bg-secondary",
        fields: [{ name: "items", selector: "a[href^='#']", kind: "list" }],
      },
    },
    {
      type: "topicOverview",
      label: "Topic Overview",
      // Odyssey TopicOverview (learn/[topic]/page.tsx) — the first `.gutter-padding` prose block
      // (h2 topic heading + `.space-y-4` paragraphs). Shares TopicData with the Hero.
      odyssey: { root: "div.gutter-padding", fields: topicOverviewFields() },
      // Legacy: "What is <topic>?" — DOM shape varies per topic page (e.g. flat siblings inside a
      // shared rich-text div delimited by an `<a id="overview">` marker on some pages; a fully
      // self-contained wrapper div with no marker at all on others). Located generically by its
      // heading text instead of any fixed wrapper/anchor. See comparison/mappings/heading-region.ts.
      legacy: headingRegionSet({
        headingPattern: /^what is\s+/i,
        fields: [
          { name: "heading", tag: "heading" },
          { name: "paragraphs", tag: "p", compareAsText: true },
        ],
      }),
    },
    {
      type: "trendingCourses",
      label: "Trending Courses",
      odyssey: {
        root: "#browse-courses",
        fields: [{ name: "heading", selector: "h2", kind: "text", optional: true }, ...cardGridFields()],
      },
      // Legacy: first product-card grid (`.dynamic-grid`); each card is an <a> with a
      // `.line-clamp-2` title. Section heading wasn't in the paste, so it's omitted (surfaces as
      // "extra" on the odyssey side until added).
      legacy: {
        root: ".dynamic-grid",
        fields: [
          { name: "cards", selector: "a", kind: "list", itemFields: [{ name: "title", selector: "span.line-clamp-2", kind: "text" }] },
        ],
      },
    },
    {
      type: "programListing",
      label: "Program Listing",
      odyssey: { root: "#choosing-the-right-program", fields: programListingFields() },
      // Legacy: the product-catalog tab widget (the only tablist inside a `.container`).
      // categories = tab labels; visibleCourses = active panel's cards. [APPROX — active tab only]
      legacy: {
        root: "div.container:has([role='tablist'])",
        fields: [
          { name: "categories", selector: "[role='tab']", kind: "list" },
          {
            name: "visibleCourses",
            selector: "[role='tabpanel'][data-state='active'] a:has(span.line-clamp-2)",
            kind: "list",
            optional: true,
            itemFields: [{ name: "title", selector: "span.line-clamp-2", kind: "text" }],
          },
        ],
      },
    },
    {
      type: "relatedTopics",
      label: "Related Topics",
      odyssey: { root: "section.full-bleed.bg-putty-100", fields: relatedTopicsFields() },
      // Legacy: heading text is CONSTANT ("Related Topics", not topic-templated) and the wrapper
      // shape is consistent across topics, so a plain declarative mapping suffices (no heading-
      // region primitive needed). Topic chips live in the FIRST following sibling div; the "View
      // all topics" link lives in a second, separate sibling div and is naturally excluded.
      legacy: {
        root: "div:has(> h3:text-is('Related Topics'))",
        fields: [
          { name: "heading", selector: "h3", kind: "text", optional: true },
          { name: "items", selector: "xpath=./div[1]//a", kind: "list" },
        ],
      },
    },
    {
      type: "curriculum",
      label: "Curriculum",
      // [odyssey] Curriculum's heading wording is freely authored per topic ("How to get started
      // in computer science" vs "Blender course curriculum" — no shared template, so text-pattern
      // matching isn't viable here, unlike Topic Overview/Why Learn/Explore Jobs). Anchored
      // instead to the ONE stable id on the page (#explore-jobs): per page.tsx, Curriculum is
      // always the nearest h3-headed .py-12 section BEFORE #explore-jobs when curriculum data
      // exists. Uses a general-sibling match (`~`, tolerant of anything in between) + `pick:
      // "last"` (closest match to the anchor) rather than strict immediate adjacency (`+` +
      // `.first()`), which turned out to be too strict on at least one live topic page.
      odyssey: {
        root: "section.py-12:has(> h3):has(~ #explore-jobs)",
        pick: "last",
        fields: proseSectionFields("h3"),
      },
      // [legacy] Same "no heading template" problem, and no stable id exists on the legacy side
      // either — located instead by POSITION relative to Explore Jobs's heading (which DOES follow
      // a reliable template, "Explore <topic> jobs"): the nearest heading before it, skipping past
      // any heading already known to belong to an earlier component (so an absent Curriculum
      // correctly falls through to "not found" rather than false-matching Related Topics/Topic
      // Overview). Some topics render Curriculum as plain paragraphs (Blender); others as a tabbed
      // "steps" widget where only the active tab is populated in the static DOM (Computer Science)
      // — `tabs` clicks through every tab and folds its content in; it's a no-op when no tablist is
      // found, so the plain-paragraph style is read exactly as before. Bullet items (e.g. "areas to
      // focus on") are folded into the same `paragraphs` field via `tag: "content"` — formatting
      // variants of the same body text, not a separately meaningful list here.
      legacy: precedingHeadingRegionSet({
        anchorPattern: /^explore\s+.+\s+jobs\s*$/i,
        excludePatterns: [/^related topics$/i, /^what is\s+/i],
        tabs: { tabButtonSelector: "[role='tab']" },
        fields: [
          { name: "heading", tag: "heading" },
          { name: "paragraphs", tag: "content", compareAsText: true },
        ],
      }),
    },
    {
      type: "exploreJobs",
      label: "Explore Jobs",
      odyssey: { root: "#explore-jobs", fields: listSectionFields() },
      // Legacy: "Explore <topic> jobs" — heading + intro/closing prose + a bulleted role list,
      // inside its own rich-text div (DOM shape varies per topic like Topic Overview/Why Learn).
      // Located generically by heading text. Field names match listSectionFields() on the odyssey
      // side (heading/paragraphs/items) so they line up for comparison.
      legacy: headingRegionSet({
        headingPattern: /^explore\s+.+\s+jobs\s*$/i,
        fields: [
          { name: "heading", tag: "heading" },
          { name: "paragraphs", tag: "p", compareAsText: true },
          { name: "items", tag: "li" },
        ],
      }),
    },
    {
      type: "whyLearn",
      label: "Why Learn",
      // [odyssey] A prior CSS-adjacency fix (`#explore-jobs + section.py-12:has(> ul.list-disc)`)
      // did not hold up against the live site (heading tag level and/or exact structural adjacency
      // there doesn't match what the local source implies) — switched to the SAME heading-region
      // technique used on the legacy side: locate "Why learn …" purely by TEXT PATTERN across any
      // heading level, then read its sibling list items, independent of exact tag or wrapper/section
      // structure. This can no longer cross-match Topic Overview's heading (different text pattern).
      odyssey: headingRegionSet({
        headingPattern: /^why learn\s+/i,
        fields: [
          { name: "heading", tag: "heading" },
          { name: "items", tag: "li" },
        ],
      }),
      // Legacy: "Why learn <topic>?" — same shared-rich-text-div pattern as Topic Overview, located
      // generically by heading text rather than a fixed anchor/wrapper. Bulleted reasons only (no
      // intro paragraphs on the legacy side).
      legacy: headingRegionSet({
        headingPattern: /^why learn\s+/i,
        fields: [
          { name: "heading", tag: "heading" },
          { name: "items", tag: "li" },
        ],
      }),
    },
    {
      type: "programGuide",
      label: "Program Guide",
      odyssey: { root: "section.py-12:has(> div.mt-6)", fields: programGuideFields() },
      // Legacy "Choosing the right … program" — anchored by its <h2>. The odyssey "sections" map to
      // the comparison-table rows (th = program type title, td cells = paragraphs). [APPROX]
      legacy: {
        root: "h2:has-text('Choosing the right')",
        fields: [
          { name: "heading", selector: ":scope", kind: "text" },
          { name: "intro", selector: "xpath=./following-sibling::p[1]", kind: "list" },
          {
            name: "sections",
            selector: "xpath=./following-sibling::div[1]//tbody/tr",
            kind: "list",
            itemFields: [
              { name: "title", selector: "th", kind: "text" },
              { name: "paragraphs", selector: "td", kind: "list" },
            ],
          },
        ],
      },
    },
    {
      type: "jobsAccordion",
      label: "Jobs Accordion",
      odyssey: { root: "section.mb-4:has([data-slot='accordion'])", fields: jobsAccordionFields() },
      // Legacy "Careers you can pursue" — anchored by its <h2>. Legacy uses TABS (not an accordion),
      // and inactive panels are unmounted, so only job titles (tab labels) are captured; per-job
      // descriptions surface as "extra" on odyssey. Expand via an extract() hatch to get them. [APPROX]
      legacy: {
        root: "h2:has-text('Careers you can pursue')",
        fields: [
          { name: "heading", selector: ":scope", kind: "text", optional: true },
          { name: "description", selector: "xpath=./following-sibling::p[1]", kind: "text", optional: true },
          {
            name: "jobs",
            selector: "xpath=./following-sibling::div[1]//button[@role='tab']",
            kind: "list",
            itemFields: [{ name: "title", selector: ":scope", kind: "text" }],
          },
        ],
      },
    },
    {
      type: "faq",
      label: "FAQ",
      odyssey: { root: "#faq", fields: faqFields() },
      // Legacy FAQ = custom AccordionTextItem rows (Radix). Questions extract cleanly; the answer
      // region ([role="region"]) is EMPTY in the DOM while collapsed, so answers surface as "extra"
      // on odyssey until expanded via an extract() hatch. [APPROX — questions only]
      legacy: {
        root: "div.py-4:has([class*='AccordionTextItem_item'])",
        fields: [
          { name: "heading", selector: "h2", kind: "text", optional: true },
          {
            name: "items",
            selector: "[class*='AccordionTextItem_item']",
            kind: "list",
            itemFields: [
              { name: "question", selector: "[class*='AccordionTextItem_trigger']", kind: "text" },
              { name: "answer", selector: "[role='region']", kind: "text" },
            ],
          },
        ],
      },
    },
    {
      type: "references",
      label: "References",
      odyssey: { root: "section.py-12:has(ol.list-decimal)", fields: referencesFields() },
      legacy: null, // §11 not pasted — unmapped
    },
  ],
};
