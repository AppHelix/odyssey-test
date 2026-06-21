# Configurable Standalone Page Validation Framework

Create a standalone, configurable Playwright-based validation framework within the workspace folder `validation-framework/` that runs independently of the main app's test setup. It validates page health (HTTP status), SEO metadata, header functionality, and footer structure and interactions.

The framework supports toggling between manually configured test endpoints and dynamically discovered endpoints fetched from the website's `sitemap.xml`.

## User Review Required

> [!IMPORTANT]
> **Standalone Architecture**
> The testing framework is placed under `validation-framework/` in the workspace root. It has its own:
> - `package.json`
> - `playwright.config.ts`
> - `tsconfig.json`
> This avoids polluting the main app dependencies and configurations.
>
>
> **Avoid Flaky Third-Party Network Calls**
> Testing links to major social networks (e.g., LinkedIn, Facebook, Reddit, X) from a headless CI browser frequently triggers rate limits, IP blocks, or CAPTCHAs. To address this, we:
> 1. Validate the syntax of the URLs using `new URL()`.
> 2. Ensure they contain the expected domains.
> 3. Provide a configuration toggle `checkExternalLinks` (default: `false` to prevent CI failures, but set to `true` on demand) to verify HTTP response statuses of external links. Internal links will always be verified for HTTP response status.
>
> **Dynamic Sitemap Resolving**
> If `useSitemap` is toggled on:
> 1. Playwright will fetch the local `/sitemap.xml` endpoint.
> 2. We extract all `<loc>` elements using robust regex.
> 3. We rewrite the hostnames to the current `baseURL` (e.g. `http://localhost:3000`) so the local site is verified.
> 4. We apply global configurations/defaults to all pages found.

## Open Questions

None at this time.

## Proposed Changes

We will introduce a set of modular components under the `validation-framework/` directory:

---

### Framework Configurations

#### [NEW] [package.json](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/package.json)
Independent npm package configuration with dependencies on `@playwright/test` and `typescript`.

#### [NEW] [playwright.config.ts](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/playwright.config.ts)
Independent Playwright configuration matching tests in `validation-framework/tests/**/*.spec.ts`.

#### [NEW] [tsconfig.json](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/tsconfig.json)
Independent TypeScript compiler options and path aliases.

---

### Configuration & Types

#### [NEW] [page-validation.config.ts](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/config/page-validation.config.ts)
Defines TypeScript interfaces and exports configuration settings, supporting:
- Toggling between `useSitemap: true` and `useSitemap: false`.
- Custom list of manual URLs (if sitemap is disabled).
- Global defaults for SEO requirements, header validations, and footer validations.

---

### Page Objects & Helpers

#### [NEW] [HomePage.ts](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/pages/HomePage.ts)
A Playwright page object encapsulating header, search, navigation, and footer selectors and actions.

#### [NEW] [network.ts](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/utils/network.ts)
Helper to check if link URLs are valid and to perform HTTP requests (using Playwright's `request` API) to verify response status.

---

### Validators

#### [NEW] [page-health.validator.ts](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/validations/page-health.validator.ts)
Validates that pages return the expected HTTP status. Specifically handles redirects by using direct network requests if expecting 3xx, preventing standard `page.goto` redirection from obfuscating the redirect response.

#### [NEW] [seo.validator.ts](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/validations/seo.validator.ts)
Validates `<head>` tags:
- `<title>`
- `<meta name="description">`
- `<link rel="canonical">`
- `<meta name="robots">`
- Open Graph (`og:*`) tags
- Twitter (`twitter:*`) tags

#### [NEW] [header.validator.ts](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/validations/header.validator.ts)
Verifies:
- Header is rendered.
- Navigation elements exist.
- Logo is visible, image loads successfully (evaluates image `complete` property), and logo URL returns 200.
- "Learn" button triggers the mega-menu popover.
- Search button triggers search modal/input and focuses the search input.

#### [NEW] [footer.validator.ts](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/validations/footer.validator.ts)
Verifies:
- Footer is rendered.
- Configured footer sections (headers and lists) are visible.
- Social links exist, match expected domains, and are valid.
- Language selector opens, options exist, and selecting a language and clicking "Apply" successfully redirects or modifies page language.
- Copyright section contains current year.
- Mobile store links (App Store and Play Store) exist and are valid.

---

### Test Runner

#### [NEW] [page-validation.spec.ts](file:///d:/Users/pnangalia/Desktop/2U/odyssey/validation-framework/tests/page-validation.spec.ts)
The main E2E test file that imports the configuration, dynamically pulls URLs from sitemap or configuration, and executes test suites.

## Phased Execution Plan (4 Tasks)

We will execute this implementation step-by-step:
1. **Task 1: Core Framework and Page Health** - Setup framework architecture, config files, type definitions, network helper, and Page Health validator.
2. **Task 2: SEO Validator** - Implement `<head>`, title, description, canonical, robots, OG, and Twitter validation rules.
3. **Task 3: Header & Footer Validators** - Implement header validations (logo load, navigation, learn drawer, search focus) and footer validations (sections, social links, language selector, copyright year, mobile store links).
4. **Task 4: Sitemap Logic and Dynamic Runner** - Implement sitemap fetching, regex parsing, local URL mapping, and finalize `page-validation.spec.ts` test runner supporting both sitemap and manual url modes.

## Verification Plan

### Automated Tests
Run the newly created validations test suite:
```bash
cd validation-framework
npx playwright test
```
