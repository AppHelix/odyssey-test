# Implementation Plan: Request-Only Page Health Optimization

This plan is deferred for future implementation.

## Proposed Optimization

When the framework is configured to run **only** the `health` validator, it will bypass browser spawning and `page.goto()` navigation entirely. Instead, it will use lightweight direct HTTP requests via Playwright's `APIRequestContext` (`request.get`).

---

## Deep Thinking: Advantages and Drawbacks

### Advantages

1. **Massive Speed & Performance Improvements**
   - **No Browser Overhead**: `page.goto()` launches a full Chromium tab, downloads sub-resources (images, stylesheets, fonts), parses the DOM, compiles scripts, and renders layouts. Direct HTTP requests (`request.get()`) only execute network requests, bypassing browser rendering.
   - **Parallelization & Execution Time**: Direct HTTP validation for 100+ pages (e.g. from sitemaps) runs in seconds rather than minutes, allowing fast smoke testing.
2. **Minimal CPU and RAM Consumption**
   - Spawning browser processes is resource-heavy. In CI/CD container environments (e.g. GitHub Actions), browser-less tests use negligible resources and prevent runner thrashing.
3. **Reduced Test Flakiness**
   - Browser navigation can fail due to external factors (heavy tracking scripts, font CDN timeouts, local Javascript hydration issues). HTTP status checks focus purely on backend server health, routing rules, and redirect patterns.
4. **No Browser Process Allocation**
   - By structuring tests to only consume the `{ request }` fixture (and omit `{ page }`), Playwright does not allocate a browser instance for the test, ensuring 100% browser-less execution.

### Drawbacks

1. **Misses Hydration and Client-Side Failures**
   - If a React component throws a fatal exception during client-side hydration (causing a "White Screen of Death"), the server still returns an HTTP `200 OK` header. Direct HTTP request validation will mark this page as "Healthy", whereas `page.goto()` would report console errors or empty page text content.
2. **SPA Client-Side Routing Discrepancies**
   - Single-Page Applications (SPAs) often return a catch-all `index.html` (HTTP `200 OK`) and perform path checking on the frontend. If a path is invalid, the client-side router redirects to a mock `/404` page. An HTTP request-based check will report `200 OK`, masking the broken route.
3. **No Client-Side JavaScript Redirect Evaluation**
   - Redirects performed via client-side scripts (`window.location.href`) or `<meta http-equiv="refresh">` tags will not be detected since HTTP GET only tracks standard HTTP `3xx Location` response headers.
4. **Session / Client-Side State Limitations**
   - If page health requires custom client-side cookie evaluation or token injection via localStorage, raw HTTP requests will bypass these mechanisms unless custom authorization headers are manually passed to the request context.

---

## Proposed Changes

We will modify the test runner to compile different test cases based on whether `health` is the **only** active validator.

### [tests/page-validation.spec.ts](file:///d:/Users/pnangalia/Desktop/odyssey-test/tests/page-validation.spec.ts)

1. Check if the framework is running in "health-only" mode:
   ```typescript
   const enabledValidators = pageValidationService.getEnabledValidators();
   const isHealthOnly = enabledValidators.length === 1 && enabledValidators[0].type === "health";
   ```
2. Conditionally define the test blocks:
   - **If `isHealthOnly` is `true`**:
     - Declare tests requesting only `{ request, baseURL }`.
     - Perform status code and redirect checks using `verifyHttpStatus(request, ...)` directly.
     - This avoids launching any browser processes.
   - **If `isHealthOnly` is `false`**:
     - Declare standard browser tests requesting `{ page, request, baseURL }`.
     - Execute the full sequential validator pipeline. If `health` is active, it runs its navigation-based check (`page.goto`), which then warms the page cache for subsequent SEO, Header, and Footer validations.
