# Task 2: SEO Validator

- [ ] Create `validation-framework/validations/seo.validator.ts` containing rules and logic to inspect the HTML `<head>`.
- [ ] Implement validations for:
  - `<title>` (presence, non-emptiness, and exact or pattern match).
  - `<meta name="description">` (presence and non-emptiness/regex match).
  - `<link rel="canonical">` (presence, format, and correctness).
  - `<meta name="robots">` (presence and correctness).
  - Open Graph (`og:*`) tags.
  - Twitter (`twitter:*`) tags.
- [ ] Ensure validators return meaningful detailed failure messages on check failures.
- [ ] Integrate SEO validation into the main test runner `validation-framework/tests/page-validation.spec.ts`.
- [ ] Run and verify SEO validations pass on configured pages.
