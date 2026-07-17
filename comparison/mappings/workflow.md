# Workflow: mapping a new page type

How we go from "a page exists in the Odyssey repo" to "it's wired into the legacy-vs-Odyssey
comparison tool", based on how `learn`, `learn/[slug]`, and `learn/[slug]/[slug2]` were built.
Read `../../README.md`'s Architecture section first if you haven't — this assumes you know the
three-layer split (`engine/` generic, `mappings/` page-aware, tests run it).

## Folder convention

Each page type gets its own folder under `comparison/mappings/`. When a page has sub-pages (routes
nested under it, e.g. `/learn/[topic]` and `/learn/[topic]/[course-slug]` under `/learn`), their
folders nest INSIDE the parent page's folder too — one `learn/` folder holds the whole family,
rather than flat sibling folders (`learn-course/`, `learn-deep/`) at the `mappings/` root. This
keeps the folder tree a direct mirror of the URL hierarchy, so page relationships are visible from
the directory structure alone:

```
comparison/mappings/
├── types.ts, presets.ts, heading-region.ts, registry.ts   # shared, page-agnostic — stay at root
├── workflow.md                                            # this file
└── learn/                              # pageType "learn" (/learn hub) — the parent page
    ├── learn.map.ts
    ├── legacy-dom-input-learn.md
    ├── course/                         # pageType "learn/[slug]" (/learn/[topic]) — sub-page
    │   ├── learn-course.map.ts
    │   ├── legacy-dom-input-learn-course.md
    │   └── fragile-legacy-selectors.md    # page-specific follow-up notes (optional, as needed)
    └── deep/                           # pageType "learn/[slug]/[slug2]" (course detail) — sub-page
        ├── learn-deep.map.ts
        └── legacy-dom-input-learn-deep.md
```

Only genuinely page-agnostic code/helpers live at the `mappings/` root (`types.ts`, `presets.ts`,
`heading-region.ts`, `registry.ts`). Anything specific to one page type — its map, its legacy DOM
input file, its own fragile-selector notes — lives inside that page's folder, nested under its
parent's folder when it's a sub-page of another mapped route.

## Step-by-step: adding a new page type

### 1. Pick the page and read its Odyssey source

Find the route under `odyssey/src/app/[locale]/...` and open its `page.tsx`. Read which named
components it renders — that list IS the component inventory for this page's map. Don't guess
component shapes from screenshots; read the actual `.tsx` source for each component to find:

- A stable root locator (an `id`, a hardcoded class, a distinctive prop-driven wrapper — never an
  auto-generated/randomized one like Radix/`useId` ids).
- Each field's real selector (tag, class, or `data-slot`/`data-testid` attribute) and whether it's
  `text` or `list`, optional or required, and any nested `itemFields` for list items.
- Whether an existing `presets.ts` helper already matches this component's shape (reuse it) or
  whether this page introduces a new reusable shape worth adding as a new preset function.

If a section's legacy DOM shape is expected to vary page-to-page (heading found by text pattern,
or by position relative to another anchor, rather than a fixed wrapper), reach for
`heading-region.ts`'s `headingRegionSet()` / `precedingHeadingRegionSet()` instead of a plain
`root` selector — see `learn/course/fragile-legacy-selectors.md` for the lesson that motivated this
(a fixed-wrapper assumption broke the moment a second topic page rendered the same section
differently).

### 2. Create the page's folder and its `.map.ts`

`comparison/mappings/<page>/<page>.map.ts`, exporting a `PageComparisonMap`:

```ts
import type { PageComparisonMap } from "../types";
import { /* preset helpers you need */ } from "../presets";

export const <page>Map: PageComparisonMap = {
  pageType: "<route pattern, e.g. 'learn/[slug]'>",
  components: [
    {
      type: "hero",
      label: "Hero",
      odyssey: { root: "...", fields: [...] },  // derived from odyssey source — never guessed
      legacy: null, // LEGACY TODO: fill once legacy-dom-input-<page>.md is pasted
    },
    // ...one entry per component found in step 1
  ],
};
```

Every `odyssey` selector should be filled in immediately (it's derivable right now, from code you
can read) — only `legacy` stays `null` at this point, one per component.

### 3. Generate the blank legacy DOM-input placeholder

