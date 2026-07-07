import { FullResult } from "@playwright/test/reporter";
import fs from "fs";
import path from "path";
import { BaseValidationReporter, KNOWN_REPORT_FILES } from "./report-data";

/**
 * Writes one Markdown report per validator category into test-results/. Each file lists,
 * for every sub-test, the failed URLs, passed URLs, and remediation guidance.
 *
 * This is the framework's original report format; switch to it with REPORT_FORMAT=md
 * (the default) or run alongside Excel with REPORT_FORMAT=both.
 */
export default class MarkdownValidationReporter extends BaseValidationReporter {
  async onEnd(_result: FullResult) {
    const reportDir = path.resolve(process.cwd(), "test-results");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString();

    for (const report of this.resolveReportData()) {
      if (!report.fileName) continue;

      const reportPath = path.join(reportDir, report.fileName);
      let md = `# ${report.category} Validation Report\n\n`;
      md += `**Timestamp**: ${timestamp}\n\n`;
      md += `---\n\n`;

      for (const subtest of report.subtests) {
        md += `## Subtest: ${subtest.name}\n\n`;

        // 1. Failed URLs
        md += `### Failed URLs\n`;
        if (subtest.failed.length > 0) {
          for (const url of subtest.failed) {
            md += `- ${url}\n`;
          }
        } else {
          md += `*None*\n`;
        }
        md += `\n`;

        // 2. Passed URLs
        md += `### Passed URLs\n`;
        if (subtest.passed.length > 0) {
          for (const url of subtest.passed) {
            md += `- ${url}\n`;
          }
        } else {
          md += `*None*\n`;
        }
        md += `\n`;

        // 3. Steps for Remediation
        md += `### Steps for Remediation\n`;
        md += `${subtest.remediation}\n\n`;
        md += `---\n\n`;
      }

      fs.writeFileSync(reportPath, md, "utf8");
      console.log(`[Markdown Validation Reporter] Report successfully written to ${reportPath}`);
    }

    // Clean up transient files in test-results while preserving every known report artifact
    // (Markdown reports AND the Excel workbook, so `REPORT_FORMAT=both` never self-destructs).
    try {
      const files = fs.readdirSync(reportDir);
      for (const file of files) {
        if (!KNOWN_REPORT_FILES.includes(file)) {
          const fullPath = path.join(reportDir, file);
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      }
      console.log(`[Markdown Validation Reporter] Cleaned up non-report folders in ${reportDir}`);
    } catch (err) {
      // ignore clean up error
    }
  }
}
