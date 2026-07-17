import type { PageComparisonMap } from "../../types";
import { topicOverviewFields, faqFields } from "../../presets";
import { normalizeText } from "../../../engine/normalize";
import type { NormalizedField } from "../../../engine/types";

/**
 * Component mapping for the course-detail page — pageType "learn/[slug]/[slug2]" (route
 * `/learn/[topic]/[course-slug]`), rendered by
 * odyssey/src/app/[locale]/learn/[topic]/[course-slug]/page.tsx.
 *
 * ODYSSEY selectors below were derived by directly reading page.tsx and each component's source
 * (not guessed) — see the plan for this change for the full per-component verification notes.
 * LEGACY selectors were derived from real DOM pasted into
 * comparison/mappings/learn/deep/legacy-dom-input-learn-deep.md (not guessed). Notable shape
 * differences from
 * Odyssey found in that DOM:
 * - courseCurriculum: legacy has no nested <ul><li> at all — weeks render as a flat sequence of
 *   <p> tags inside `[data-testid="expandable-block"]`, with sub-items <br>-joined inside one <p>
 *   rather than separate <li>s. A live run against a real course additionally showed that legacy
 *   and Odyssey don't even decompose the same CMS content into the same number/order of "weeks"
 *   (Odyssey's serializer splits each raw syllabus line on its first ":" into a separate
 *   title/items pair; legacy doesn't), so item-by-item list alignment is fundamentally the wrong
 *   comparison strategy here — both sides' extract() now flatten ALL text into one `values` array
 *   compared holistically via `compareAsText`, immune to either side's internal split points.
 * - faq: legacy uses a different accordion variant (`AccordionTextItemRefresh_*`, confirmed
 *   distinct from the topic page's `AccordionTextItem_*`) with a SINGLE accordion item whose
 *   trigger is a generic label, not a real question — all 6 real Q&A pairs are packed into one
 *   `.prose` block as alternating `<p><strong>Q. ...</strong><br>A. ...</p>`, requiring a custom
 *   extract() that splits each <p> on <br> and strips the "Q. "/"A. " prefixes.
 * - coursePricing: legacy reproduces the exact same "label and price share identical classes"
 *   collision already handled on the Odyssey side (both are `<h3 class="text-white text-[16px]
 *   sm:text-lg m-0">`) — disambiguated the same way, by direct-child structural position.
 *
 * Unlike learn/[topic], there is no wrapping id/section per CMS component here except
 * `#course-hero`/`#what-youll-learn-heading`/`#ways-to-take-course` — most sections are located by
 * their i18n-fixed heading text (confirmed exact strings from src/messages/en/*.json), used purely
 * to LOCATE the section, never as a compared field. Legacy sections are located the same way, by
 * exact heading text — this also disambiguates the "div.flex.flex-col.gap-6" wrapper class, which
 * legacy reuses across What You'll Learn/Curriculum/FAQ, all with otherwise-identical classes.
 *
 * Excluded (locale-only chrome, confirmed from source): EarnCertificate, CourseArchivedBanner,
 * CourseActiveBanner (headings/CTAs all i18n; CMS values only appear inside i18n template
 * strings), B2bEnquiryBar (100% i18n + static partner link), CourseMetadataBar/CourseSidebar/
 * CourseScrollSidebar (mostly i18n labels around CMS values already covered by courseHero/
 * coursePricing), ShareProgram (i18n heading, no visible text beyond share-icon aria-labels),
 * PagesBreadcrumb (sourced from page_structure, not .components). DeeperLearningUpsell is
 * conditional CMS content with no shared wrapper class — deferred, a candidate for a later
 * addition once this core set is verified live.
 */
