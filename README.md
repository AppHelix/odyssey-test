# Standalone Page Validation Framework

A configurable, standalone Playwright-based validation framework for verifying page health, SEO metadata, header, and footer functionality across target websites.

---

## 📂 Project Structure

```text
validation-framework/
├── config/
│   ├── page-validation.config.ts  # TypeScript interfaces and default configurations
│   ├── urls.json                  # Manual URL list (used when USE_SITEMAP=false) — entries can
│   │                               # be a plain string OR { url, expectedStatus?, expectedRedirectUrl? }.
│   │                               # Every URL is ALSO auto-checked against MAP_REGISTRY (via
│   │                               # resolvePageType() in comparison/mappings/registry.ts); any URL
│   │                               # matching a registered pageType pattern is picked up by the
│   │                               # content-comparison suite (npm run test:compare) automatically —
│   │                               # nothing to annotate per-entry
│   └── sitemap-urls.json          # Cached sitemap URLs (auto-generated at runtime)
├── docs/
│   ├── architecture-guide.md      # Layer-by-layer file reference
│   ├── functionality-guide.md     # Usage scenarios, execution flow, and extension guide
│   └── test-specifications.md     # Detailed per-validator assertion specifications
├── pages/
│   └── HomePage.ts                # Page Object Model encapsulating DOM selectors
├── services/
│   └── page-validation.service.ts # Central orchestrator and validator registry
├── tests/
│   ├── global-setup.ts            # Pre-test sitemap fetcher and port coordinator
│   ├── mock-server.js             # Zero-dependency local HTTP server for offline testing
│   └── page-validation.spec.ts    # Main Playwright E2E test runner
├── utils/
│   └── network.ts                 # HTTP helpers, URL validation, and sitemap parser
├── validations/
│   ├── page-health.validator.ts   # HTTP status codes and redirect location checks
│   ├── seo.validator.ts           # HTML meta tags, Open Graph, and Twitter Card checks
│   ├── header.validator.ts        # Logo, navigation, mega-menu, and search checks
│   ├── footer.validator.ts        # Footer sections, social links, locale, and copyright checks
│   └── semantic.validator.ts      # Deterministic semantic-HTML structure & accessibility checks
├── .env                           # Environment configuration (BASE_URL, USE_SITEMAP, etc.)
├── package.json                   # NPM package and scripts
├── playwright.config.ts           # Playwright runner settings
└── tsconfig.json                  # TypeScript compiler configuration
```

---

## 🚀 Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (bundled with Node.js)

### 1. Install Dependencies

Navigate to the `validation-framework/` directory and install packages:

```bash
cd validation-framework
npm install
```

### 2. Install Playwright Browser Binaries

Install the Chromium browser binary required for test execution:

```bash
npx playwright install chromium
```

### 3. Configure Environment Variables

