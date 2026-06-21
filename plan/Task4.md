# Task 4: Sitemap Logic & Dynamic Runner

- [ ] Implement sitemap fetching logic in `validation-framework/utils/network.ts` to request `/sitemap.xml`.
- [ ] Parse sitemap XML payload using regular expressions to extract `<loc>` URLs.
- [ ] Implement mapping to rewrite sitemap absolute URLs (e.g. on `www.edx.org`) to the local Playwright `baseURL` for local testing.
- [ ] Update `validation-framework/tests/page-validation.spec.ts` test runner to:
  - Dynamically detect config setting `useSitemap`.
  - Fetch URLs from sitemap if `useSitemap` is `true`.
  - Dynamically set up Playwright test suites/cases for all routes, applying global defaults.
- [ ] Document the framework usage, design, and guide on how to extend the framework with new checks.
- [ ] Run full test suite using `npx playwright test` to confirm both sitemap mode and manual mode function flawlessly.