export const learnDeepMap: PageComparisonMap = {
  pageType: "learn/[slug]/[slug2]",
  components: [
    {
      type: "courseHero",
      label: "Course Hero",
      // #course-hero wraps breadcrumb + CourseHeroCard + CourseMetadataBar + CourseSidebar
      // together (confirmed in page.tsx) — scope to it and read just the h1/description.
      // CourseHeroCard's description uses a plain TextWithDirection (not ExpandableHtml), with no
      // class shared with TopicOverview's, so it needs its own selector rather than reusing
      // topicOverviewFields()/`.space-y-4`.
      odyssey: {
        root: "#course-hero",
        fields: [
          { name: "heading", selector: "h1", kind: "text" },
          { name: "body", selector: "[class*='leading-relaxed']", kind: "text", optional: true },
        ],
      },
      // Root: h1 is a direct child of `div.flex.flex-col.gap-5` (confirmed from pasted DOM) —
      // combining the class combo with `:has(> h1)` uniquely anchors this specific inner wrapper
      // (h1 is page-unique). Body: both <p> tags are FULLY present in the DOM inside the stable
      // `data-testid="expandable-text-content"` wrapper — CSS `line-clamp-2` only visually
      // truncates, confirmed no click-through needed (unlike courseCurriculum below). Legacy splits
      // the description across two <p> tags where Odyssey has one text block, so compareAsText
      // joins them for a holistic comparison.
      legacy: {
        root: "div.flex.flex-col.gap-5:has(> h1)",
        fields: [
          { name: "heading", selector: "h1", kind: "text" },
          {
            name: "body",
            selector: "[data-testid='expandable-text-content'] p",
            kind: "list",
            compareAsText: true,
            optional: true,
          },
        ],
      },
    },
    {
      type: "whatYoullLearn",
      label: "What You'll Learn",
      // id="what-youll-learn-heading" is a literal hardcoded id (what-youll-learn.tsx) — high
      // confidence. Conditionally rendered (items.length === 0 -> null).
      // Root MUST use `> h2#...` (direct-child), not an unrestricted `:has(#...)`: this page has no
      // route-specific layout.tsx, so `src/app/[locale]/learn/layout.tsx`'s single <section> wraps
      // the ENTIRE page (confirmed from source) and also, unrestricted, "has" this id as a
      // descendant. That outer section is first in document order, so an unrestricted :has() root
      // resolution grabbed IT instead of what-youll-learn.tsx's own <section>, and "ul li" then
      // matched every <ul><li> on the whole page (breadcrumb, CourseMetadataBar's badge list, the
      // hero sidebar's "Show more" skills list, etc.) — a real live-run bug, not hypothetical.
      odyssey: {
        root: "section:has(> h2#what-youll-learn-heading)",
        fields: [{ name: "items", selector: "ul li", kind: "list" }],
      },
      // Root: h2 "What you'll learn" is a direct child of the section's outer
      // `div.flex.flex-col.gap-6` (confirmed) — anchoring on the exact heading text (not the
      // reused class combo) avoids collision with Curriculum/FAQ's identically-classed wrappers.
      // Items: plain `<li><img/><span>text</span></li>` — textContent picks up the span text fine.
      legacy: {
        root: `div:has(> h2:text-is("What you'll learn"))`,
        fields: [{ name: "items", selector: "ul li", kind: "list" }],
      },
    },
    {
      type: "aboutCourse",
      label: "About This Course",
      // AboutCourse renders heading (i18n, "About this course") + body via ExpandableHtml —
      // IDENTICAL shape to TopicOverview (ExpandableHtml unconditionally adds `.space-y-4` to its
      // content div regardless of caller, confirmed in expandable-html.tsx), so the exact same
      // preset applies unchanged.
      odyssey: {
        root: "section:has(> h2:text-is('About this course'))",
        fields: topicOverviewFields(),
      },
      // Legacy has no `.space-y-4`-equivalent single wrapper — body is 3 separate <p> tags inside
      // the generic `[data-testid="expandable-block"]` toggle wrapper (a testid reused for
      // Curriculum too, but scoped fine here since it's read relative to THIS component's root).
      // compareAsText joins the 3 <p> tags for a holistic comparison against Odyssey's one block.
      legacy: {
        root: "div:has(> h2:text-is('About this course'))",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          {
            name: "paragraphs",
            selector: "[data-testid='expandable-block'] p",
            kind: "list",
            compareAsText: true,
          },
        ],
      },
    },
    {
      type: "courseCurriculum",
      label: "Course Curriculum",
      // CourseCurriculumExpandable only renders the first `initialVisible` (2) weeks by default;
      // the rest genuinely don't exist in the DOM until a "Show more" toggle is clicked (confirmed
      // from course-curriculum-expandable.tsx: `visible = expanded ? weeks : weeks.slice(0, ...)`)
      // — same class of problem as the legacy Curriculum tabs fix, but ONE toggle, not per-tab.
      // Custom extract() clicks it once (if present) before reading every week.
      //
      // CONSOLIDATED, not itemized: `weeks` is a genuinely FLAT `{title, items}[]` data model
      // (confirmed from course.ts's serializer) — every single <li>/<p> line in the CMS's raw
      // syllabus HTML becomes its OWN "week" entry, split on the first ":" into title/items. A real
      // course (agentic-ai-with-langchain-and-langgraph) showed this splits differently than legacy's
      // rendering of the same line (e.g. odyssey: title "Reading" + items ["Helpful Tips for Course
      // Completion"], legacy: one atomic "Reading: Helpful Tips for Course Completion") and the two
      // sites don't even decompose into the same NUMBER of weeks — so item-by-item list alignment
      // produced nonsense modified/missing/extra pairings on live data. Both sides now return ONE
      // flat `values` array (every title + every sub-item's text, in reading order) with
      // `compareAsText: true`, so the whole section is compared as one holistic text blob instead —
      // immune to either side's internal split points, same strategy as courseHero.body/
      // aboutCourse.paragraphs above.
      odyssey: {
        root: "section:has(> h2:text-is('Curriculum'))",
        fields: [],
        extract: async (root) => {
          const showMore = root.locator("button[aria-expanded='false']");
          if ((await showMore.count()) > 0) {
            await showMore.first().click();
          }
          const weekItems = root.locator("ul.flex.flex-col.gap-6 > li");
          const count = await weekItems.count();
          const values: string[] = [];
          for (let i = 0; i < count; i++) {
            const week = weekItems.nth(i);
            const title = normalizeText(await week.locator("p").first().textContent());
            if (title) values.push(title);
            const subItems = week.locator("ul li");
            const subCount = await subItems.count();
            for (let j = 0; j < subCount; j++) {
              const v = normalizeText(await subItems.nth(j).textContent());
              if (v) values.push(v);
            }
          }
          return [{ name: "weeks", kind: "list", values, compareAsText: true }];
        },
      },
      // Legacy has NO nested <ul><li> at all (confirmed from pasted DOM) — weeks render as a flat
      // sequence of <p> tags inside `[data-testid="expandable-block"]` (e.g. `<p><strong>Week N:
      // Title</strong></p>` followed by `<p>item1<br>item2</p>` for the AWS course used to derive
      // this mapping). Rather than assuming every week is exactly 2 <p> tags (an assumption that
      // breaks on courses whose CMS content is authored less regularly), every <p> is read
      // uniformly: split its innerHTML on <br> (innerHTML, not textContent, because <br> leaves no
      // text-node boundary) and push every resulting segment onto one flat `values` array,
      // regardless of whether that <p> happens to be a title, a body, or something else — matches
      // the consolidated comparison strategy above, so which segment is "the title" no longer
      // matters. The pasted DOM's "Show less" button implies content is already fully expanded here
      // (unlike the topic page's per-tab Curriculum) — no click-through attempted.
      legacy: {
        root: "div:has(> h2:text-is('Curriculum'))",
        fields: [],
        extract: async (root) => {
          const paragraphs = root.locator("[data-testid='expandable-block'] p");
          const count = await paragraphs.count();
          const values: string[] = [];
          for (let i = 0; i < count; i++) {
            const html = (await paragraphs.nth(i).innerHTML()) || "";
            const parts = html
              .split(/<br\s*\/?>/i)
              .map((s) => normalizeText(s.replace(/<[^>]+>/g, "")))
              .filter(Boolean);
            values.push(...parts);
          }
          return [{ name: "weeks", kind: "list", values, compareAsText: true }];
        },
      },
    },
    {
      type: "meetInstructors",
      label: "Meet the Instructors",
      // Heading prop exists on the component but the page never passes it, so it's always the
      // i18n fallback ("Meet the instructors") — pure locator, not a compared field. Name/title
      // are both plain <p> with no distinguishing class (confirmed exactly 2 <p> siblings per
      // card), so positional nth-of-type is required.
      odyssey: {
        root: "section:has(> h2:text-is('Meet the instructors'))",
        fields: [
          {
            name: "instructors",
            selector: "ul li",
            kind: "list",
            itemFields: [
              { name: "name", selector: "p:nth-of-type(1)", kind: "text" },
              { name: "title", selector: "p:nth-of-type(2)", kind: "text" },
            ],
          },
        ],
      },
      // Root: h2 is nested one level inside a `div.flex.justify-start...` sibling of the card grid
      // (confirmed) — `:has(> div > h2:text-is(...))` exactly matches that 2-level nesting to avoid
      // an overly-broad unrestricted `:has()`. Items are `<a>` cards, not `<li>` (confirmed), each
      // with exactly 2 <p> tags — same nth-of-type convention as the Odyssey side.
      legacy: {
        root: "div:has(> div > h2:text-is('Meet the instructors'))",
        fields: [
          {
            name: "instructors",
            selector: "div.grid.grid-cols-1.gap-4 > a",
            kind: "list",
            itemFields: [
              { name: "name", selector: "p:nth-of-type(1)", kind: "text" },
              { name: "title", selector: "p:nth-of-type(2)", kind: "text" },
            ],
          },
        ],
      },
    },
    {
      type: "testimonials",
      label: "Testimonials",
      // Rendered with the `bare` variant on this page, but the i18n heading text is the same
      // regardless (confirmed). Uses ui/carousel.tsx's stable [data-slot="carousel-item"].
      // [APPROX] assumes Embla renders all slides in the DOM simultaneously (no lazy-load plugin
      // imported, only Autoplay) — verify on a live run.
      odyssey: {
        root: "section:has(> h2:text-is('Hear what other learners have to say'))",
        fields: [
          {
            name: "items",
            selector: "[data-slot='carousel-item']",
            kind: "list",
            itemFields: [
              { name: "quote", selector: "div[data-testid='expandable-block'] p", kind: "text" },
              { name: "name", selector: ".text-gray-light p:nth-of-type(1)", kind: "text" },
              { name: "location", selector: ".text-gray-light p:nth-of-type(2)", kind: "text" },
            ],
          },
        ],
      },
      // Confirmed from pasted DOM: legacy is also an Embla carousel (`div.social-proof`) with ALL
      // slides present simultaneously in the static DOM (only `aria-hidden` toggles) — matches the
      // Odyssey-side assumption. Items via the semantic `[aria-roledescription="slide"]` (more
      // stable than the embla__slide library class). Quote is the only <p> per card. Name/location
      // are plain sibling <div>s (not <p>, unlike Odyssey) inside `div...text-sm.font-bold` —
      // nth-child, not nth-of-type, since they're both plain <div>s.
      legacy: {
        root: "div.social-proof",
        fields: [
          {
            name: "items",
            selector: "[aria-roledescription='slide']",
            kind: "list",
            itemFields: [
              { name: "quote", selector: "p", kind: "text" },
              {
                name: "name",
                selector: "div.flex.flex-col.text-sm.font-bold > div:nth-child(1)",
                kind: "text",
              },
              {
                name: "location",
                selector: "div.flex.flex-col.text-sm.font-bold > div:nth-child(2)",
                kind: "text",
              },
            ],
          },
        ],
      },
    },
    {
      type: "coursePricing",
      label: "Course Pricing",
      // id="ways-to-take-course" is a literal default parameter (course-pricing-card.tsx) — high
      // confidence root. Content is heavily i18n bullet copy; only the seat-type label and
      // formatted price are genuinely CMS-derived, and BOTH are transformed (seatLabel() lookup,
      // Intl.NumberFormat), so exact legacy text may legitimately differ even when correct.
      // [APPROX]
      // NOTE: the "Certificate" i18n label span shares IDENTICAL classes with the price span
      // ("text-background text-lg font-bold") — confirmed from source — so the price is targeted
      // by structural position (the only <span> that's a DIRECT child of the outer
      // justify-between flex row) rather than by class, to avoid grabbing the wrong one.
      odyssey: {
        root: "#ways-to-take-course",
        fields: [
          { name: "seatLabel", selector: "span[class*='border-background']", kind: "text", optional: true },
          { name: "price", selector: "div[class*='justify-between'] > span", kind: "text", optional: true },
        ],
      },
      // Confirmed from pasted DOM: legacy reproduces the EXACT SAME class collision — "Certificate"
      // and the price are both `<h3 class="text-white text-[16px] sm:text-lg m-0">`. Same fix:
      // price is the only <h3> that's a DIRECT child of the outer `justify-between` row (":scope >
      // h3"), while "Certificate" is nested one level deeper inside `div.items-center.space-x-2`
      // alongside the seat-type label ("Premium"), itself a plain sibling <div> (not a span/badge).
      legacy: {
        root: "div.justify-between.items-end.rounded-t-xl",
        fields: [
          {
            name: "seatLabel",
            selector: "div.items-center.space-x-2 > div",
            kind: "text",
            optional: true,
          },
          { name: "price", selector: ":scope > h3", kind: "text", optional: true },
        ],
      },
    },
    {
      type: "faq",
      label: "FAQ",
      // Same faq.tsx component/situation as the Learn hub's FAQ — no wrapping id here either.
      odyssey: { root: "div:has(> h2):has([data-slot='accordion'])", fields: faqFields() },
      // Legacy uses a DIFFERENT accordion variant here (`AccordionTextItemRefresh_*`, confirmed
      // distinct from the topic page's `AccordionTextItem_*`) with only ONE accordion item, whose
      // trigger is a generic "Frequently Asked Questions" label rather than a real question — all 6
      // actual Q&A pairs are packed into one `[role="region"] .prose` block as alternating
      // `<p><strong>Q. ...</strong><br>A. ...</p>`. Custom extract() splits each <p> on <br>,
      // strips the "Q. "/"A. " prefixes (Odyssey's question/answer text has no such prefix), and
      // reads the page-level h2 ("Frequently asked questions") separately as `heading` — distinct
      // from (and not to be confused with) the per-item trigger's differently-cased label.
      legacy: {
        root: "div:has(> h2:text-is('Frequently asked questions'))",
        fields: [],
        extract: async (root) => {
          const heading = normalizeText(await root.locator(":scope > h2").first().textContent());
          const paragraphs = root.locator("[role='region'] p");
          const count = await paragraphs.count();
          const values: string[] = [];
          const items: NormalizedField[][] = [];
          for (let i = 0; i < count; i++) {
            const html = (await paragraphs.nth(i).innerHTML()) || "";
            const parts = html
              .split(/<br\s*\/?>/i)
              .map((s) => normalizeText(s.replace(/<[^>]+>/g, "")));
            const question = (parts[0] || "").replace(/^Q\.\s*/i, "");
            const answer = (parts.slice(1).join(" ") || "").replace(/^A\.\s*/i, "");
            if (!question && !answer) continue;
            values.push(question);
            items.push([
              { name: "question", kind: "text", values: [question] },
              { name: "answer", kind: "text", values: [answer] },
            ]);
          }
          return [
            { name: "heading", kind: "text", values: [heading], optional: true },
            { name: "items", kind: "list", values, items },
          ];
        },
      },
    },
  ],
};
