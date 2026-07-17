import type { PageComparisonMap } from "../../types";
import {
  becomeHeroBannerFields,
  becomeTestimonialFields,
  navbarFields,
  richTextFields,
  cardGridFields,
} from "../../presets";
import { normalizeText } from "../../../engine/normalize";

/**
 * Component mapping for the Become career-guide article page — pageType "become/[slug]" (e.g.
 * /become/data-scientist), rendered by odyssey/src/app/[locale]/become/[slug]/page.tsx.
 *
 * ODYSSEY selectors below were derived by directly reading page.tsx and each rendered component's
 * source (not guessed) — see the per-component comments for the exact evidence. Every one of the
 * 14 components below (except hero/navbar) is conditionally rendered (`{x ? <Comp/> : null}`), so
 * article-to-article variation in which components are present is expected and handled naturally
 * via component presence, not a mapping bug.
 *
 * LEGACY selectors were derived from real DOM from TWO articles pasted into
 * become/article/legacy-dom-input-become-article.md (not guessed): `/become/software-engineer`
 * ("Article A") and `/become/how-to-become-a-software-engineer` ("Article B", fewer sections, a
 * different order, and — for several components — a genuinely different DOM shape). Every legacy
 * selector below has been verified offline against BOTH by replaying real pasted DOM through
 * `extractComponent()` — first each article's components in ISOLATION, then again with every
 * component from one article concatenated onto a single page in real page order. The combined pass
 * matters: a component tested alone can look correct while its selector actually collides with
 * ANOTHER component elsewhere on the real page — see `testimonials` and `keyTakeaways` below, both
 * of which passed isolated testing but silently matched the wrong element once combined with
 * `hero`/`skillsRequirements` respectively.
 *
 * `industryInsights`, `careerTrack`, and `resources` are rooted on a fixed in-page `<a id="…">`
 * anchor marker rather than the section's own heading text — these ids exactly match the navbar's
 * own `href="#…"` links (confirmed), so they're a code-level anchor immune to per-article CMS
 * wording. `jobOverview`, `stepsToGetStarted`, and `programsPrep` turned out NOT to have this
 * marker reliably (absent, or not captured, in Article B's paste) and needed a different fix per
 * component — see each one's own comment. `skillsRequirements` needed the biggest change: its 3
 * sub-categories are ordered/labeled DIFFERENTLY between the two real articles, so position alone
 * can't map them — it now classifies each box by its own heading text via a custom `extract()`.
 * `testimonials` and `keyTakeaways` needed a class disambiguator each (see their own comments) once
 * the cross-component collisions above were found. Two components (`industryInsightsTable`,
 * `salaryByState`) are absent from Article B entirely, so their heading-text-template selectors are
 * still confirmed against only ONE article — see become/article/fragile-legacy-selectors.md.
 *
 * Two components have a KNOWN CAVEAT (flagged inline, not guessed around):
 * - `stepsToGetStarted`: both sides use a Radix tabs widget that only mounts the ACTIVE tab's
 *   content in the DOM — confirmed identical on both sides (legacy's own inactive panels are
 *   literally empty, `hidden=""`, no children at all). Field named `visiblePanel` to be honest
 *   about it, same reasoning as `programListingFields()`'s `visibleCourses` on the learn-topic page.
 * - `salaryByState`: its state-by-state table sits inside a Radix Accordion that starts CLOSED by
 *   default (no `forceMount`) — the `rows` selector is structurally correct but its data will read
 *   as empty until the accordion is expanded, same class of issue as `learn.map.ts`'s `faq.answer`.
 *   (Legacy uses the identical AccordionTextItem widget already seen on the learn hub's FAQ — the
 *   pasted DOM was expanded before copying, so legacy's own selector below is confirmed correct in
 *   shape, but a live run will hit the same closed-by-default problem unless a click-to-expand
 *   step is added on both sides.)
 */
