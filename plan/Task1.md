# Task 1: Core Framework Setup & Page Health Validation

- [ ] Create standalone configurations in `validation-framework/`:
  - `package.json`
  - `tsconfig.json`
  - `playwright.config.ts`
- [ ] Create `validation-framework/config/page-validation.config.ts` defining types and default configuration values.
- [ ] Create `validation-framework/utils/network.ts` to manage URL validation and HTTP status code verification using Playwright API Request context.
- [ ] Create `validation-framework/pages/HomePage.ts` page object with base selectors and initial methods.
- [ ] Create `validation-framework/validations/page-health.validator.ts` verifying expected status codes (handling redirects specifically).
- [ ] Create initial test runner `validation-framework/tests/page-validation.spec.ts` integrating Page Health validation for configured manual URLs.
- [ ] Verify that basic page health checks pass successfully using Playwright.
