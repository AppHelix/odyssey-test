import type { PageComparisonMap } from "../types";
import { becomeHeroBannerFields, becomeTestimonialFields } from "../presets";

/**
 * Component mapping for the Become hub page — pageType "become" (route `/become`), rendered by
 * odyssey/src/app/[locale]/become/page.tsx.
 *
 * ODYSSEY selectors below were derived by directly reading page.tsx and each component's source
 * (not guessed): become-hero-banner.tsx, become-career-hubs.tsx, become-career-guidance.tsx,
 * become-testimonials.tsx. LEGACY selectors were derived from real DOM pasted into
 * become/legacy-dom-input-become.md (not guessed).
 *
 * `careerHubs` and `careerGuidance` share the same (unpasted) legacy parent wrapper — the paste
 * started directly at each section's own `<h2>`, with no distinguishing wrapper class in between.
 * Since `/become` is a single fixed page (not a per-instance template like learn-course's topic
 * pages), anchoring directly on each section's own heading text + `following-sibling` XPath for
 * the rest is safe here — there's no "different topic renders this differently" risk the way
 * there is for a templated page (see learn/course/fragile-legacy-selectors.md for that concern).
 */
export const becomeMap: PageComparisonMap = {
  pageType: "become",
  components: [
    {
      type: "hero",
      label: "Hero",
      // "become-hero" is a distinctive, component-specific class (confirmed unconditional on the
      // root <section> regardless of props) — see becomeHeroBannerFields() in presets.ts.
      odyssey: { root: "section.become-hero", fields: becomeHeroBannerFields() },
      // Root: "fullwidth" combined with :has(h1) — same convention already used for the
      // learn-topic page's hero (learn/course/learn-course.map.ts). Body is a single plain <p>.
      legacy: {
        root: "div.fullwidth:has(h1)",
        fields: [
          { name: "heading", selector: "h1", kind: "text" },
          { name: "body", selector: "p", kind: "text" },
        ],
      },
    },
    {
      type: "careerHubs",
      label: "Career Hubs",
      // #career-hubs is a literal hardcoded id (become-career-hubs.tsx) — high confidence.
      // Hub cards are <li class="become-hub-card"> (confirmed), each title (h3) + description (p)
      // + an optional CTA link — same convention as the learn hub's uspBlock/heroFields CTA field.
      odyssey: {
        root: "#career-hubs",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          { name: "description", selector: "p", kind: "text" },
          {
            name: "hubs",
            selector: "li.become-hub-card",
            kind: "list",
            itemFields: [
              { name: "title", selector: "h3", kind: "text" },
              { name: "description", selector: "p", kind: "text" },
              { name: "cta", selector: "a", kind: "text", optional: true },
            ],
          },
        ],
      },
      // Confirmed from pasted DOM: no wrapper element was included in the paste at all (starts
      // directly at this section's own <h2>) — anchored on the heading text itself (partial match,
      // to sidestep the apostrophe in "today's" inside Playwright's :text-is() quoting), then
      // `following-sibling` XPath for description + the hub-card grid. Hub cards have no distinct
      // class on legacy (plain <div>, unlike Odyssey's `li.become-hub-card`) — selected by grid
      // position instead. CTA link text included same as Odyssey.
      legacy: {
        root: "h2:has-text('Learn what it takes to succeed')",
        fields: [
          { name: "heading", selector: ":scope", kind: "text" },
          { name: "description", selector: "xpath=./following-sibling::p[1]", kind: "text" },
          {
            name: "hubs",
            selector: "xpath=./following-sibling::div[1]/div",
            kind: "list",
            itemFields: [
              { name: "title", selector: "h3", kind: "text" },
              { name: "description", selector: "p", kind: "text" },
              { name: "cta", selector: "a", kind: "text", optional: true },
            ],
          },
        ],
      },
    },
    {
      type: "careerGuidance",
      label: "Career Guidance",
      // No id on this component's own <section> (confirmed from become-career-guidance.tsx) — the
      // heading is real CMS content (not i18n-templated), so anchored instead on the distinctive,
      // component-specific class of its link list (`become-guidance-links`, confirmed unique).
      odyssey: {
        root: "section:has(.become-guidance-links)",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          { name: "description", selector: "p", kind: "text" },
          { name: "items", selector: "a.become-guidance-link", kind: "list" },
        ],
      },
      // Confirmed from pasted DOM: same shared-parent situation as `careerHubs` — anchored on this
      // section's own heading text (no apostrophe here, so an exact `:text-is()` match is safe),
      // then `following-sibling` XPath for description + the guidance-links list. `items` reads
      // every `<li>` regardless of whether it wraps a real `<a>` — legacy renders SOME topics as
      // plain unlinked text (confirmed: about half the pasted `<li>`s have no `<a>` at all, e.g.
      // "How to become an actuary"), unlike Odyssey where every guidance item is always a link.
      // Selecting only `a`-wrapped items would silently undercount and produce a false content
      // mismatch for topics that are legitimately present on legacy, just not hyperlinked yet.
      legacy: {
        root: "h2:text-is('Start your career with step-by-step guidance')",
        fields: [
          { name: "heading", selector: ":scope", kind: "text" },
          { name: "description", selector: "xpath=./following-sibling::p[1]", kind: "text" },
          { name: "items", selector: "xpath=./following-sibling::ul[1]/li", kind: "list" },
        ],
      },
    },
    {
      type: "testimonials",
      label: "Testimonials",
      // No id/data-slot on become-testimonials.tsx's own <section> — anchored on its
      // "bg-inverted py-12" class combo, confirmed unique among this page's components. See
      // becomeTestimonialFields() in presets.ts for the two-render-variant handling.
      odyssey: { root: "section.bg-inverted.py-12", fields: becomeTestimonialFields() },
      // Root: "bg-primary.p-6" (confirmed from pasted DOM). Not just "bg-primary" alone — the
      // become/[slug] article page's hero can ALSO render with a "bg-primary"-classed div (one of
      // its two legacy hero templates, see become/article/become-article.map.ts's hero comment),
      // and since hero always comes first in DOM order, a bare `.bg-primary` root risks resolving
      // to hero instead on any page composed the same way. "p-6" is confirmed present on every
      // testimonials instance seen and absent from that hero variant, so it's kept here for the
      // same defensive reason even though hub's own hero doesn't currently collide. Quote and
      // attribution are both plain <p> siblings (no <figcaption> on legacy) — disambiguated by
      // their own distinct classes rather than DOM order, since `becomeTestimonialFields()`'s
      // shared shape doesn't apply here (that preset's `quote`/`blockquote, .rich-text` selector
      // and `figcaption`-based attribution don't match this legacy markup at all).
      legacy: {
        root: "div.bg-primary.p-6",
        fields: [
          { name: "quote", selector: "p.font-bold", kind: "text" },
          { name: "attribution", selector: "p.text-primary-foreground", kind: "text", optional: true },
        ],
      },
    },
  ],
};
