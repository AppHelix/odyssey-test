# Comprehensive Error Reporting Plan

This document outlines the design and implementation plan for introducing failure-tolerant, granular error reporting inside the Standalone Page Validation Framework.

---

## 1. Goal
Currently, when a validation step (such as an SEO tag check) fails, the entire test execution for that URL stops immediately. Subsequent categories (like Header and Footer checks) are skipped, and the test report does not detail which individual checks passed or failed.

**Objective**:
1. Run each URL as a single, expandable test block in the Playwright report.
2. Group checks into the 4 subcategories: `HTTP Status & Health`, `SEO Metadata`, `Header Functionality`, and `Footer Functionality`.
3. Under each subcategory, execute **all** active sub-validations (e.g. title, description, canonical link, logo visibility, copyright year).
4. Do not skip subsequent sub-validations or categories if one fails; instead, record the failure and continue execution.
5. Create a standalone, structured Markdown execution report (`test-results/validation-report.md`) at the end of each run showing all passed and failed checks.

---

## 2. Technical Architecture

```text
+------------------+       onStepEnd()       +--------------------------+
| Playwright Test  | ----------------------> |  Custom Playwright       |
| spec.ts          |                         |  Reporter (onEnd())      |
+------------------+                         +--------------------------+
         |                                                 |
         v                                                 v
  +--------------+                               +--------------------+
  | Validator.ts | (expect.soft)                 | validation-        |
  | sub-steps    |                               | report.md          |
  +--------------+                               +--------------------+
```

### A. Sub-Check Execution with `test.step` & `expect.soft`
Each validator file is already modularized and uses registry mappings (e.g., `SEO_CHECK_REGISTRY`). We will refactor each validator's main loop to execute each sub-check inside its own nested Playwright `test.step`. By catching errors inside the step and invoking `expect.soft()`, we prevent test termination while marking the specific sub-step as failed.

### B. Custom Playwright Reporter
We will create a custom Playwright reporter at `tests/custom-reporter.ts` implementing Playwright's `Reporter` interface. It will:
*   Track steps via `onStepBegin()` and `onStepEnd()`.
*   Maintain a mapping of `URL` -> `Category` -> `Sub-Check` (Name, Status, and Error message).
*   On test run completion (`onEnd()`), format the collected data into a clean, markdown file at `test-results/validation-report.md`.

---

## 3. Step-by-Step Implementation Details

### Step 1: Update Validator Loop Templates
For all 4 validator files (`page-health.validator.ts`, `seo.validator.ts`, `header.validator.ts`, `footer.validator.ts`), refactor the loops to invoke `test.step` for each active check.

*Template*:
```typescript
import { test, expect } from "@playwright/test";

// Inside validate method:
for (const checkType of ACTIVE_CHECKS) {
  const check = CHECK_REGISTRY[checkType];
  if (check) {
    await test.step(check.name, async () => {
      try {
        await check.validate(...);
      } catch (err: any) {
        expect.soft(true, `Sub-check failed: ${err.message || String(err)}`).toBe(false);
      }
    });
  }
}
```

### Step 2: Implement the Custom Reporter
Create `tests/custom-reporter.ts` to build a hierarchically structured log:

```typescript
import { Reporter, TestCase, TestResult, TestStep, FullResult } from "@playwright/test/reporter";
import fs from "fs";
import path from "path";

export default class CustomValidationReporter implements Reporter {
  // Structure to hold results:
  // URL -> Category -> SubChecks list
  private urlResults: Map<string, {
    status: 'passed' | 'failed';
    categories: Map<string, {
      status: 'passed' | 'failed';
      steps: { name: string; status: 'passed' | 'failed'; error?: string }[];
    }>;
  }> = new Map();

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    // 1. Identify URL from test title
    const url = test.title;
    
    // 2. Identify Category (top-level step parent of this step, or this step itself)
    // 3. Record sub-checks and pass/fail/error strings
  }

  async onEnd(result: FullResult) {
    // Generate Markdown representation
    // Write output to test-results/validation-report.md
  }
}
```

### Step 3: Register Custom Reporter in config
Update `playwright.config.ts` to include the custom reporter alongside the standard HTML reporter:
```typescript
  reporter: [
    ['html'],
    ['./tests/custom-reporter.ts']
  ],
```

---

## 4. Expected Output Format
The resulting file at `test-results/validation-report.md` will list:
1. Overall run status.
2. Sections for each URL tested.
3. Subsections for each category (Health, SEO, Header, Footer) along with their status.
4. Bullet lists for all sub-checks, marked with `[✓]` (Passed) or `[✗]` (Failed, including the exact error reason).
