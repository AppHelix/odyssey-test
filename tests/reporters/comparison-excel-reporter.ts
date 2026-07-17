import { Reporter, TestCase, TestResult, FullResult } from "@playwright/test/reporter";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { COMPARISON_EXCEL_FILE } from "./report-data";
import type { PageDiff, ComponentDiff, FieldDiff, ParityStatus } from "../../comparison/engine/types";

/**
 * Standalone 3-sheet Excel reporter for the CONTENT COMPARISON suite (tests-compare/).
 *
 * Wired only into playwright.compare.config.ts. It is fully independent of the validation
 * reporters (excel-reporter.ts / markdown-reporter.ts) and does not touch report-data.ts state,
 * so it cannot affect the seo/health/header/footer/semantic reporting.
 *
 * Collects the `page-diff` attachment emitted by content-comparison.spec.ts and writes
 * test-results/comparison-parity-report.xlsx with three sheets:
 *   1. Metrics           — per-page KPIs + a totals row.
 *   2. Component Presence — where each mapped component exists (with identifying snippets).
 *   3. Parity Detail      — field-level diffs for components present in BOTH sites.
 */

type Presence = "both" | "odysseyOnly" | "legacyOnly" | "neither" | "unmapped";

const HEADER_FILL = "FF202124";
const DETAIL_HEADER_FILL = "FF1A73E8";
const TOTALS_FILL = "FFF1F3F4";
/** Comfortably above any real field-nesting depth (component > field > list-item sub-field is 2)
 *  — see the "Parity Detail" sheet's `outlineLevelRow` for why this needs to exceed every row's
 *  outlineLevel. */
const MAX_OUTLINE_DEPTH = 8;
/** Component-level parity below this is called out by name on the Metrics sheet. */
const LOW_PARITY_THRESHOLD = 0.9;

const STATUS_FILL: Record<ParityStatus, string> = {
  match: "FFE6F4EA",
  modified: "FFFEF7E0",
  missing: "FFFCE8E6",
  extra: "FFE8F0FE",
  "component-missing": "FFFCE8E6",
  "component-extra": "FFE8F0FE",
  unmapped: "FFF1F3F4",
};
const STATUS_FONT: Record<ParityStatus, string> = {
  match: "FF1E7E34",
  modified: "FF9A6700",
  missing: "FFC5221F",
  extra: "FF1A56C4",
  "component-missing": "FFC5221F",
  "component-extra": "FF1A56C4",
  unmapped: "FF80868B",
};
const PRESENCE_FILL: Record<Presence, string> = {
  both: "FFE6F4EA",
  odysseyOnly: "FFE8F0FE",
  legacyOnly: "FFFCE8E6",
  neither: "FFF1F3F4",
  unmapped: "FFF1F3F4",
};
const PRESENCE_FONT: Record<Presence, string> = {
  both: "FF1E7E34",
  odysseyOnly: "FF1A56C4",
  legacyOnly: "FFC5221F",
  neither: "FF80868B",
  unmapped: "FF80868B",
};
const PRESENCE_LABEL: Record<Presence, string> = {
  both: "Both",
  odysseyOnly: "Odyssey only",
  legacyOnly: "Legacy only",
  neither: "Neither",
  unmapped: "Legacy unmapped",
};

const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

export default class ComparisonExcelReporter implements Reporter {
  private pages: PageDiff[] = [];

  onTestEnd(_test: TestCase, result: TestResult) {
    for (const att of result.attachments) {
      if (att.name === "page-diff" && att.body) {
        try {
          this.pages.push(JSON.parse(att.body.toString("utf8")) as PageDiff);
        } catch {
          // ignore malformed attachment
        }
      }
    }
  }

  async onEnd(_result: FullResult) {
    const dir = path.resolve(process.cwd(), "test-results");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.pages.sort((a, b) => a.odysseyUrl.localeCompare(b.odysseyUrl));

    const wb = new ExcelJS.Workbook();
    wb.creator = "Odyssey Content Comparison Framework";
    wb.created = new Date();
    this.buildMetricsSheet(wb);
    this.buildPresenceSheet(wb);
    this.buildParitySheet(wb);

    const file = path.join(dir, COMPARISON_EXCEL_FILE);
    try {
      await wb.xlsx.writeFile(file);
      console.log(`[Comparison Excel Reporter] 3-sheet report written to ${file}`);
    } catch (err: any) {
      console.error(`[Comparison Excel Reporter] Failed to write ${file}: ${err?.message || err}`);
    }
  }

