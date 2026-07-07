// Backward-compatibility shim. The reporter implementations now live under tests/reporters/:
//   - Markdown (the original per-category .md reports) -> reporters/markdown-reporter.ts
//   - Excel workbook                                   -> reporters/excel-reporter.ts
// Both share the collection logic in reporters/report-data.ts. Reporter selection is driven
// by the REPORT_FORMAT env var in playwright.config.ts (md | excel | both).
//
// This file is kept so any external reference to "./tests/custom-reporter.ts" still resolves
// to the Markdown reporter.
export { default } from "./reporters/markdown-reporter";
