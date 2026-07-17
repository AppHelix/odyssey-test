import type { FieldSpec } from "./types";

/**
 * Reusable field-spec presets for common Odyssey component shapes, so page maps compose them
 * instead of re-authoring selectors. These target the ODYSSEY DOM (derived from the Odyssey
 * codebase); the legacy side of each mapping is authored separately (it has a different DOM).
 *
 * Selector rationale (from the Odyssey codebase):
 * - Headings render via <TextWithDirection as="h1|h2|h3">; their ids are randomized (useId), so we
 *   target by tag/role, never by id.
 * - Rich text renders with the stable `.rich-text` class (src/app/styles/rich-text.css).
 * - FAQ/accordions are shadcn/Radix and expose stable [data-slot="accordion-*"] attributes
 *   (src/components/ui/accordion.tsx). Tabs expose [data-slot="tabs-*"]; cards [data-slot="card-*"].
 * - Course card grids render as <ul class="course-card-grid"> of <li> product cards.
 * - `:scope` selects the component root itself (handled specially by the extractor); direct-child
 *   paragraphs use relative XPath `xpath=./p` (reliable in Playwright, unlike CSS `:scope > p`).
 */

/** Hero/banner: heading + optional subheading + optional CTA label. */
export function heroFields(): FieldSpec[] {
  return [
    { name: "heading", selector: "h1", kind: "text" },
    { name: "subheading", selector: "h2", kind: "text", optional: true },
    { name: "cta", selector: "a.btn, a[class*='btn']", kind: "text", optional: true },
  ];
}

/** Image-banner hero (learn topic): h1 heading + line-clamped body. */
export function bannerHeroFields(): FieldSpec[] {
  return [
    { name: "heading", selector: "h1", kind: "text" },
    { name: "body", selector: "[class*='line-clamp']", kind: "text", optional: true },
  ];
}

/** Rich-text / prose block: the whole block's text. */
export function richTextFields(): FieldSpec[] {
  return [{ name: "body", selector: ":scope", kind: "text" }];
}

/**
 * Topic Overview: an <h2> heading + prose body. Odyssey renders the body via ExpandableHtml ->
 * TextWithDirection, which dumps the CMS `description` field through `dangerouslySetInnerHTML`
 * ONLY when it detects actual HTML tags in the content (src/components/text-with-direction.tsx);
 * plain-text descriptions render as a bare text node with no <p> wrapper at all. Selecting on `p`
 * would come back empty for those topics. The outer `.space-y-4` wrapper class is applied
 * unconditionally either way, so target that directly and read its whole text as one block —
 * robust regardless of whether the CMS content happens to use <p> tags internally.
 */
export function topicOverviewFields(): FieldSpec[] {
  return [
    { name: "heading", selector: "h2", kind: "text" },
    { name: "paragraphs", selector: "div.space-y-4", kind: "text" },
  ];
}

/** Prose section: a heading + its direct paragraph children (e.g. Curriculum). */
export function proseSectionFields(headingSelector = "h3"): FieldSpec[] {
  return [
    { name: "heading", selector: headingSelector, kind: "text" },
    { name: "paragraphs", selector: "xpath=./p", kind: "list", compareAsText: true },
  ];
}

/** List section (Explore Jobs / Why Learn): heading + intro/closing paragraphs + bulleted items. */
export function listSectionFields(): FieldSpec[] {
  return [
    { name: "heading", selector: "h2", kind: "text" },
    { name: "paragraphs", selector: "xpath=./p", kind: "list", compareAsText: true },
    { name: "items", selector: "ul.list-disc > li", kind: "list" },
  ];
}

/** Program Guide: heading + intro paragraphs + per-section (title + paragraphs) blocks. */
export function programGuideFields(): FieldSpec[] {
  return [
    { name: "heading", selector: "h2", kind: "text" },
    { name: "intro", selector: "xpath=./p", kind: "list" },
    {
      name: "sections",
      selector: "div.mt-6",
      kind: "list",
      itemFields: [
        { name: "title", selector: "h3", kind: "text" },
        { name: "paragraphs", selector: "xpath=./p", kind: "list" },
      ],
    },
  ];
}

/** Shared Radix accordion item list (used by FAQ and Jobs Accordion). */
export function accordionItemsField(name: string, titleName: string, bodyName: string): FieldSpec {
  return {
    name,
    selector: "[data-slot='accordion-item']",
    kind: "list",
    itemFields: [
      { name: titleName, selector: "[data-slot='accordion-trigger']", kind: "text" },
      { name: bodyName, selector: "[data-slot='accordion-content']", kind: "text" },
    ],
  };
}

