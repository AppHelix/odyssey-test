# Test Specifications Guide

This document describes exactly what each of the four validator steps is checking in order to pass or fail a target URL.

---

## 1. HTTP Status & Health
**File**: `validations/page-health.validator.ts`  
This check validates that pages load successfully, respond with correct status codes, and redirect to correct destinations if configured.

### Assertions Performed:
1. **Redirect Status Check (if status is 3xx)**:
   * Performs a raw HTTP GET request (without following redirects) using Playwright's `APIRequestContext` to avoid browser auto-redirection.
   * **Pass/Fail**: Asserts that the response status code matches the expected code (e.g., `301`, `302`).
2. **Location Header Presence (if status is 3xx)**:
   * Checks that the redirect response contains a defined `Location` header.
   * **Pass/Fail**: Fails if the `Location` header is missing.
3. **Redirect Location Correctness (if status is 3xx)**:
   * Resolves the returned `Location` path and the expected redirect URL relative to the target `baseURL`.
   * **Pass/Fail**: Asserts that the resolved location pathname matches the expected redirect path exactly.
4. **Standard Page Status Check (if status is non-3xx, e.g., 200)**:
   * Performs full browser navigation to the URL path using `page.goto()`.
   * **Pass/Fail**: Asserts that the loaded page response is not null (fails on network/load failures) and that the status code matches the expected status code (e.g., `200`).

---

## 2. SEO Metadata
**File**: `validations/seo.validator.ts`  
This check validates that required search engine optimization headers and social metadata tags are present, structured correctly, and contain non-empty content.

### Assertions Performed:
1. **Title Visibility & Content**:
   * Asserts that exactly one `<title>` element is present in the DOM (`toHaveCount(1)`).
   * **Pass/Fail**: Verifies the text content is not empty and, if configured, matches the specified RegExp or contains the substring pattern.
2. **Description Visibility & Content**:
   * Asserts that exactly one `<meta name="description">` element is present in the DOM (`toHaveCount(1)`).
   * **Pass/Fail**: Verifies the `content` attribute is not null, is not empty, and, if configured, matches the specified pattern.
3. **Canonical Link visibility & format**:
   * Asserts that exactly one `<link rel="canonical">` element is present in the DOM (`toHaveCount(1)`).
   * **Pass/Fail**: Verifies the `href` attribute is defined and not empty.
   * **Format Verification**: If format verification is enabled, asserts that the canonical `href` is a valid absolute URL (resolves with `new URL(href)`) and that its pathname matches the browser's current pathname.
4. **Robots Meta Tag**:
   * Asserts that exactly one `<meta name="robots">` tag exists (`toHaveCount(1)`).
   * **Pass/Fail**: If expected content is configured, asserts the `content` attribute matches it exactly (e.g., `"index, follow"`).
5. **Open Graph Metadata (og:*)**:
   * For each configured Open Graph tag (e.g., `og:title`, `og:description`, `og:url`, `og:image`):
     * Asserts the element `<meta property="{tag}">` exists in the DOM.
     * **Pass/Fail**: Verifies that the `content` attribute is defined, non-empty, and has a length greater than 0.
6. **Twitter Card Metadata (twitter:*)**:
   * For each configured Twitter card tag (e.g., `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`):
     * Asserts the element exists in the DOM as either `<meta name="{tag}">` or `<meta property="{tag}">`.
     * **Pass/Fail**: Verifies that the `content` attribute is defined and non-empty.

---

## 3. Header Functionality
**File**: `validations/header.validator.ts`  
This check validates that global navigation controls exist, are visible, and behave correctly under interaction.

### Assertions Performed:
1. **Header Container Visibility**:
   * Asserts that the `<header>` element is visible on the page.
2. **Navigation Visibility**:
   * Asserts that the navigation container (`header nav`) is visible on the page.
3. **Logo Visibility**:
   * Asserts that the logo container element (`header a.logo` or `header .logo-container`) is visible.
4. **Logo Image Loading**:
   * Asserts that the logo image `<img>` element is visible.
   * **Pass/Fail**: Evaluates browser-side properties `.complete` (boolean) and `.naturalWidth` (greater than 0) to ensure the logo image loaded successfully and is not a broken image.
5. **Logo URL Success**:
   * Queries the `src` attribute of the logo image.
   * **Pass/Fail**: Sends a direct API request to check if the image URL returns HTTP status code `200`.
6. **Mega Menu/Drawer Interactive Validation**:
   * Asserts the "Learn" button exists and is visible.
   * Simulates a mouse click on the button.
   * **Pass/Fail**: Asserts that the mega-menu drawer (`[data-testid='mega-menu']` or `.mega-menu-drawer`) becomes visible.
7. **Search Trigger & Input Focus Validation**:
   * Asserts the search trigger button is visible.
   * Simulates a mouse click on the trigger.
   * Asserts that the search modal/input becomes visible.
   * **Pass/Fail**: Asserts that the search input is focused (receives browser keyboard focus, `toBeFocused()`).

---

## 4. Footer Functionality
**File**: `validations/footer.validator.ts`  
This check validates footer structures, text parameters, language updates, and social link syntax.

### Assertions Performed:
1. **Footer Container Visibility**:
   * Asserts that the `<footer>` element is visible on the page.
2. **Footer Sections Visibility & Count**:
   * Locates footer links/navigation sections based on configuration selectors.
   * **Pass/Fail**: Asserts that the number of visible footer sections matches the expected count (default: `4`) and that each section is visible.
3. **Social Links Visibility & Syntax**:
   * Locates social link anchors inside the footer matching the expected domains.
   * Asserts that at least one social link is present.
   * **Pass/Fail**: For each link, verifies the `href` attribute is defined, is a syntactically valid absolute URL, and contains one of the configured expected domains (e.g. `linkedin.com`).
   * **External Verification**: If `checkExternalLinks` is set to `true`, performs a direct HTTP request to the link and asserts it returns status code `200`.
4. **Language Selector Interactive Validation**:
   * Asserts that the language selector select element is visible.
   * Asserts that the option matching the target test locale (e.g. `"es"`) is available.
   * Selects the locale from the dropdown.
   * Asserts the selector "Apply" button is visible and clicks it.
   * **Pass/Fail**: Asserts that the `lang` attribute on the page's root `<html>` element updates to the expected locale string.
5. **Copyright Year Check**:
   * Asserts that the copyright section is visible.
   * **Pass/Fail**: Asserts that the text content of the copyright contains the expected year (default: the current calendar year, e.g. `2026`).
6. **App Store & Play Store Links**:
   * Asserts that App Store and Play Store link anchors exist and are visible.
   * **Pass/Fail**: Verifies their target `href` links are defined and are syntactically valid URLs.