  // -------------------------------------------------------------------------
  // Sheet 1 — Metrics
  // -------------------------------------------------------------------------
  private buildMetricsSheet(wb: ExcelJS.Workbook) {
    const sheet = wb.addWorksheet("Metrics", { views: [{ state: "frozen", ySplit: 3 }] });
    sheet.mergeCells("A1:L1");
    const title = sheet.getCell("A1");
    title.value = "Content Parity — Metrics";
    title.font = { bold: true, size: 16, color: { argb: "FF202124" } };
    sheet.getRow(1).height = 24;
    sheet.mergeCells("A2:L2");
    sheet.getCell("A2").value = `Generated ${new Date().toISOString()}`;
    sheet.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF80868B" } };

    const headers = [
      "Page", "Parity", "Components", "In Both",
      "Odyssey Only (not in Legacy)", "Legacy Only (not in Odyssey)",
      "Neither", "Unmapped", `Low Parity (<${LOW_PARITY_THRESHOLD * 100}%)`,
      "Fields ✓", "Modified", "Missing", "Extra",
    ];
    const NAME_LIST_COLS = [5, 6, 9]; // Odyssey Only / Legacy Only / Low Parity — left-aligned, wrapped
    const hr = sheet.getRow(3);
    headers.forEach((h, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = solid(HEADER_FILL);
      cell.alignment = { horizontal: i === 0 ? "left" : "center", wrapText: true };
    });
    hr.height = 28;

    const totals = { comps: 0, both: 0, odysseyOnly: 0, legacyOnly: 0, neither: 0, unmapped: 0, lowParity: 0, match: 0, modified: 0, missing: 0, extra: 0 };
    let paritySum = 0;
    for (const page of this.pages) {
      const cc = componentCounts(page);
      const fc = fieldCounts(page);
      const names = componentNameLists(page);
      const row = sheet.addRow([
        pathOf(page.odysseyUrl), page.parityScore, page.components.length,
        cc.both, listOrDash(names.odysseyOnly), listOrDash(names.legacyOnly),
        cc.neither, cc.unmapped, listOrDash(names.lowParity),
        fc.match, fc.modified, fc.missing, fc.extra,
      ]);
      row.getCell(2).numFmt = "0%";
      for (let col = 2; col <= 13; col++) {
        row.getCell(col).alignment = NAME_LIST_COLS.includes(col)
          ? { horizontal: "left", vertical: "top", wrapText: true }
          : { horizontal: "center" };
      }
      totals.comps += page.components.length;
      totals.both += cc.both; totals.odysseyOnly += names.odysseyOnly.length; totals.legacyOnly += names.legacyOnly.length;
      totals.neither += cc.neither; totals.unmapped += cc.unmapped; totals.lowParity += names.lowParity.length;
      totals.match += fc.match; totals.modified += fc.modified; totals.missing += fc.missing; totals.extra += fc.extra;
      paritySum += page.parityScore;
    }

    if (this.pages.length > 0) {
      const tr = sheet.addRow([
        "ALL PAGES", paritySum / this.pages.length, totals.comps,
        totals.both, `${totals.odysseyOnly} total`, `${totals.legacyOnly} total`,
        totals.neither, totals.unmapped, `${totals.lowParity} total`,
        totals.match, totals.modified, totals.missing, totals.extra,
      ]);
      tr.getCell(2).numFmt = "0%";
      tr.eachCell((cell, col) => {
        cell.font = { bold: true };
        cell.fill = solid(TOTALS_FILL);
        if (col >= 2) cell.alignment = { horizontal: NAME_LIST_COLS.includes(col) ? "left" : "center" };
      });
    }

    sheet.columns = [
      { width: 40 }, { width: 9 }, { width: 12 }, { width: 9 }, { width: 30 }, { width: 30 },
      { width: 9 }, { width: 11 }, { width: 30 }, { width: 9 }, { width: 10 }, { width: 9 }, { width: 8 },
    ];
    if (this.pages.length > 0) sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 13 } };
  }

  // -------------------------------------------------------------------------
  // Sheet 2 — Component Presence
  // -------------------------------------------------------------------------
  private buildPresenceSheet(wb: ExcelJS.Workbook) {
    const sheet = wb.addWorksheet("Component Presence", { views: [{ state: "frozen", ySplit: 1 }] });
    const headers = [
      "Page", "Component", "Type", "In Odyssey", "In Legacy", "Presence",
      "Odyssey heading/snippet", "Legacy heading/snippet",
    ];
    const hr = sheet.addRow(headers);
    hr.height = 26;
    hr.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = solid(HEADER_FILL);
      cell.alignment = { horizontal: col <= 3 ? "left" : "center", wrapText: true };
    });

    for (const page of this.pages) {
      const pg = pathOf(page.odysseyUrl);
      for (const comp of page.components) {
        const presence = classify(comp);
        const inOdyssey = comp.odysseyPresent ? "✓" : "✗";
        const inLegacy = !comp.legacyMapped ? "unmapped" : comp.legacyPresent ? "✓" : "✗";
        const row = sheet.addRow([
          pg, comp.label, comp.type, inOdyssey, inLegacy, PRESENCE_LABEL[presence],
          comp.odysseySnippet, comp.legacySnippet,
        ]);
        row.getCell(4).alignment = { horizontal: "center" };
        row.getCell(5).alignment = { horizontal: "center" };
        const pc = row.getCell(6);
        pc.fill = solid(PRESENCE_FILL[presence]);
        pc.font = { color: { argb: PRESENCE_FONT[presence] }, bold: true };
        pc.alignment = { horizontal: "center" };
        row.getCell(7).alignment = { wrapText: true, vertical: "top" };
        row.getCell(8).alignment = { wrapText: true, vertical: "top" };
      }
    }

    sheet.columns = [
      { width: 34 }, { width: 20 }, { width: 16 }, { width: 11 }, { width: 11 }, { width: 15 },
      { width: 50 }, { width: 50 },
    ];
    if (this.pages.length > 0) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };
  }

  // -------------------------------------------------------------------------
  // Sheet 3 — Parity Detail (components present in BOTH sites)
  // -------------------------------------------------------------------------
  private buildParitySheet(wb: ExcelJS.Workbook) {
    const sheet = wb.addWorksheet("Parity Detail", {
      views: [{ state: "frozen", ySplit: 1 }],
      // Row grouping: each component's fields (and each list field's own nested item rows) are
      // collapsible outline groups. `summaryBelow: false` puts the +/- toggle on the group's own
      // header row (the component row, or the parent field row for a nested group) rather than on
      // a trailing "subtotal" row below it — there is no such row here, so the toggle needs to sit
      // above the rows it collapses. `outlineLevelRow` (ExcelJS derives each row's `collapsed` flag
      // as `row.outlineLevel >= outlineLevelRow`) is set above MAX_OUTLINE_DEPTH so every group
      // starts fully EXPANDED when the workbook is first opened, not pre-collapsed.
      properties: {
        outlineProperties: { summaryBelow: false, summaryRight: false },
        outlineLevelRow: MAX_OUTLINE_DEPTH + 1,
      },
    });
    const headers = ["Page", "Component / Field", "Status", "Similarity", "Legacy", "Odyssey", "Diff"];
    const hr = sheet.addRow(headers);
    hr.height = 24;
    hr.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = solid(DETAIL_HEADER_FILL);
      cell.alignment = { horizontal: col <= 2 ? "left" : "center", wrapText: true };
    });

    for (const page of this.pages) {
      const pg = pathOf(page.odysseyUrl);
      const both = page.components.filter((c) => c.odysseyPresent && c.legacyPresent);
      for (const comp of both) {
        for (const r of flattenComponent(comp)) {
          const row = sheet.addRow([
            pg, r.path, r.status, r.hasSimilarity ? r.similarity : "",
            cap(r.legacy), cap(r.odyssey), cap(r.diff),
          ]);
          const sc = row.getCell(3);
          sc.fill = solid(STATUS_FILL[r.status]);
          sc.font = { color: { argb: STATUS_FONT[r.status] }, bold: r.kind === "component" };
          sc.alignment = { horizontal: "center" };
          if (r.hasSimilarity) row.getCell(4).numFmt = "0%";
          row.getCell(4).alignment = { horizontal: "center" };
          row.getCell(5).alignment = { wrapText: true, vertical: "top" };
          row.getCell(6).alignment = { wrapText: true, vertical: "top" };
          row.getCell(7).alignment = { wrapText: true, vertical: "top" };
          if (r.kind === "component") row.getCell(2).font = { bold: true };
          // depth 0 (the component row) stays outside any group so it's always visible; each field
          // row is grouped one outline level per nesting depth, so list-item sub-fields collapse
          // independently within their own parent field's group.
          if (r.depth > 0) row.outlineLevel = r.depth;
        }
      }
    }

    sheet.columns = [
      { width: 30 }, { width: 30 }, { width: 18 }, { width: 11 }, { width: 48 }, { width: 48 }, { width: 56 },
    ];
    if (this.pages.length > 0) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
  }
}

