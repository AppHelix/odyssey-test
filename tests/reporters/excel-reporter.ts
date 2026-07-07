import { FullResult } from "@playwright/test/reporter";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { BaseValidationReporter, CategoryReport, EXCEL_REPORT_FILE, KNOWN_REPORT_FILES } from "./report-data";

// ---------------------------------------------------------------------------
// Cell presentation
// ---------------------------------------------------------------------------

type Verdict = "Pass" | "Fail" | "N/A";

const FILLS: Record<Verdict | "header" | "summaryHeader", ExcelJS.Fill> = {
  Pass: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4EA" } },
  Fail: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE8E6" } },
  "N/A": { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F3F4" } },
  header: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A73E8" } },
  summaryHeader: { type: "pattern", pattern: "solid", fgColor: { argb: "FF202124" } },
};

const FONT_COLORS: Record<Verdict, string> = {
  Pass: "FF1E7E34",
  Fail: "FFC5221F",
  "N/A": "FF80868B",
};

/** Excel worksheet names cap at 31 chars and forbid \ / ? * [ ] : — make any category safe. */
function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
}

/** Resolve a single URL's outcome for a sub-test. */
function verdictFor(url: string, failed: string[], passed: string[]): Verdict {
  if (failed.includes(url)) return "Fail";
  if (passed.includes(url)) return "Pass";
  return "N/A";
}

/**
 * Writes a single Excel workbook (test-results/validation-report.xlsx) with a Summary sheet
 * plus one sheet per validator that ran. Each validator sheet is a URL × sub-test matrix of
 * Pass / Fail / N-A cells; sub-test headers carry the remediation guidance as a cell note.
 *
 * Switch to it with REPORT_FORMAT=excel, or run alongside Markdown with REPORT_FORMAT=both.
 */
export default class ExcelValidationReporter extends BaseValidationReporter {
  async onEnd(_result: FullResult) {
    const reportDir = path.resolve(process.cwd(), "test-results");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reports = this.resolveReportData();
    const active = reports.filter((r) => r.hasData);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Odyssey Validation Framework";
    workbook.created = new Date();

    this.buildSummarySheet(workbook, active);
    for (const report of active) {
      this.buildCategorySheet(workbook, report);
    }

    const filePath = path.join(reportDir, EXCEL_REPORT_FILE);
    try {
      await workbook.xlsx.writeFile(filePath);
      console.log(`[Excel Validation Reporter] Report successfully written to ${filePath}`);
    } catch (err: any) {
      console.error(`[Excel Validation Reporter] Failed to write ${filePath}: ${err?.message || err}`);
      return;
    }

    // Remove transient Playwright folders/files but preserve every known report artifact
    // (this workbook AND any Markdown reports, so REPORT_FORMAT=both is order-independent).
    try {
      for (const file of fs.readdirSync(reportDir)) {
        if (!KNOWN_REPORT_FILES.includes(file)) {
          fs.rmSync(path.join(reportDir, file), { recursive: true, force: true });
        }
      }
    } catch {
      // ignore clean up error
    }
  }

  private buildSummarySheet(workbook: ExcelJS.Workbook, reports: CategoryReport[]) {
    const sheet = workbook.addWorksheet("Summary", {
      views: [{ state: "frozen", ySplit: 3 }],
    });

    sheet.mergeCells("A1:F1");
    const title = sheet.getCell("A1");
    title.value = "Page Validation Report";
    title.font = { bold: true, size: 16, color: { argb: "FF202124" } };
    title.alignment = { vertical: "middle" };
    sheet.getRow(1).height = 24;

    sheet.mergeCells("A2:F2");
    const subtitle = sheet.getCell("A2");
    subtitle.value = `Generated ${new Date().toISOString()}`;
    subtitle.font = { italic: true, size: 10, color: { argb: "FF80868B" } };

    const headers = ["Validator", "URLs Tested", "Sub-tests", "Passed", "Failed", "Pass Rate"];
    const headerRow = sheet.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = FILLS.summaryHeader;
      cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
    });
    headerRow.height = 18;

    if (reports.length === 0) {
      sheet.mergeCells("A4:F4");
      const empty = sheet.getCell("A4");
      empty.value = "No validator results were recorded for this run.";
      empty.font = { italic: true, color: { argb: "FF80868B" } };
      sheet.columns = [{ width: 28 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 }];
      return;
    }

    for (const report of reports) {
      let passed = 0;
      let failed = 0;
      for (const s of report.subtests) {
        passed += s.passed.length;
        failed += s.failed.length;
      }
      const total = passed + failed;
      const rate = total > 0 ? passed / total : 0;

      const row = sheet.addRow([
        report.category,
        report.urls.length,
        report.subtests.length,
        passed,
        failed,
        rate,
      ]);
      row.getCell(1).font = { bold: true };
      row.getCell(6).numFmt = "0.0%";
      row.getCell(4).font = { color: { argb: FONT_COLORS.Pass } };
      row.getCell(5).font = { color: { argb: failed > 0 ? FONT_COLORS.Fail : FONT_COLORS["N/A"] } };
      for (let c = 2; c <= 6; c++) {
        row.getCell(c).alignment = { horizontal: "center" };
      }
    }

    sheet.columns = [{ width: 28 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 }];
    sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 6 } };
  }

  private buildCategorySheet(workbook: ExcelJS.Workbook, report: CategoryReport) {
    const sheet = workbook.addWorksheet(safeSheetName(report.category), {
      views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
    });

    // Header row: URL + one column per sub-test.
    const headerCells = ["URL", ...report.subtests.map((s) => s.name)];
    const headerRow = sheet.addRow(headerCells);
    headerRow.height = 30;
    headerRow.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = FILLS.header;
      cell.alignment = { vertical: "top", horizontal: col === 1 ? "left" : "center", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFDADCE0" } } };
      if (col > 1) {
        // Attach remediation guidance to the sub-test header as a cell note.
        cell.note = report.subtests[col - 2].remediation;
      }
    });

    // One row per URL that produced a result for this category.
    for (const url of report.urls) {
      const row = sheet.addRow([
        url,
        ...report.subtests.map((s) => verdictFor(url, s.failed, s.passed)),
      ]);
      row.eachCell((cell, col) => {
        if (col === 1) {
          cell.alignment = { vertical: "middle", wrapText: false };
          return;
        }
        const verdict = cell.value as Verdict;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = FILLS[verdict];
        cell.font = { color: { argb: FONT_COLORS[verdict] }, bold: verdict === "Fail" };
      });
    }

    // Column widths: wide URL column, readable fixed width for verdict columns.
    sheet.getColumn(1).width = 52;
    for (let c = 2; c <= headerCells.length; c++) {
      const name = headerCells[c - 1];
      sheet.getColumn(c).width = Math.min(Math.max(name.length + 2, 12), 32);
    }

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headerCells.length },
    };
  }
}
