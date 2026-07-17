import { Reporter, TestCase, TestResult, FullResult } from "@playwright/test/reporter";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { COMPARISON_MD_FILE, COMPARISON_EXCEL_FILE } from "./report-data";
import type { PageDiff, ComponentDiff, FieldDiff, ParityStatus } from "../../comparison/engine/types";

/**
 * Detailed content-parity reporter for the comparison suite (tests-compare/). Collects the
 * `page-diff` attachment emitted by content-comparison.spec.ts and serializes it to Markdown
 * and/or Excel in test-results/. Format is chosen via the `format` reporter option or the
 * REPORT_FORMAT env var (md | excel | both; default both).
 *
 * Unlike the validation reporters this one does NOT clean up test-results/ — it only adds its two
 * files (which are listed in KNOWN_REPORT_FILES so the validation reporters preserve them too).
 */

interface ReporterOptions {
  format?: string;
}

type Verdict = ParityStatus;

const STATUS_FILL: Record<Verdict, string> = {
  match: "FFE6F4EA",
  modified: "FFFEF7E0",
  missing: "FFFCE8E6",
  extra: "FFE8F0FE",
  "component-missing": "FFFCE8E6",
  "component-extra": "FFE8F0FE",
  unmapped: "FFF1F3F4",
};

const STATUS_FONT: Record<Verdict, string> = {
  match: "FF1E7E34",
  modified: "FF9A6700",
  missing: "FFC5221F",
  extra: "FF1A56C4",
  "component-missing": "FFC5221F",
  "component-extra": "FF1A56C4",
  unmapped: "FF80868B",
};

const COUNT_KEYS: Verdict[] = ["match", "modified", "missing", "extra", "unmapped"];

export default class ComparisonReporter implements Reporter {
  private pages: PageDiff[] = [];
  private readonly format: string;

  constructor(options: ReporterOptions = {}) {
    this.format = (options.format || process.env.REPORT_FORMAT || "both").trim().toLowerCase();
  }

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

    const wantMd = this.format === "md" || this.format === "both";
    const wantExcel = this.format === "excel" || this.format === "xlsx" || this.format === "both";

    if (wantMd || (!wantMd && !wantExcel)) this.writeMarkdown(dir);
    if (wantExcel) await this.writeExcel(dir);
  }

  // -------------------------------------------------------------------------
  // Markdown
  // -------------------------------------------------------------------------

  private writeMarkdown(dir: string) {
    let md = `# Content Parity Report\n\n`;
    md += `**Timestamp**: ${new Date().toISOString()}\n\n`;
    md += `Legend: ✅ match · ✏️ modified · ➖ missing (in legacy, not odyssey) · ➕ extra (in odyssey, not legacy) · ⚪ unmapped (legacy selectors not yet authored)\n\n`;
    md += `---\n\n## Summary\n\n`;
    md += `| Page | Type | Parity | Match | Modified | Missing | Extra | Unmapped |\n`;
    md += `| :--- | :--- | :----- | :---- | :------- | :------ | :---- | :------- |\n`;
    for (const page of this.pages) {
      const c = countStatuses(page);
      md += `| ${mdCell(pathOf(page.odysseyUrl))} | ${page.pageType} | ${(page.parityScore * 100).toFixed(0)}% | ${c.match} | ${c.modified} | ${c.missing} | ${c.extra} | ${c.unmapped} |\n`;
    }
    md += `\n`;

    for (const page of this.pages) {
      md += `---\n\n## ${mdCell(pathOf(page.odysseyUrl))}\n\n`;
      md += `- **Odyssey**: ${page.odysseyUrl}\n- **Legacy**: ${page.legacyUrl}\n`;
      md += `- **Parity**: ${(page.parityScore * 100).toFixed(0)}%\n\n`;

      for (const comp of page.components) {
        md += `### ${symbol(comp.status)} ${comp.label} — ${comp.status} (${(comp.parityScore * 100).toFixed(0)}%)\n\n`;
        const rows = flattenComponent(comp).slice(1); // drop the component header row for the table
        if (rows.length === 0) {
          md += `_${comp.status === "unmapped" ? "Legacy selectors not yet authored." : "No fields."}_\n\n`;
          continue;
        }
        md += `| Field | Status | Sim | Legacy | Odyssey | Diff |\n`;
        md += `| :---- | :----- | :-- | :----- | :------ | :--- |\n`;
        for (const r of rows) {
          const sim = r.hasSimilarity ? `${(r.similarity * 100).toFixed(0)}%` : "";
          md += `| ${mdCell(r.path)} | ${symbol(r.status)} ${r.status} | ${sim} | ${mdCell(r.legacy)} | ${mdCell(r.odyssey)} | ${mdCell(r.diff)} |\n`;
        }
        md += `\n`;
      }
    }

    const file = path.join(dir, COMPARISON_MD_FILE);
    fs.writeFileSync(file, md, "utf8");
    console.log(`[Comparison Reporter] Markdown report written to ${file}`);
  }

  // -------------------------------------------------------------------------
  // Excel
  // -------------------------------------------------------------------------

  private async writeExcel(dir: string) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Odyssey Content Comparison Framework";
    workbook.created = new Date();

    this.buildSummarySheet(workbook);
    const usedNames = new Set<string>(["Summary"]);
    for (const page of this.pages) {
      this.buildPageSheet(workbook, page, usedNames);
    }

    const file = path.join(dir, COMPARISON_EXCEL_FILE);
    try {
      await workbook.xlsx.writeFile(file);
      console.log(`[Comparison Reporter] Excel report written to ${file}`);
    } catch (err: any) {
      console.error(`[Comparison Reporter] Failed to write ${file}: ${err?.message || err}`);
    }
  }

  private buildSummarySheet(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 3 }] });
    sheet.mergeCells("A1:H1");
    const title = sheet.getCell("A1");
    title.value = "Content Parity Report";
    title.font = { bold: true, size: 16, color: { argb: "FF202124" } };
    sheet.getRow(1).height = 24;
    sheet.mergeCells("A2:H2");
    sheet.getCell("A2").value = `Generated ${new Date().toISOString()}`;
    sheet.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF80868B" } };

    const headers = ["Page", "Type", "Parity", "Match", "Modified", "Missing", "Extra", "Unmapped"];
    const headerRow = sheet.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF202124" } };
      cell.alignment = { horizontal: i === 0 ? "left" : "center" };
    });

    for (const page of this.pages) {
      const c = countStatuses(page);
      const row = sheet.addRow([
        pathOf(page.odysseyUrl),
        page.pageType,
        page.parityScore,
        c.match,
        c.modified,
        c.missing,
        c.extra,
        c.unmapped,
      ]);
      row.getCell(3).numFmt = "0%";
      for (let col = 2; col <= 8; col++) row.getCell(col).alignment = { horizontal: "center" };
    }

    sheet.columns = [
      { width: 44 }, { width: 18 }, { width: 10 },
      { width: 8 }, { width: 10 }, { width: 9 }, { width: 8 }, { width: 10 },
    ];
    if (this.pages.length > 0) {
      sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 8 } };
    }
  }

  private buildPageSheet(workbook: ExcelJS.Workbook, page: PageDiff, used: Set<string>) {
    const sheet = workbook.addWorksheet(uniqueSheetName(pathOf(page.odysseyUrl), used), {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    const headers = ["Component / Field", "Status", "Similarity", "Legacy", "Odyssey", "Diff"];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A73E8" } };
      cell.alignment = { horizontal: col === 1 ? "left" : "center", wrapText: true };
    });

    for (const comp of page.components) {
      for (const r of flattenComponent(comp)) {
        const row = sheet.addRow([
          r.path,
          r.status,
          r.hasSimilarity ? r.similarity : "",
          r.legacy,
          r.odyssey,
          r.diff,
        ]);
        const statusCell = row.getCell(2);
        statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[r.status] } };
        statusCell.font = { color: { argb: STATUS_FONT[r.status] }, bold: r.kind === "component" };
        statusCell.alignment = { horizontal: "center" };
        if (r.hasSimilarity) row.getCell(3).numFmt = "0%";
        row.getCell(3).alignment = { horizontal: "center" };
        row.getCell(4).alignment = { wrapText: true, vertical: "top" };
        row.getCell(5).alignment = { wrapText: true, vertical: "top" };
        row.getCell(6).alignment = { wrapText: true, vertical: "top" };
        if (r.kind === "component") row.getCell(1).font = { bold: true };
      }
    }

    sheet.columns = [{ width: 34 }, { width: 18 }, { width: 11 }, { width: 50 }, { width: 50 }, { width: 60 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };
  }
}