// ---------------------------------------------------------------------------
// Helpers (self-contained)
// ---------------------------------------------------------------------------

interface DetailRow {
  path: string;
  kind: "component" | "field";
  /** Outline nesting depth: 0 = component row, 1 = its direct fields, 2 = a list field's own item sub-fields, etc. */
  depth: number;
  status: ParityStatus;
  similarity: number;
  hasSimilarity: boolean;
  legacy: string;
  odyssey: string;
  diff: string;
}

/** Classify a component by where it exists. */
function classify(c: ComponentDiff): Presence {
  if (!c.legacyMapped) return "unmapped";
  if (c.odysseyPresent && c.legacyPresent) return "both";
  if (c.odysseyPresent && !c.legacyPresent) return "odysseyOnly";
  if (!c.odysseyPresent && c.legacyPresent) return "legacyOnly";
  return "neither";
}

function componentCounts(page: PageDiff): Record<Presence, number> {
  const counts: Record<Presence, number> = { both: 0, odysseyOnly: 0, legacyOnly: 0, neither: 0, unmapped: 0 };
  for (const comp of page.components) counts[classify(comp)]++;
  return counts;
}

/**
 * Per-page component NAMES (not just counts) for the 3 things worth calling out by name on the
 * Metrics sheet: components present only on one side, and components present on both sides but
 * whose content similarity is below LOW_PARITY_THRESHOLD. "Neither"/"unmapped" are left as plain
 * counts elsewhere — their parityScore is 1 or 0 by construction (not a real similarity measure),
 * so listing them here wouldn't be meaningful the way it is for a genuine low-parity "both" match.
 */
