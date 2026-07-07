# Excel Reporter Plan

> **Status: Implemented.** This document has been updated to describe the design that
> shipped, which refines the original sketch. See "What changed from the original plan"
> at the bottom for the rationale.

## Overview
The framework can emit its per-validator validation results as an **Excel workbook** in
addition to the original **Markdown** reports. The output format is selected at runtime via
the `REPORT_FORMAT` environment variable, so you can switch between Excel, Markdown, or both
without any code change.

The Excel workbook contains a **Summary** sheet plus one sheet per validator that ran. Each
validator sheet is a `URL × sub-test` matrix whose cells are `Pass` / `Fail` / `N/A`.

---

## Objectives
1. Generate an Excel workbook with:
   - A **Summary** sheet (URLs tested, passes, fails, pass-rate per validator).
   - One sheet per validator, with a `URL` column and one column per sub-test.
   - Rows representing each URL's result for every sub-test.
2. Let the user switch between Excel and Markdown output (or produce both).
3. Reuse the existing result-collection logic so the two formats never drift apart.
4. Clear error handling and logging.

---

## Architecture

Rather than a single standalone function, the reporter is a proper Playwright `Reporter`
that plugs into the test lifecycle. To avoid duplicating the (non-trivial) result-collection
logic across formats, collection lives in a shared base class and each format is a thin
subclass that only serializes.

```
tests/reporters/
├── report-data.ts         # Shared: constants + BaseValidationReporter + resolveReportData()
├── markdown-reporter.ts   # MarkdownValidationReporter (original .md output)
└── excel-reporter.ts      # ExcelValidationReporter (new .xlsx output)

tests/custom-reporter.ts   # Back-compat shim -> re-exports the Markdown reporter
```

- **`BaseValidationReporter`** implements `onStepEnd` to build the per-category
  (`validator`) → per-sub-test → `{passed, failed}` URL sets, and exposes
  `resolveReportData(): CategoryReport[]` — a format-agnostic, ordered view of the results
  (including the derived "Page Navigation & Loading" sub-test).
- **`MarkdownValidationReporter`** / **`ExcelValidationReporter`** subclass it and implement
  only `onEnd`.

Because both formats read from the same `resolveReportData()`, toggling a validator or a
semantic rule flows into every format automatically.

---

## Selecting the format

Set `REPORT_FORMAT` in `.env` (the config loads `.env` with `override: true`, so it is the
single source of truth — a shell variable would be overridden):

| `REPORT_FORMAT` | Output in `test-results/` |
| :--- | :--- |
| `md` *(default)* | `*-validation-report.md` (one per validator) |
| `excel` | `validation-report.xlsx` |
| `both` | both of the above |

`playwright.config.ts` reads the variable and pushes the matching reporter(s) into its
`reporter` array (the built-in `list` and `html` reporters always run too):

```typescript
const reportFormat = (process.env.REPORT_FORMAT || "md").trim().toLowerCase();
const wantMarkdown = reportFormat === "md" || reportFormat === "both";
const wantExcel = reportFormat === "excel" || reportFormat === "xlsx" || reportFormat === "both";
const customReporters: [string][] = [];
if (wantMarkdown) customReporters.push(["./tests/reporters/markdown-reporter.ts"]);
if (wantExcel) customReporters.push(["./tests/reporters/excel-reporter.ts"]);
if (customReporters.length === 0) customReporters.push(["./tests/reporters/markdown-reporter.ts"]);
```

---

## Excel workbook layout

### Summary sheet
| Validator | URLs Tested | Sub-tests | Passed | Failed | Pass Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| HTTP Status & Health | 4 | 2 | 4 | 0 | 100.0% |
| SEO Metadata | 3 | 7 | 10 | 11 | 47.6% |
| Semantic HTML Structure | 3 | 31 | 64 | 29 | 68.8% |

### Per-validator sheet (e.g. "SEO Metadata")
| URL | Page Title Tag | Meta Description Tag | ... | Page Navigation & Loading |
| :--- | :--- | :--- | :--- | :--- |
| / | Pass | Pass | ... | Pass |
| /semantic-bad | Pass | Fail | ... | Pass |

- **Cell colouring**: `Pass` green, `Fail` red, `N/A` grey.
- **`N/A`** means the sub-test did not apply to that URL (e.g. content checks are skipped for
  redirect URLs). Such URLs are omitted entirely from validators they never ran.
- **Frozen panes**: the header row and `URL` column stay visible while scrolling.
- **Auto-filter** on the header row.
- **Remediation guidance** for each sub-test is attached as a **cell note** on its header.
- Only validators that actually produced results get a sheet (no empty sheets).

---

## Setup and dependencies
- Library: [`exceljs`](https://www.npmjs.com/package/exceljs) (added to `dependencies`).
  ```bash
  npm install exceljs
  ```

---

## Error handling
- The workbook write is wrapped in `try/catch`; a failure is logged and the run continues.
- Worksheet names are sanitized (Excel's 31-char limit and forbidden characters).
- Missing per-URL results default to `N/A`.
- **Cleanup safety**: both reporters clean transient files from `test-results/` but preserve
  a shared `KNOWN_REPORT_FILES` allow-list (all Markdown reports **and** the workbook), so
  `REPORT_FORMAT=both` is order-independent and never deletes the other format's output.

---

## File locations
- `tests/reporters/report-data.ts` — shared base + constants
- `tests/reporters/markdown-reporter.ts` — Markdown reporter
- `tests/reporters/excel-reporter.ts` — Excel reporter
- Output: `test-results/validation-report.xlsx`

---

## What changed from the original plan
| Original sketch | Shipped design | Why |
| :--- | :--- | :--- |
| Standalone `generateExcelReport()` in `custom_report.ts` | A Playwright `Reporter` subclass | It must hook the test lifecycle to collect live results, not accept hand-built arrays. |
| Excel logic owns its own data shape | Shared `BaseValidationReporter` feeds both formats | Keeps Markdown and Excel perfectly in sync; no duplicated collection logic. |
| One file, always Excel | `REPORT_FORMAT` switch (`md`/`excel`/`both`) | The requested ability to switch between Excel and Markdown output. |
| Plain Pass/Fail cells, no summary | Summary sheet, colour-coding, frozen panes, filters, remediation notes | Makes the workbook genuinely useful at a glance. |
| Fixed `validators`/`urls`/`results` inputs | Derived from the live validator/rule registry | New/removed validators and rules appear automatically. |