// ---------------------------------------------------------------------------
// Flatten + counting helpers
// ---------------------------------------------------------------------------

interface DetailRow {
  path: string;
  kind: "component" | "field";
  status: ParityStatus;
  similarity: number;
  hasSimilarity: boolean;
  legacy: string;
  odyssey: string;
  diff: string;
}

function flattenComponent(c: ComponentDiff): DetailRow[] {
  const rows: DetailRow[] = [
    {
      path: c.label,
      kind: "component",
      status: c.status,
      similarity: c.parityScore,
      hasSimilarity: true,
      legacy: "",
      odyssey: "",
      diff: "",
    },
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

/** Count leaf statuses across a page (deepest field/item, or component when it has no fields). */
function countStatuses(page: PageDiff): Record<Verdict, number> {
  const counts = Object.fromEntries(COUNT_KEYS.map((k) => [k, 0])) as Record<Verdict, number>;
  const bump = (s: ParityStatus) => {
    if (s === "component-missing") counts.missing++;
    else if (s === "component-extra") counts.extra++;
    else counts[s]++;
  };
  for (const comp of page.components) {
    const leaves = leafStatusesOfComponent(comp);
    leaves.forEach(bump);
  }
  return counts;
}

function leafStatusesOfComponent(c: ComponentDiff): ParityStatus[] {
  if (c.fields.length === 0) return [c.status];
  return c.fields.flatMap(leafStatusesOfField);
}

function leafStatusesOfField(f: FieldDiff): ParityStatus[] {
  if (f.children && f.children.length > 0) return f.children.flatMap(leafStatusesOfField);
  return [f.status];
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function symbol(status: ParityStatus): string {
  switch (status) {
    case "match":
      return "✅";
    case "modified":
      return "✏️";
    case "missing":
    case "component-missing":
      return "➖";
    case "extra":
    case "component-extra":
      return "➕";
    case "unmapped":
      return "⚪";
    default:
      return "";
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

function trunc(s: string, n = 200): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function mdCell(s: string): string {
  return trunc(s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Excel sheet names cap at 31 chars and forbid \ / ? * [ ] : ; ensure uniqueness within the book. */
function uniqueSheetName(raw: string, used: Set<string>): string {
  const base = raw.replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "page";
  let name = base;
  let i = 2;
  while (used.has(name)) {
    const suffix = `~${i++}`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name);
  return name;
}