Copy or edit the `.env` file at the root of `validation-framework/`. See the [Environment Configuration](#️-environment-configuration) section below for all available options.

### 4. Run the Tests

```bash
npm test
```

To open the interactive Playwright UI:

```bash
npm run test:ui
```

To view the HTML report after a test run:

```bash
npm run test:report
```

---

## 📊 Reports

Beyond Playwright's built-in `list` and `html` reporters, the framework emits its own
per-validator validation reports into `test-results/`. Choose the format with the
`REPORT_FORMAT` variable in `.env`:

| `REPORT_FORMAT` | Output in `test-results/` | Notes |
| :--- | :--- | :--- |
| `md` *(default)* | `health-`, `seo-`, `header-`, `footer-`, `semantic-validation-report.md` | One Markdown file per validator; lists failed/passed URLs + remediation per sub-test |
| `excel` | `validation-report.xlsx` | One workbook: a **Summary** sheet plus one sheet per validator that ran |
| `both` | all of the above | Emits Markdown and Excel together |

The Excel workbook is a `URL × sub-test` matrix per validator:

- Each validator gets its own sheet; rows are URLs, columns are sub-tests.
- Cells are colour-coded **Pass** (green) / **Fail** (red) / **N/A** (grey — the sub-test
  didn't apply to that URL, e.g. content checks skipped for a redirect).
- The header row is frozen and filterable; each sub-test header carries its **remediation
  guidance as a cell note** (hover to read).
- The **Summary** sheet totals URLs tested, passes, fails, and pass-rate per validator.

Both formats are driven by the same collected results, so they always agree. Adding,
removing, or toggling a validator or semantic rule flows into every format automatically.

> Switching format is a `.env` change (like `ACTIVE_VALIDATORS`): the config loads `.env`
> with `override: true`, so it is the single source of truth — set `REPORT_FORMAT` there
> rather than as a shell variable.

**Implementation** (`tests/reporters/`): a shared `BaseValidationReporter`
(`report-data.ts`) collects the pass/fail matrix from test steps; `markdown-reporter.ts`
and `excel-reporter.ts` subclass it to serialize each format. `playwright.config.ts`
selects the active reporter(s) from `REPORT_FORMAT`.

---

## ⚙️ Environment Configuration

All runtime behavior is controlled via the `.env` file in the framework root:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `BASE_URL` | `http://localhost:3001` | Target website URL (e.g., `https://odyssey.stage.edx.org/`) |
| `USE_SITEMAP` | `false` | `true` to discover URLs from sitemap; `false` to use `config/urls.json` |
| `SITEMAP_PATH` | `/sitemap.xml` | Path to the sitemap endpoint, relative to `BASE_URL` |
| `URLS_FILE` | `config/urls.json` | Path to the manual URL list file (used when `USE_SITEMAP=false`) |
| `ACTIVE_VALIDATORS` | `health,seo,header,footer,semantic` | Comma-separated list of validators to enable |
| `REPORT_FORMAT` | `md` | Custom report format: `md`, `excel`, or `both` (see [Reports](#-reports)) |

### Example `.env`

```ini
BASE_URL=https://odyssey.stage.edx.org/
USE_SITEMAP=true
SITEMAP_PATH=/sitemap.xml
ACTIVE_VALIDATORS=health,seo,header,footer,semantic
REPORT_FORMAT=md
```

---

## 🛡️ Validators

The framework runs the enabled validation layers sequentially per page. Each layer can be independently toggled via `ACTIVE_VALIDATORS`:

| Validator | Key | File |
| :--- | :--- | :--- |
| HTTP Status & Health | `health` | `validations/page-health.validator.ts` |
| SEO Metadata | `seo` | `validations/seo.validator.ts` |
| Header Functionality | `header` | `validations/header.validator.ts` |
| Footer Functionality | `footer` | `validations/footer.validator.ts` |
| Semantic HTML Structure | `semantic` | `validations/semantic.validator.ts` |

> Redirect pages (3xx) only run the `health` validator — content checks are automatically skipped.

### Semantic HTML Structure validator

A **deterministic** (no LLM) validator that checks whether the rendered markup is semantically well-formed and accessibility-friendly. It is configured under `semanticDefaults` in `config/page-validation.config.ts`; every sub-check has a `required` gate and per-rule boolean toggles, and per-URL overrides are supported via a `semantic` block on manual URL entries. Sub-checks:

| Sub-check | What it validates |
| :--- | :--- |
| Document Structure | `<!DOCTYPE html>`, valid `<html lang>`, single non-empty `<title>`, `<meta charset>` + `<meta name="viewport">` |
| Heading Hierarchy Structure | Exactly one `<h1>`, no skipped heading levels, no empty headings |
| Landmark Regions | Presence of `main`/`nav`/`banner`/`contentinfo`, single `main`, distinct names for duplicate landmarks |
| Image & Media Alternatives | `<img>` alt text (decorative `alt=""` allowed, no filename alt), `<iframe>` titles |
| Link Integrity | Discernible link text, no href-less anchors, `rel="noopener"` on `target="_blank"` |
| Form Control Labels | Every input/select/textarea has an accessible name (auto-skips pages with no controls) |
| Table Semantics | Data tables use `<th>` + scope/`headers=` associations (auto-skips pages with no tables) |
| ARIA & ID Integrity | Unique ids, valid roles, resolvable aria references, no aria-hidden focusables, no positive tabindex |
| Interactive & List Markup | `<li>` nesting, no nested interactive elements, focusable `role="button"`, named buttons |

Some stricter rules ship **disabled by default** to avoid false positives (e.g. `requireContentInLandmarks`, `requireSvgAccessibleName`, `disallowAmbiguousText`, `noRedundantRoles`); enable them in config as needed.

**Three-level registry (validator → section → rule).** The nine rows above are *sections*; each section contains individually toggleable *rules* (e.g. the `headings` section holds `requireH1`, `requireSingleH1`, `enforceNoSkippedLevels`, `disallowEmptyHeadings`). Both the **section list** and the **rules** live in one place — `SEMANTIC_SECTION_REGISTRY` in `validations/semantic.validator.ts` — which is the single source of truth. The section-key type, the full section list, the `ACTIVE_SEMANTIC_CHECKS` env validation, and the report rows + remediation are all *derived* from that registry, so add/remove/toggle flows through automatically.

- **Toggle a whole section** via the `ACTIVE_SEMANTIC_CHECKS` env var (comma-separated, case-insensitive; defaults to all):
  ```ini
  # Run only the heading, landmark, and ARIA/ID sections
  ACTIVE_SEMANTIC_CHECKS=headings,landmarks,ariaIntegrity
  ```
- **Toggle an individual rule** by flipping its boolean flag in `semanticDefaults` (`config/page-validation.config.ts`), or per-URL via a `semantic` override. Disabled rules disappear from both the run and the report.
- **Add a new rule**: push an entry (`{ key, name, remediation, enabled, evaluate }`) onto that section's `rules` array in the registry (and add its flag to the section's config). It runs and appears in the report automatically.
- **Add / remove a whole section**: add or delete one entry in `SEMANTIC_SECTION_REGISTRY` (validator). The section-key type and list update automatically. When adding, also add its config *shape* + `semanticDefaults` block in `config/page-validation.config.ts` (per-section defaults naturally live in config); when removing, its now-unused defaults can be deleted.

**Try it offline:** the mock server exposes `/semantic-good` (passes every default-on rule) and `/semantic-bad` (violates them). Run with `BASE_URL=http://localhost:3001`, `USE_SITEMAP=false`, `URLS_FILE=config/semantic-verify-urls.json`, `ACTIVE_VALIDATORS=semantic`.

---

## 📖 Documentation

| Document | Description |
| :--- | :--- |
| [architecture-guide.md](docs/architecture-guide.md) | Layer-by-layer breakdown of all files and their roles |
| [test-specifications.md](docs/test-specifications.md) | Detailed assertion specifications for each validator |
| [functionality-guide.md](docs/functionality-guide.md) | Usage scenarios, execution flow diagram, and extension guide |

---

## 🧪 Running Specific Validators

Disable validators at runtime by editing `ACTIVE_VALIDATORS` in `.env`:

```ini
# Run only health and SEO checks
ACTIVE_VALIDATORS=health,seo
```

---

## 🔀 Content Comparison (Legacy vs Odyssey)

A separate suite compares the **semantic content** of equivalent pages between the **legacy
production site** (`www.edx.org`) and the **Odyssey revamp** (`odyssey.stage.edx.org`). The two
DOMs are structurally unrelated, so it does **not** diff HTML. Instead it breaks each page into
**logical components** (Hero, Rich Text, Card Grid, FAQ…), extracts and normalizes each
component's text, and diffs the normalized content — flagging **missing / extra / modified**
content per field.

Run it with its own command (separate from `npm test`, since each test loads two origins):

```bash
npm run test:compare
```

### Architecture — three layers

```
comparison/
├── engine/        # GENERIC — no page/selector knowledge
│   ├── types.ts        # NormalizedComponent, FieldDiff, ComponentDiff, PageDiff, ParityStatus
│   ├── normalize.ts    # text normalization (whitespace, smart quotes/dashes, nbsp)
│   ├── similarity.ts   # fuzzy similarity + inline diff (fast-diff)
│   ├── extractor.ts    # ComponentSelectorSet + Page -> NormalizedComponent
│   └── compare.ts      # NormalizedComponent x NormalizedComponent -> ComponentDiff
├── mappings/      # THE ONLY page-/selector-aware layer
│   ├── types.ts             # FieldSpec, ComponentSelectorSet, ComponentMapping, PageComparisonMap
│   ├── presets.ts           # reusable Odyssey field-spec presets (hero, richText, faq, cardGrid)
│   ├── heading-region.ts    # shared ComponentSelectorSet adapter for heading-anchored regions
│   ├── registry.ts          # MAP_REGISTRY: pageType -> PageComparisonMap; also exports
│   │                        # resolvePageType(url), which auto-matches a URL's path shape
│   │                        # against these keys (no per-URL annotation needed)
│   ├── workflow.md          # step-by-step process for mapping a new page type
│   └── learn/               # pageType "learn" (/learn hub) — sub-pages nest inside it
│       ├── learn.map.ts
│       ├── legacy-dom-input-learn.md   # blank placeholder .md, filled in by hand with pasted DOM
│       ├── course/          # pageType "learn/[slug]" (e.g. /learn/blender)
│       │   ├── learn-course.map.ts
│       │   └── legacy-dom-input-learn-course.md
│       └── deep/            # pageType "learn/[slug]/[slug2]" (course detail)
│           ├── learn-deep.map.ts
│           └── legacy-dom-input-learn-deep.md
└── comparison.config.ts      # two base URLs + threshold, loaded from .env
config/urls.json  # legacy<->odyssey path pairs to compare live here too — any URL whose path
                  # shape matches a MAP_REGISTRY pattern is auto-picked up (see the config/ tree above)
tests-compare/content-comparison.spec.ts   # loads both origins, runs the engine, attaches PageDiff
tests/reporters/comparison-reporter.ts      # detailed parity report (Markdown + Excel)
```

The **engine is generic**: it only ever sees `NormalizedComponent` data and knows nothing about
pages, sites, or selectors. All variability lives in the mapping files' selector strings.

### Defining selectors per page type

Each page type has one `PageComparisonMap`. Every logical component declares how to extract it
from **each** site. Odyssey selectors are derived from the Odyssey codebase; **legacy selectors
are authored by hand** (only you have the domain knowledge for the legacy DOM). Until a legacy
slot is filled it stays `null`, and that component reports as **`unmapped` (N/A)** — excluded from
the parity score.

```ts
// comparison/mappings/learn/course/learn-course.map.ts
{
  type: "faq",
  label: "FAQ",
  odyssey: { root: "#faq, [data-slot='accordion']", fields: faqFields() },
  legacy: null, // LEGACY TODO: fill { root, fields } for the www.edx.org FAQ
}
```

To fill a legacy slot, replace `null` with a `ComponentSelectorSet` and keep field `name`s
identical to the odyssey side so they line up:

```ts
legacy: {
  root: ".legacy-faq",
  fields: [
    { name: "heading", selector: "h2", kind: "text", optional: true },
    { name: "items", selector: ".faq-row", kind: "list", itemFields: [
      { name: "question", selector: ".q", kind: "text" },
      { name: "answer",   selector: ".a", kind: "text" },
    ]},
  ],
}
```

A `FieldSpec` is `{ name, selector, kind: "text" | "list", itemFields?, optional? }`, where
`selector` is relative to the component root (use `:scope` for the root itself). For extraction
that declarative selectors can't express, a `ComponentSelectorSet` may supply an `extract(root)`
escape hatch.

**Add a new page type**: see `comparison/mappings/workflow.md` for the full step-by-step process.
In short — create `comparison/mappings/<page>/`, author `<page>.map.ts` (odyssey side from the
Odyssey codebase, legacy side `null`) plus a blank `legacy-dom-input-<page>.md` placeholder for the
legacy DOM to be pasted into later, register the map in `MAP_REGISTRY`
(`comparison/mappings/registry.ts`), and make sure the page's URL(s) are present in
`config/urls.json` — `resolvePageType()` matches them to the new pattern automatically.

### Configuration (`.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ODYSSEY_BASE_URL` | `BASE_URL` → `https://odyssey.stage.edx.org` | Odyssey origin |
| `LEGACY_BASE_URL` | `https://www.edx.org` | Legacy origin to compare against |
| `MATCH_THRESHOLD` | `0.95` | Similarity (0–1) at/above which two texts count as a match |
| `COMPARE_IGNORE_CASE` | `true` | Compare case-insensitively |
| `REPORT_FORMAT` | `both` | `md`, `excel`, or `both` (reuses the framework's report switch) |

URL pairs are NOT a separate file — they're entries in `config/urls.json` (the same file
`URLS_FILE` points the page-validation suite at), and there's nothing to annotate per entry.
Every URL's path is checked against `MAP_REGISTRY`'s pattern keys via `resolvePageType()`
(`comparison/mappings/registry.ts`); a URL whose shape matches a registered pattern (e.g.
`/learn/blender` matching `"learn/[slug]"`) is automatically picked up as a legacy↔odyssey pair to
compare, using the same path on both origins. Anything that doesn't match a pattern is
validator-only:

```json
[
  "/about-us",
  "/learn/blender"
]
```

### Parity report

Written to `test-results/comparison-parity-report.md` / `.xlsx`. A **Summary** lists per-page
parity % and counts of match / modified / missing / extra / unmapped; per-page detail shows, for
each component and field (and nested list items), the status, similarity, legacy vs odyssey text,
and an inline word-level diff. Statuses are colour-coded in Excel (green match, amber modified,
red missing, blue extra, grey unmapped).

### Self-test

`npm run test:validators` also runs `tests-selftest/comparison-selftest.spec.ts`: deterministic,
offline engine cases plus a mock-fixture test proving that **structurally-unrelated DOMs with the
same content reach parity** (`/compare/legacy-sample` vs `/compare/odyssey-sample`).

---

## 📦 Dependencies

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `@playwright/test` | `^1.58.2` | E2E test runner and browser automation |
| `dotenv` | `^17.4.2` | Environment variable loading |
| `exceljs` | `^4.4.0` | Excel report generation (validation + comparison) |
| `fast-diff` | `^1.3.0` | Fuzzy similarity + inline diffs (content comparison) |
| `typescript` | `^5.0.0` | TypeScript compilation (dev) |