`comparison/mappings/<page>/legacy-dom-input-<page>.md` — a Markdown file the human fills in by
hand later. Structure, one section per component in the same order as the `.map.ts`:

```markdown
# Legacy DOM → selector input — `<page>` ([url](...) — one-line description)

**How to use this file**

1. Open `<the real legacy URL>` in the browser.
2. For each component below, in DevTools right-click the component's **outermost element** →
   **Copy → Copy outerHTML**, and paste it inside that component's ```html block.
    - Paste the whole component subtree (root element + its inner content). Trimming huge repeated
      lists to ~2-3 representative items is fine — only the structure is needed.
    - If a component doesn't exist on the legacy page, write `N/A` in its block.
3. Tell me when done — I'll derive each `legacy: { root, fields }` and fill them into
   `<page>.map.ts`, keeping the field names identical to the Odyssey side.

---

## 1. Hero · type: `hero` · key: `...`

**Fields I'll produce (names fixed):**

- `heading` — text
- `body` — text (optional)

**Paste legacy DOM:**

```html

```

**Notes:**

---
(...repeat per component...)
```

Field names and shapes in each section must exactly mirror the `odyssey.fields` already written in
step 2 — that's what lets the two sides line up during comparison. The human filling this in
should never need to think about matching field names themselves.

**Formatting note:** keep every pasted `outerHTML` block on its own single line as copied from
DevTools — don't hand-wrap it. If a paste turns out to be too large for an editor to open
comfortably, that's a follow-up formatting fix (pretty-print long lines), not a reason to trim
content silently.

### 4. Register the page

- Add the map to `MAP_REGISTRY` in `comparison/mappings/registry.ts`.
- Add one or more entries referencing the new `pageType` to `config/urls.json` — the SAME file the
  page-validation suite reads, so an existing plain-string entry for this path just needs to become
  `{ "url": "...", "pageType": "...", "name": "..." }` rather than a new entry in a separate file.
  Only add `legacyUrl` if the legacy path genuinely differs from `url`.

### 5. Hand off, then fill in `legacy`

Once the human pastes real DOM into `legacy-dom-input-<page>.md`:

- Derive each `legacy: { root, fields }` **from the pasted DOM only** — never guess a selector that
  wasn't confirmed present in what was pasted.
- If a field can't be confirmed from the paste (e.g. content that's empty/collapsed in the DOM
  snapshot, like an unexpanded accordion panel), leave a clear code comment explaining the caveat
  rather than shipping a guessed selector silently — see `faq` in `learn/learn.map.ts` for the
  pattern (structurally-correct selector kept, but flagged as unverified with a note on why).
  Same idea for `null`: if a whole component wasn't pasted at all, leave `legacy: null` with a
  one-line reason, don't invent a placeholder selector.
- If the same legacy DOM shape is unlikely to hold across every instance of this page (e.g. a
  section whose heading isn't a fixed template across topics), log it in a page-local
  `fragile-legacy-selectors.md` as a deferred follow-up rather than shipping a selector confirmed
  against only one example — `learn/course/fragile-legacy-selectors.md` is the template for this.

### 6. Verify

- `npx tsc --noEmit` — the map files are plain TypeScript, so a typo/shape mismatch fails fast.
- `tests-selftest/comparison-selftest.spec.ts` has a real-DOM regression pattern per page
  (`page.setContent(...)` with a trimmed verbatim paste, asserting every legacy selector resolves)
  — worth adding one for the new page before trusting it against the live sites.
- Run `npm run test:compare` against the newly added URL pairs once both sides have selectors.

## Current coverage vs. what's left

The `learn` family (all three routes) and the top two tiers of `become` are mapped and registered:

| pageType | Route | Folder |
|---|---|---|
| `learn` | `/learn` | `learn/` |
| `learn/[slug]` | `/learn/[topic]` | `learn/course/` |
| `learn/[slug]/[slug2]` | `/learn/[topic]/[course-slug]` | `learn/deep/` |
| `become` | `/become` | `become/` |
| `become/[slug]` | `/become/[slug]` (e.g. `/become/data-scientist`) | `become/article/` |

`become`'s legacy side is fully filled in (all 4 hub components). `become/[slug]`'s legacy side is
fully filled in for all 14 components, derived from AND verified against TWO real articles —
`/become/software-engineer` and `/become/how-to-become-a-software-engineer` (fewer sections, a
different order, and for several components a genuinely different DOM shape) — every selector
replayed offline against both real pastes, not just the first one. Two components
(`industryInsightsTable`, `salaryByState`) are absent from the second article and so are still only
confirmed against one — see `become/article/fragile-legacy-selectors.md` for those, plus a residual
risk in `skillsRequirements`'s keyword-based classification and one still-open question (a
`resources` finding on the second article with no DOM to confirm it). The third tier,
`become/[slug]/[become-slug]` (sub-articles, ~5 components), is not yet mapped.

Everything else in `odyssey/src/app/[locale]/` is still unmapped. Inventory from a repo pass
(component counts are rough, from a quick read — re-verify against source when actually mapping):

| Route | Page type | ~Components | Notes |
|---|---|---|---|
| `/` (home) | Marketing landing | ~11 | HeroCarousel, Partners, TrendingBanner, CourseByTopic, Testimonials, Popular Topics/Subjects, banners |
| `about-us` (+ `[slug]`) | Company/marketing + 4 sub-pages via PAGE_MAP | ~10 | how-it-works, bundling, testimonials, products |
| `become/[slug]/[become-slug]` | Sub-article (3rd tier of the `become` hierarchy) | 5 | not yet mapped — see `become/article/` for the two tiers above it |
| `bio`, `bio/[...slug]` | Instructor marketing hub → profile page | 5 / 5 | |
| `certificate/[program-slug]` | Program detail | 1 | reuses `AccreditedProgramPage` template |
| `certificates`, `[subject]`, `professional-certificate` (+ `[...slug]`) | Cert hub → subject → cert-type hub → program detail | 9 / 7 / 7 / 1 | richest subject-hub content |
| `executive-education` (+ `[...slug]`) | B2B marketing hub → landing or cert detail | 10 / template | 2 templates |
| `googlecloud`, `professional-certificates`, `subject-areas` | Co-branded partner landing pages | 12 / 7 / 9 | distinct partner-brand template family |
| `contributor`, `contributor/[slug]` | Contributor directory → author bio | 2 / 4 | editorial pages |
| `resources`, `resources/[slug]` | Resource hub → article | 4 / 3 | blog/article-style CMS content |
| `school/[...slug]` | Org/partner school page (catch-all) | 3 | has a fallback state |
| `schools-partners` | Partner directory/collage | few | simple stats + logo grid |
| `xseries` (+ `[...slug]`) | XSeries hub → program detail | 4 / 1 | reuses `ProgramPage` template |
| `[...segments]` | CMS-driven marketing campaign catch-all | via `SegmentPageRenderer` | falls back to `SchoolContentFallback` when empty |
| `search` | Functional search/filter results | 8 | client-driven facets/pagination, not really "marketing content" |
| `(degrees)`: `bachelors`, `masters`, `doctorate` (+ `[...slug]`, `micro*` hubs) | Degree hub / program / subject-hub templates | 1-2 each | thin wrappers around shared `DegreeHubPage`/`AccreditedProgramPage`/`ProgramPage`/`DegreeSubjectHubPage` templates — likely map at the **template** level, not once per route |

**Suggested next targets** (highest distinct content value, ordered roughly by how different they
are from the `learn` family): finish `become/[slug]`'s legacy side and `become/[slug]/[become-slug]`,
then `about-us`, `bio` + `bio/[slug]`, `certificates` + `[subject]`, the `googlecloud` family,
`executive-education`, `contributor` + `contributor/[slug]`, `resources` + `resources/[slug]`,
`[...segments]` campaign pages, then the `(degrees)` templates (map the template once, since
bachelors/masters/doctorate share it).

**Exclude from mapping** — not real marketing content:
- `accessibility`, `edx-privacy-policy` (+ `cookies`), `edx-terms-service`,
  `modern-slavery-statement`, `policy/[slug]`, `trademarks` — all 7 render the same single
  `PolicyPageLayout`; one generic "legal/policy" template, not 7 distinct page types.
- `sitemap` — static-JSON navigation utility, no marketing components.
- `component-explorer`, `style-guide` — internal dev tooling, not real content.

This table is a snapshot from a repo pass, not a live source of truth — re-check component counts
and template reuse against the actual `page.tsx`/component source before mapping any of these,
the same way `learn`'s components were read from source rather than assumed.