/** FAQ / accordion: optional heading + a list of question/answer items. */
export function faqFields(): FieldSpec[] {
  return [
    { name: "heading", selector: "h2", kind: "text", optional: true },
    accordionItemsField("items", "question", "answer"),
  ];
}

/** Jobs Accordion: optional heading + description + a list of job title/description items. */
export function jobsAccordionFields(): FieldSpec[] {
  return [
    { name: "heading", selector: "h2", kind: "text", optional: true },
    { name: "description", selector: "p", kind: "text", optional: true },
    accordionItemsField("jobs", "title", "description"),
  ];
}

/** Card grid: a list of product cards, compared by title. Reused for Trending + Program Listing. */
export function cardGridFields(itemSelector = ".course-card-grid > li"): FieldSpec[] {
  return [
    {
      name: "cards",
      selector: itemSelector,
      kind: "list",
      itemFields: [{ name: "title", selector: "[data-slot='card-content'] .line-clamp-2", kind: "text" }],
    },
  ];
}

/** Program Listing (Radix tabs): category labels + the visible tab's course cards. */
export function programListingFields(): FieldSpec[] {
  return [
    { name: "categories", selector: "[data-slot='tabs-trigger']", kind: "list" },
    {
      name: "visibleCourses",
      selector: "[data-slot='tabs-content'] [data-slot='card']",
      kind: "list",
      optional: true,
      itemFields: [{ name: "title", selector: ".line-clamp-2", kind: "text" }],
    },
  ];
}

/** Related Topics: optional heading (i18n) + a list of topic chip labels (WP content). */
export function relatedTopicsFields(): FieldSpec[] {
  return [
    { name: "heading", selector: "h3", kind: "text", optional: true },
    { name: "items", selector: "a", kind: "list" },
  ];
}

/** Navbar: the topic sub-nav links (labels). Odyssey uses the stable `a.link-nav-item` class. */
export function navbarFields(): FieldSpec[] {
  return [{ name: "items", selector: "a.link-nav-item", kind: "list" }];
}

/**
 * USP Block (Learn hub): a grid of `<div>` cards (NOT `<li>` — confirmed from usp-block.tsx), each
 * a title (h3) + description (p). The block's own heading is locale-fixed (not CMS), so it's used
 * only to locate the section (see learn.map.ts), never included as a compared field here.
 */
export function uspBlockFields(): FieldSpec[] {
  return [
    {
      name: "items",
      selector: "div.grid > div",
      kind: "list",
      itemFields: [
        { name: "title", selector: "h3", kind: "text" },
        { name: "description", selector: "p", kind: "text" },
      ],
    },
  ];
}

/**
 * Topic Directory (Learn hub): category blocks (`div.bg-putty-100`, confirmed from
 * topic-directory.tsx), each a category label (h3) + a list of subtopic links. Subtopics are
 * selected via `a` (not `span`) specifically to skip the literal `|` separator `<span>` rendered
 * between them in the source.
 */
export function topicDirectoryFields(): FieldSpec[] {
  return [
    {
      name: "categories",
      selector: "div.bg-putty-100",
      kind: "list",
      itemFields: [
        { name: "category", selector: "h3", kind: "text" },
        { name: "subtopics", selector: "a", kind: "list" },
      ],
    },
  ];
}

/** References: an ordered list of items, each a link label + citation. */
export function referencesFields(): FieldSpec[] {
  return [
    {
      name: "items",
      selector: "ol.list-decimal > li",
      kind: "list",
      itemFields: [
        { name: "text", selector: "a", kind: "text" },
        { name: "citation", selector: ".italic", kind: "text", optional: true },
      ],
    },
  ];
}

/**
 * Become Hero Banner: heading + body, both required (confirmed from become-hero-banner.tsx —
 * neither prop is optional, unlike the learn family's hero). Shared verbatim by both `become` and
 * `become/[slug]` (same component, same root class both places).
 */
export function becomeHeroBannerFields(): FieldSpec[] {
  return [
    { name: "heading", selector: "h1", kind: "text" },
    { name: "body", selector: "p", kind: "text" },
  ];
}

/**
 * Become Testimonial: renders one of two shapes (become-testimonials.tsx) — a plain quote
 * (`<blockquote>` + `<figcaption>` name/title) when `isRichText` is falsy, or a `.rich-text` block
 * with no attribution at all when `isRichText` is true. `quote` matches whichever is present;
 * `attribution` is optional since the rich-text variant never renders one. Shared by `become`,
 * `become/[slug]`, and (embedded) `becomeCareerTrack`.
 */
export function becomeTestimonialFields(): FieldSpec[] {
  return [
    { name: "quote", selector: "blockquote, .rich-text", kind: "text" },
    { name: "attribution", selector: "figcaption", kind: "text", optional: true },
  ];
}
