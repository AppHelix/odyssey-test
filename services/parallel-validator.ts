import { Page, APIRequestContext } from '@playwright/test';
import { NavigationService } from './navigation.service';
import { NavigationValidator } from './navigation-validator';
import { NavigationReportRow, NavigationRow } from '../models/navigation-model';
import { generateHtmlReport } from '../utils/report-generator';
import { log } from '../utils/logger';
import { readExcel } from '../utils/excel-reader';

export class ParallelValidator {
  excelPath: string;

  constructor(excelPath: string) {
    this.excelPath = excelPath;
  }

  private parseNavigationLabels(): string[] {
    const navigationLabel = process.env.NAVIGATION_LABEL || 'all';
    
    if (navigationLabel.toLowerCase() === 'all') {
      return []; // Empty array means all labels
    }
    
    return navigationLabel
      .split(',')
      .map(label => label.trim())
      .filter(label => label.length > 0);
  }

  private parseMaxTestsPerLabel(): number | null {
    const maxTests = process.env.MAX_TESTS_PER_LABEL;
    
    if (!maxTests) {
      return null;
    }
    
    const parsed = parseInt(maxTests, 10);
    if (isNaN(parsed) || parsed <= 0) {
      log(`Warning: Invalid MAX_TESTS_PER_LABEL value "${maxTests}". Ignoring limit.`);
      return null;
    }
    
    return parsed;
  }

  private getUniqueLabels(rows: NavigationRow[]): string[] {
    const labels = new Set<string>();
    for (const row of rows) {
      labels.add(row.label);
    }
    return Array.from(labels).sort();
  }

  private filterRowsForLabel(allRows: NavigationRow[], targetLabel: string): NavigationRow[] {
    return allRows.filter(row => row.label.toLowerCase() === targetLabel.toLowerCase());
  }

  private applyMaxTestsLimit(rows: NavigationRow[], maxPerLabel: number | null): NavigationRow[] {
    if (maxPerLabel === null) {
      return rows;
    }
    
    const rowsByLabel = new Map<string, NavigationRow[]>();
    for (const row of rows) {
      const labelKey = row.label.toLowerCase();
      if (!rowsByLabel.has(labelKey)) {
        rowsByLabel.set(labelKey, []);
      }
      rowsByLabel.get(labelKey)!.push(row);
    }

    const limitedRows: NavigationRow[] = [];
    for (const [label, labelRows] of rowsByLabel) {
      limitedRows.push(...labelRows.slice(0, maxPerLabel));
      if (labelRows.length > maxPerLabel) {
        log(`Label "${label}": Limited from ${labelRows.length} to ${maxPerLabel} rows`);
      }
    }

    return limitedRows;
  }

  private async runValidatorForLabel(
    label: string,
    labelRows: NavigationRow[],
    totalLevels: number,
    page: Page,
    request: APIRequestContext
  ): Promise<NavigationReportRow[]> {
    try {
      log(`[${label}] Starting validation (${labelRows.length} rows)`);
      
      // Create a new page for this label's validation
      const labelPage = await page.context().newPage();
      
      try {
        const validator = new NavigationValidator(null as any);
        const reportRows = await validator.runForLabel(labelPage, request, label, labelRows, totalLevels);
        log(`[${label}] Completed validation`);
        return reportRows;
      } finally {
        await labelPage.close().catch(() => {});
      }
    } catch (error) {
      log(`[${label}] Error during validation:`, error);
      throw error;
    }
  }

  async runInParallel(page: Page, request: APIRequestContext): Promise<string> {
    try {
      // Load all rows from Excel once
      log('Loading Excel data...');
      const allRows: NavigationRow[] = (await readExcel(this.excelPath)).map((row, index) => ({
        ...row,
        sourceIndex: index,
      }));

      if (allRows.length === 0) {
        throw new Error('No valid rows found in the input file');
      }

      const totalLevels = allRows[0].levels.length;
      const pod = (process.env.POD || 'stage').toLowerCase();

      // Apply POD substitution if needed
      let rows = allRows;
      if (pod === 'prod') {
        rows = rows.map(row => ({
          ...row,
          levels: row.levels.map(level =>
            level.replace('https://odyssey.stage.edx.org', 'https://www.edx.org')
          ),
        }));
      }

      // Apply MAX_TESTS_PER_LABEL limit
      const maxPerLabel = this.parseMaxTestsPerLabel();
      rows = this.applyMaxTestsLimit(rows, maxPerLabel);

      // Get labels to process
      const labelsToRun = this.parseNavigationLabels();
      let targetLabels: string[];

      if (labelsToRun.length === 0) {
        // Process all labels found in data
        targetLabels = this.getUniqueLabels(rows);
        log(`Processing all labels found in data: ${targetLabels.join(', ')}`);
      } else {
        // Process only specified labels
        targetLabels = labelsToRun.filter(label =>
          rows.some(row => row.label.toLowerCase() === label.toLowerCase())
        );
        log(`Processing specified labels: ${targetLabels.join(', ')}`);
      }

      if (targetLabels.length === 0) {
        throw new Error('No matching labels found in the data');
      }

      // Run each label in parallel
      log(`Starting parallel validation for ${targetLabels.length} label(s)`);
      const promises = targetLabels.map(label => {
        const labelRows = this.filterRowsForLabel(rows, label);
        return this.runValidatorForLabel(label, labelRows, totalLevels, page, request);
      });

      const allResults = await Promise.all(promises);

      // Consolidate all report rows maintaining order
      const consolidatedRows: NavigationReportRow[] = [];
      for (const result of allResults) {
        consolidatedRows.push(...result);
      }

      // Sort by label order and source index for consistent output
      const labelOrder = new Map(targetLabels.map((label, index) => [label.toLowerCase(), index]));
      consolidatedRows.sort((a, b) => {
        const labelComparison = (labelOrder.get(a.label.toLowerCase()) ?? 0) - (labelOrder.get(b.label.toLowerCase()) ?? 0);
        if (labelComparison !== 0) {
          return labelComparison;
        }
        return (a.sourceIndex ?? 0) - (b.sourceIndex ?? 0);
      });

      // Generate consolidated report
      log(`Consolidating reports from ${allResults.length} parallel runs`);
      const reportPath = await generateHtmlReport(consolidatedRows);
      log(`Consolidated report generated at ${reportPath}`);

      return reportPath;
    } catch (error) {
      log('ParallelValidator error:', error);
      throw error;
    }
  }
}