function componentNameLists(page: PageDiff): { odysseyOnly: string[]; legacyOnly: string[]; lowParity: string[] } {
  const odysseyOnly: string[] = [];
  const legacyOnly: string[] = [];
  const lowParity: string[] = [];
  for (const comp of page.components) {
    const presence = classify(comp);
    if (presence === "odysseyOnly") odysseyOnly.push(comp.label);
    else if (presence === "legacyOnly") legacyOnly.push(comp.label);
    else if (presence === "both" && comp.parityScore < LOW_PARITY_THRESHOLD) {
      lowParity.push(`${comp.label} (${Math.round(comp.parityScore * 100)}%)`);
    }
  }
  return { odysseyOnly, legacyOnly, lowParity };
}

/** Newline-joined for wrapText display in one cell; an em dash when there's nothing to list. */
function listOrDash(names: string[]): string {
  return names.length > 0 ? names.join("\n") : "—";
}

/** Field-level parity distribution, counted only within components present in both sites. */
function fieldCounts(page: PageDiff) {
  const counts = { match: 0, modified: 0, missing: 0, extra: 0 };
  for (const comp of page.components) {
    if (!(comp.odysseyPresent && comp.legacyPresent)) continue;
    for (const status of comp.fields.flatMap(leafStatusesOfField)) {
      if (status === "match") counts.match++;
      else if (status === "modified") counts.modified++;
      else if (status === "missing" || status === "component-missing") counts.missing++;
      else if (status === "extra" || status === "component-extra") counts.extra++;
    }
  }
  return counts;
}

function leafStatusesOfField(f: FieldDiff): ParityStatus[] {
  if (f.children && f.children.length > 0) return f.children.flatMap(leafStatusesOfField);
  return [f.status];
}

function flattenComponent(c: ComponentDiff): DetailRow[] {
  const rows: DetailRow[] = [
    { path: c.label, kind: "component", depth: 0, status: c.status, similarity: c.parityScore, hasSimilarity: true, legacy: "", odyssey: "", diff: "" },
  ];
  for (const f of c.fields) rows.push(...flattenField(f, 1));
  return rows;
}

function flattenField(f: FieldDiff, depth: number): DetailRow[] {
  const indent = "    ".repeat(depth);
  const rows: DetailRow[] = [
    {
      path: indent + f.name,
      kind: "field",
      depth,
      status: f.status,
      similarity: f.similarity,
      hasSimilarity: f.status === "match" || f.status === "modified",
      legacy: f.legacy.join(" | "),
      odyssey: f.odyssey.join(" | "),
      diff: f.inlineDiff || "",
    },
  ];
  if (f.children) for (const child of f.children) rows.push(...flattenField(child, depth + 1));
  return rows;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

function cap(s: string, n = 800): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