export const becomeArticleMap: PageComparisonMap = {
  pageType: "become/[slug]",
  components: [
    {
      type: "hero",
      label: "Hero",
      // Same become-hero-banner.tsx component/root as the become hub — see becomeHeroBannerFields().
      odyssey: { root: "section.become-hero", fields: becomeHeroBannerFields() },
      // Confirmed from a second article's pasted DOM (`/become/how-to-become-a-software-engineer`,
      // "Article B" in legacy-dom-input-become-article.md): legacy actually has TWO different hero
      // templates — "fullwidth ..." (Article A, same convention as the become hub's hero) and
      // "bg-primary mx-break-out" (Article B, same convention as the LEARN hub's hero,
      // learn/learn.map.ts). Both variants share the same heading/body shape, so a combined
      // selector (comma = CSS "or") covers both without needing an extract() escape hatch.
      legacy: {
        root: "div.fullwidth:has(h1), div.bg-primary.mx-break-out:has(h1)",
        fields: [
          { name: "heading", selector: "h1", kind: "text" },
          { name: "body", selector: "p", kind: "text" },
        ],
      },
    },
    {
      type: "navbar",
      label: "Subject Navbar",
      // Same shared subject-hub/navbar.tsx component as the learn-topic page's "navbar" — same
      // root convention (`.bg-fern-500`, see learn/course/learn-course.map.ts) and the same stable
      // `a.link-nav-item` class for link labels (navbarFields(), presets.ts).
      odyssey: { root: ".bg-fern-500", fields: navbarFields() },
      // Identical convention to the learn-topic page's navbar (learn/course/learn-course.map.ts):
      // in-page anchor links (href="#…"); the external "Create an account" CTA is excluded.
      legacy: {
        root: "div.fullwidth.bg-secondary",
        fields: [{ name: "items", selector: "a[href^='#']", kind: "list" }],
      },
    },
    {
      type: "keyTakeaways",
      label: "Key Takeaways",
      // No reliable id (key-takeaways.tsx's own `id` prop is optional/CMS-provided) — anchored on
      // its distinctive class combo `bg-putty-200 border-putty-400` (confirmed unique).
      odyssey: {
        root: "div.bg-putty-200.border-putty-400",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          { name: "items", selector: "li", kind: "list" },
        ],
      },
      // Confirmed from pasted DOM: legacy has TWO different "Key takeaways"-labeled boxes on this
      // page — a small `bg-putty-100` sidebar box (h3, legacy's equivalent of `industryInsights`'s
      // sidebar) and this component's own bigger `bg-putty-200 border-putty-400` box (h2) —
      // mirroring the EXACT same h3-vs-h2 tag-level disambiguation already used on the Odyssey
      // side. "bg-putty-200" alone was NOT enough, though: confirmed via a combined full-page
      // verification (not just this component tested in isolation) that Article B's
      // `skillsRequirements` boxes ALSO use the exact "bg-putty-200 border-putty-400" combo (that
      // article's variant reuses the same "highlighted box" style for both components) — `.first()`
      // was silently grabbing one of THOSE boxes on any page where `keyTakeaways` itself is absent.
      // `:has(h2)` fixes it for real: `keyTakeaways`'s own box always has an h2, `skillsRequirements`'
      // boxes only ever have h3.
      legacy: {
        root: "div.bg-putty-200.border-putty-400:has(h2)",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          { name: "items", selector: "li", kind: "list" },
        ],
      },
    },
    {
      type: "jobOverview",
      label: "Job Overview",
      // rich-text.tsx renders className="job-overview pt-2" verbatim (confirmed from page.tsx's
      // <RichText className="job-overview pt-2"/> call) combined with the base ".rich-text" class
      // documented in presets.ts — distinctive, unrelated to the OUTER div#job-overview wrapper
      // (which shares this component's parent but isn't this component's own root).
      odyssey: { root: "div.rich-text.job-overview", fields: richTextFields() },
      // CONFIRMED TWO GENUINELY DIFFERENT SHAPES from a second article's pasted DOM
      // (`/become/how-to-become-a-software-engineer`, "Article B" in
      // legacy-dom-input-become-article.md):
      // - Article A: job-overview text and the salary chart are the LEFT/RIGHT columns of one
      //   shared 2-column grid, anchored via the `<a id="overview">` marker (matches the navbar's
      //   `href="#overview"`); the h2 is one level deeper, inside the grid's left column.
      // - Article B: no anchor at all, no chart (salaryChart is absent on this article), just a
      //   `<div class="fullwidth">` (exact class, nothing else — distinct from Hero's/
      //   stepsToGetStarted's own "fullwidth ..." combos, which always carry extra classes)
      //   directly wrapping `<h2>` + prose `<p>` tags. The h2's own text is a COMPLETELY different
      //   template ("What to expect from a career in `<role>`" vs. "What does a `<role>` do?") —
      //   no text or class in common with Article A at all.
      // No single declarative selector expresses both, so `extract()` picks whichever shape is
      // actually present (root matches either the `<a id="overview">` marker OR a bare
      // `div.fullwidth` — exactly one of the two exists per article) and reads forward from
      // whichever h2 it finds the same way either way.
      //
      // BUG FIXED: the `div.fullwidth` branch used to require an EXACT class match
      // (`@class='fullwidth'`, nothing else) — fragile to any real-world whitespace/extra-class
      // variation the trimmed paste didn't happen to show, which silently made the whole component
      // report as absent when it broke. Replaced with a CSS `.fullwidth` (contains, not exact)
      // combined with explicit exclusions instead: `:not(:has(h1))` rules out Hero (which also
      // carries "fullwidth" as one of several classes) and `:not(:has([role='tablist']))` rules out
      // `stepsToGetStarted` (`class="fullwidth bg-putty-200"`, also has a direct-child h2) — both
      // confirmed to otherwise collide with a bare "contains fullwidth" match.
      legacy: {
        root: "#overview, div.fullwidth:has(> h2):not(:has(h1)):not(:has([role='tablist']))",
        fields: [],
        extract: async (root) => {
          const tag = await root.evaluate((el) => el.tagName.toLowerCase());
          const heading =
            tag === "a"
              ? root.locator("xpath=./following-sibling::div[1]//h2").first()
              : root.locator("> h2").first();
          if ((await heading.count()) === 0) return null;
          const region = heading.locator("xpath=./following-sibling::*[self::p or self::ul]");
          const count = await region.count();
          const values: string[] = [];
          for (let i = 0; i < count; i++) {
            const v = normalizeText(await region.nth(i).textContent());
            if (v) values.push(v);
          }
          return [{ name: "body", kind: "list", values, compareAsText: true }];
        },
      },
    },
    {
      type: "salaryChart",
      label: "Salary Chart",
      // No reliable id (salary-chart.tsx's `sectionId` prop is optional/CMS-provided) — anchored
      // instead on the hardcoded chart image path (salary-chart.tsx), immune to CMS content.
      odyssey: {
        root: "section:has(img[src*='salary_chart.png'])",
        fields: [
          { name: "heading", selector: "h3", kind: "text" },
          {
            name: "rows",
            selector: "tbody tr",
            kind: "list",
            itemFields: [
              { name: "label", selector: "td:nth-child(1)", kind: "text" },
              { name: "value", selector: "td:nth-child(2)", kind: "text" },
            ],
          },
        ],
      },
      // Confirmed from pasted DOM: the RIGHT column of the shared job-overview/salary-chart grid
      // (see `jobOverview` above) — a third-party "everviz" Highcharts embed (`id="everviz-…"`,
      // code-derived and stable) followed by a `<figure><table>` with a `<caption>` heading and
      // label/value rows (unlike Odyssey's plain `<td>`/`<td>` pairs, legacy uses `<th scope="row">`
      // for the label).
      legacy: {
        root: "div:has(> div[id^='everviz-'])",
        fields: [
          { name: "heading", selector: "figure caption", kind: "text" },
          {
            name: "rows",
            selector: "figure table tr",
            kind: "list",
            itemFields: [
              { name: "label", selector: "th", kind: "text" },
              { name: "value", selector: "td", kind: "text" },
            ],
          },
        ],
      },
    },
    {
      type: "stepsToGetStarted",
      label: "Steps To Get Started",
      // No reliable id (become-steps-tabs.tsx's `id` prop is optional/CMS-provided) — anchored on
      // the shadcn Tabs root's `data-slot="tabs"` (ui/tabs.tsx). CAVEAT: only the active tab's
      // panel is mounted (no forceMount) — `visiblePanel` names this honestly rather than
      // pretending every tab's content is readable statically (mirrors `programListingFields()`'s
      // `visibleCourses` on the learn-topic page for the identical underlying reason).
      odyssey: {
        root: "section:has([data-slot='tabs'])",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          { name: "tabLabels", selector: "[data-slot='tabs-trigger']", kind: "list" },
          {
            name: "visiblePanel",
            selector: "[data-slot='tabs-content']",
            kind: "list",
            itemFields: [
              { name: "title", selector: "h3", kind: "text" },
              { name: "subtitle", selector: "p", kind: "text" },
              { name: "items", selector: "li", kind: "list" },
            ],
          },
        ],
      },
      // Confirmed from pasted DOM: a genuine Radix tabs widget (`role="tablist"`/`role="tab"`/
      // `role="tabpanel"`, 3 tabs: "For career starters" / "For career changers" / "For career
      // advancement"). CONFIRMED SYMMETRIC with the Odyssey caveat above — legacy's own inactive
      // panels are literally empty (`hidden=""`, no children at all), only the active one has
      // content, so `visiblePanel` is equally honest on both sides here, not a guess. There's also
      // a separate mobile-only rendering (`.block.lg:hidden`, a combobox + a DUPLICATE re-render of
      // the same first-tab content) — `[role='tab']`/`[role='tabpanel']` only exist in the desktop
      // widget, so no risk of double-counting from the mobile duplicate. `following-sibling::div[1]`
      // reaches the tabs wrapper (a sibling of this component's own heading, same pattern as
      // `jobOverview`/`salaryChart`); chained via `>> css=` rather than one combined xpath — see the
      // `programsPrep.cards` comment for why a combined `xpath=…//*[...]` expression is unreliable
      // against real markup like this.
      //
      // Root does NOT use the `<a id="steps">` marker after all — a second article's pasted DOM
      // (`/become/how-to-become-a-software-engineer`, "Article B") has this whole component (h2 +
      // intro paragraph + tabs) nested inside its own `<div class="fullwidth bg-putty-200">`, with
      // no anchor marker at all and a different heading template ("How to become a `<role>`" vs.
      // "Your path to becoming a `<role>`") — and even a different tab count (4 generic "Step N"
      // tabs vs. 3 named ones). What's genuinely common to both: the heading always has a LATER
      // sibling div containing the tabs widget — true whether that sibling relationship is at the
      // page's top level (Article A) or inside a shared wrapper (Article B), since `:has(~ …)`
      // resolves relative to whatever the h2's real parent is either way. `[role='tablist']`
      // (rather than `[data-slot='tabs']`, Odyssey's own hook) is what legacy's tabs widget actually
      // exposes.
      legacy: {
        root: "h2:has(~ div [role='tablist'])",
        fields: [
          { name: "heading", selector: ":scope", kind: "text" },
          {
            name: "tabLabels",
            selector: "xpath=./following-sibling::div[1] >> css=[role='tab']",
            kind: "list",
          },
          {
            name: "visiblePanel",
            selector: "xpath=./following-sibling::div[1] >> css=[role='tabpanel'][data-state='active']",
            kind: "list",
            itemFields: [
              { name: "title", selector: "h3", kind: "text" },
              { name: "subtitle", selector: "p", kind: "text" },
              { name: "items", selector: "li", kind: "list" },
            ],
          },
        ],
      },
    },
    {
      type: "programsPrep",
      label: "Programs Prep",
      // Same course-card-grid.tsx component/shape as the learn hub's trendingCourses (confirmed:
      // become-programs-prep.tsx renders <CourseCardGrid/> directly) — reuse cardGridFields() as-is.
      odyssey: {
        root: "section:has(.course-card-grid)",
        fields: [{ name: "heading", selector: "h2", kind: "text" }, ...cardGridFields()],
      },
      // Confirmed from pasted DOM: same "dynamic-grid" class/shape already used for the learn
      // hub's trendingCourses legacy mapping — but here cards link to a MIX of `/learn/`,
      // `/bachelors/`, and `/certificates/` paths (not just `/learn/`), so `a` (not
      // `a[href*='/learn/']`) is used to avoid undercounting.
      //
      // Root does NOT use the `<a id="programs">` marker after all — confirmed from a second
      // article's pasted DOM (`/become/how-to-become-a-software-engineer`, "Article B") that its
      // wrapping div (class "md:mb-12 mb-0 -mt-4" there, vs. Article A's "md:mb-12") has neither
      // the anchor nor even a preceding heading in what was captured — likely just a narrower paste
      // (clicked the card grid's own wrapper rather than a wider ancestor), not necessarily a real
      // absence, since the Odyssey side always requires a heading. Anchored directly on the
      // `.dynamic-grid` itself instead — present in and structurally identical across both
      // articles, independent of any anchor or heading. `heading` reaches backward for the nearest
      // preceding h2 and is marked optional so a genuinely missing one (rather than just an
      // incomplete paste) doesn't register as a false mismatch.
      legacy: {
        root: "div:has(> .dynamic-grid)",
        fields: [
          { name: "heading", selector: "xpath=./preceding-sibling::h2[1]", kind: "text", optional: true },
          {
            name: "cards",
            selector: ".dynamic-grid a",
            kind: "list",
            itemFields: [{ name: "title", selector: ".line-clamp-2", kind: "text" }],
          },
        ],
      },
    },
    {
      type: "skillsRequirements",
      label: "Skills & Requirements",
      // No id, and the section's own heading is real CMS content — but its THREE sub-list titles
      // ("Essential technical skills" / "Soft skills" / "Required education") are unconditional
      // i18n strings (src/messages/en/become.json BecomeSections.skills, confirmed no CMS
      // override in become-skills-requirements.tsx), so both the root AND each sub-list are
      // anchored on these fixed strings rather than a fragile Tailwind grid-column class.
      odyssey: {
        root: "section:has(h3:text-is('Essential technical skills'))",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          {
            name: "technicalSkills",
            selector: "article:has(h3:text-is('Essential technical skills')) li",
            kind: "list",
          },
          {
            name: "softSkills",
            selector: "article:has(h3:text-is('Soft skills')) li",
            kind: "list",
          },
          {
            name: "educationRequirements",
            selector: "article:has(h3:text-is('Required education')) li",
            kind: "list",
          },
        ],
      },
      // CONFIRMED (via a second article, `/become/how-to-become-a-software-engineer`, "Article B"
      // in legacy-dom-input-become-article.md) that the original positional mapping here was
      // wrong in general, exactly as this comment used to warn it might be: Article A's 3 boxes
      // are labeled "Formal degrees" / "Industry certifications" / "Interpersonal skills" (mapping
      // to education/technical/soft respectively), but Article B's are labeled "Technical skills" /
      // "Soft skills" / "Required education" IN THAT ORDER — i.e. box #2 is `technicalSkills` on
      // Article A but `softSkills` on Article B. A fixed position→field mapping cannot be correct
      // for both at once. Article B also wraps each box in a deeper structure that visually reuses
      // the "highlighted box" style seen elsewhere (`bg-putty-200`/`border-putty-400`, the SAME
      // classes `keyTakeaways` anchors on) rather than Article A's plain `bg-putty-100` — so there's
      // no shared wrapper class between articles either, only the fact that each box has exactly
      // one `h3` label + one `ul` of `li`s, regardless of nesting depth.
      //
      // Fixed by classifying each box AT RUNTIME by its own `h3` text against keyword sets built
      // from the real labels seen in BOTH articles (not guessed) — "degree"/"education" →
      // educationRequirements, "technical"/"certification" → technicalSkills, "soft"/
      // "interpersonal" → softSkills. Root anchors on the grid itself (`lg:grid-cols-3`, present in
      // both articles, distinct from `careerTrack`'s own `lg:grid-cols-4` stage grid) rather than
      // the `<a id="education">` marker, since Article B's paste didn't show that marker either.
      legacy: {
        root: "div.grid.lg\\:grid-cols-3:has(h3)",
        fields: [],
        extract: async (root) => {
          const headingLoc = root.locator("xpath=./preceding-sibling::h2[1]");
          const heading =
            (await headingLoc.count()) > 0 ? normalizeText(await headingLoc.first().textContent()) : "";

          const boxes = root.locator("> div");
          const boxCount = await boxes.count();
          const buckets: Record<"technicalSkills" | "softSkills" | "educationRequirements", string[]> = {
            technicalSkills: [],
            softSkills: [],
            educationRequirements: [],
          };
          for (let i = 0; i < boxCount; i++) {
            const box = boxes.nth(i);
            const labelLoc = box.locator("h3");
            const label =
              (await labelLoc.count()) > 0
                ? normalizeText(await labelLoc.first().textContent()).toLowerCase()
                : "";
            const items = (await box.locator("li").allTextContents())
              .map((t) => normalizeText(t))
              .filter(Boolean);
            if (/degree|education/.test(label)) buckets.educationRequirements.push(...items);
            else if (/technical|certification/.test(label)) buckets.technicalSkills.push(...items);
            else if (/soft|interpersonal/.test(label)) buckets.softSkills.push(...items);
          }

          return [
            { name: "heading", kind: "text", values: [heading] },
            { name: "technicalSkills", kind: "list", values: buckets.technicalSkills },
            { name: "softSkills", kind: "list", values: buckets.softSkills },
            { name: "educationRequirements", kind: "list", values: buckets.educationRequirements },
          ];
        },
      },
    },
    {
      type: "testimonials",
      label: "Testimonials",
      // Same become-testimonials.tsx component/root as the become hub (becomeTestimonialFields()).
      // Note: BecomeCareerTrack can ALSO render its own nested instance of this same component —
      // `.first()` (the default `pick`) still resolves to THIS standalone one, since page.tsx
      // renders the standalone `testimonial` before `careerTrack` in JSX order (confirmed).
      odyssey: { root: "section.bg-inverted.py-12", fields: becomeTestimonialFields() },
      // BUG FIXED: root was `div.bg-primary` alone. Article B's hero ALSO uses "bg-primary" as one
      // of its classes (`class="bg-primary not-prose mx-break-out mb-6"`) — since hero always
      // renders first on the page, `.first()` was silently resolving to hero's div instead of the
      // actual testimonials div further down (missed in earlier verification because each
      // component was tested against an ISOLATED snippet, never combined with hero the way a real
      // page renders them together). Fixed by requiring "p-6" too — confirmed present on every
      // testimonials instance seen (become hub, both become/[slug] articles) and absent from
      // hero's class list.
      legacy: {
        root: "div.bg-primary.p-6",
        fields: [
          { name: "quote", selector: "p.font-bold", kind: "text" },
          { name: "attribution", selector: "p.text-primary-foreground", kind: "text", optional: true },
        ],
      },
    },
    {
      type: "industryInsights",
      label: "Industry Insights",
      // No id, and the section's own heading is CMS content — but its sidebar's h3 is the
      // unconditional i18n string "Key takeaways" (BecomeSections.industryInsights.sidebarHeading,
      // confirmed no CMS override) — a SEPARATE, always-h3 instance from the unrelated
      // `keyTakeaways` component (whose own heading, when it falls back to i18n, renders as h2,
      // not h3 — no tag-level collision).
      odyssey: {
        root: "section:has(h3:text-is('Key takeaways'))",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          { name: "sidebarKeyTakeaways", selector: "ul.list-disc li", kind: "list" },
          { name: "body", selector: ".rich-text", kind: "text" },
        ],
      },
      // Confirmed from pasted DOM: legacy has NO sidebar box for this component at all — just a
      // heading followed directly by plain `<p>` paragraphs (user-confirmed: "no other div for
      // this, just multiple P blocks"). No `sidebarKeyTakeaways` equivalent exists here, so that
      // field is intentionally omitted (not guessed) — it will correctly report as odyssey-only
      // content, which is real, not a bug. Root uses the `<a id="industry-insights">` marker
      // (matches the navbar's `href="#industry-insights"`) rather than the h2's own "Industry
      // insights for `<role>`" text.
      legacy: {
        root: "xpath=//a[@id='industry-insights']/following-sibling::h2[1]",
        fields: [
          { name: "heading", selector: ":scope", kind: "text" },
          {
            name: "body",
            selector: "xpath=./following-sibling::p",
            kind: "list",
            compareAsText: true,
          },
        ],
      },
    },
    {
      type: "industryInsightsTable",
      label: "Industry Insights Table",
      // A second, separate top-level RichText block (page.tsx's `components.rich_text`) — rendered
      // with className="become-industry-insights-table" verbatim, distinctive and unrelated to the
      // `jobOverview` RichText's own "job-overview" class.
      odyssey: { root: "div.rich-text.become-industry-insights-table", fields: richTextFields() },
      // Confirmed from pasted DOM: a `<h3>Top 5 industries for `<role>`</h3>` (template) followed
      // by a `<figure><table>` of industry/wage rows. No wrapper element was included in the paste
      // (starts directly at the h3) — anchored on the heading, `body` covers just the figure
      // (doesn't include the heading's own text, a minor asymmetry vs. odyssey's single rich-text
      // blob — acceptable given this is a secondary, supplementary block).
      legacy: {
        root: "h3:has-text('Top 5 industries')",
        fields: [{ name: "body", selector: "xpath=./following-sibling::figure[1]", kind: "text" }],
      },
    },
    {
      type: "salaryByState",
      label: "Salary By State",
      // No id — anchored on the hardcoded map-chart image path (become-salary-table.tsx),
      // immune to CMS content. `introHeading` has a literal hardcoded id
      // ("salary-by-state-intro-heading") set directly in source — high confidence. CAVEAT:
      // `rows` (the actual state salary table) lives inside a Radix Accordion that starts CLOSED
      // by default (ui/accordion.tsx has no `forceMount`) — this selector is structurally correct
      // but the accordion's content will read as empty until expanded; needs either a click-to-
      // expand extract() or confirmation the legacy side has the same limitation, same as
      // `learn.map.ts`'s `faq.answer` caveat.
      odyssey: {
        root: "section:has(img[src*='map_chart.png'])",
        fields: [
          { name: "introHeading", selector: "#salary-by-state-intro-heading", kind: "text" },
          {
            name: "introDescription",
            selector: "#salary-by-state-intro-heading + p",
            kind: "text",
            optional: true,
          },
          {
            name: "rows",
            selector: "[data-slot='accordion-content'] tbody tr",
            kind: "list",
            itemFields: [{ name: "state", selector: "td:first-child", kind: "text" }],
          },
        ],
      },
      // Confirmed from pasted DOM: heading follows an "Explore top `<role>` salaries by state"
      // template (partial match on the stable tail). No wrapper element in the paste — `rows`
      // reaches past an "everviz" state-map chart div to the accordion+table beyond it. Legacy uses
      // the SAME AccordionTextItem widget as the learn hub's FAQ (`AccordionTextItem_item__adF2E`
      // etc.) — the pasted snapshot had it manually expanded (`data-state="open"`), confirming this
      // selector's shape is correct, but a live run will still hit the same closed-by-default
      // problem as the Odyssey side unless a click-to-expand step is added (see the file-level
      // comment on `salaryByState`). State names are in `<th scope="row">`, not `<td>` — matches
      // this component's own DOM, not the `td:first-child` convention used elsewhere.
      legacy: {
        root: "h3:has-text('salaries by state')",
        fields: [
          { name: "introHeading", selector: ":scope", kind: "text" },
          {
            name: "introDescription",
            selector: "xpath=./following-sibling::p[1]",
            kind: "text",
            optional: true,
          },
          {
            name: "rows",
            selector: "xpath=./following-sibling::div[2]//table/tbody/tr",
            kind: "list",
            itemFields: [{ name: "state", selector: "th", kind: "text" }],
          },
        ],
      },
    },
    {
      type: "careerTrack",
      label: "Career Track",
      // No id, no i18n-fixed text — anchored on its stage cards' distinctive class combo
      // (`article.bg-putty-100.rounded-lg`, confirmed unique — become-skills-requirements.tsx's
      // similar-looking cards use a different combo with no "rounded-lg"). `description` and
      // `intro` are both direct-child <p> of the root with no distinguishing class, so — same
      // idiom as `proseSectionFields()`/`listSectionFields()` — both are read together via
      // `xpath=./p` compared holistically, immune to which one is present/order. The optional
      // nested testimonial and CTA block are intentionally NOT mapped as separate fields here
      // (out of scope for this pass — `stages` is the core comparable content).
      odyssey: {
        root: "section:has(article.bg-putty-100.rounded-lg)",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          { name: "paragraphs", selector: "xpath=./p", kind: "list", compareAsText: true },
          {
            name: "stages",
            selector: "article",
            kind: "list",
            itemFields: [
              { name: "title", selector: "h3", kind: "text" },
              { name: "roles", selector: "li", kind: "list" },
            ],
          },
        ],
      },
      // Root uses the `<a id="careers">` marker (matches the navbar's `href="#careers"`) rather
      // than the h2's own "`<Role>` career track" text. `paragraphs` reads every following `<p>`
      // sibling holistically (2 in this example, with a `<ul>` of industries interspersed between
      // them that neither side captures — same simplification as Odyssey's own `xpath=./p`, so
      // both sides stay symmetric). Stages grid uses the same `bg-putty-100` combo as
      // `skillsRequirements`' boxes elsewhere on this page, but scoping via
      // `following-sibling::div[1]` (relative to THIS component's own heading) avoids any
      // cross-component collision — no need for odyssey's "rounded-lg" disambiguator.
      legacy: {
        root: "xpath=//a[@id='careers']/following-sibling::h2[1]",
        fields: [
          { name: "heading", selector: ":scope", kind: "text" },
          {
            name: "paragraphs",
            selector: "xpath=./following-sibling::p",
            kind: "list",
            compareAsText: true,
          },
          {
            name: "stages",
            selector: "xpath=./following-sibling::div[1]/div",
            kind: "list",
            itemFields: [
              { name: "title", selector: "h3", kind: "text" },
              { name: "roles", selector: "li", kind: "list" },
            ],
          },
        ],
      },
    },
    {
      type: "resources",
      label: "Resources",
      // No id, no i18n-fixed text — anchored on its links' distinctive `text-link` class
      // (become-resources.tsx; confirmed no other become/[slug] component uses this class).
      odyssey: {
        root: "section:has(a.text-link)",
        fields: [
          { name: "heading", selector: "h2", kind: "text" },
          {
            name: "groups",
            selector: "article",
            kind: "list",
            itemFields: [
              { name: "title", selector: "h3", kind: "text" },
              { name: "links", selector: "a", kind: "list" },
            ],
          },
        ],
      },
      // Root uses the `<a id="resources">` marker (matches the navbar's `href="#resources"`)
      // rather than the h2's own "Explore additional `<role>` resources" text. `links` reads every
      // `<li>` (not just `a`-wrapped ones) — legacy has at least one plain unlinked entry
      // ("Software developer career guide"), same "don't undercount plain-text items" reasoning as
      // the hub's `careerGuidance`.
      legacy: {
        root: "xpath=//a[@id='resources']/following-sibling::h2[1]",
        fields: [
          { name: "heading", selector: ":scope", kind: "text" },
          {
            name: "groups",
            selector: "xpath=./following-sibling::div[1]/div",
            kind: "list",
            itemFields: [
              { name: "title", selector: "h3", kind: "text" },
              { name: "links", selector: "li", kind: "list" },
            ],
          },
        ],
      },
    },
  ],
};
