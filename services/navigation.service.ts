import { readExcel } from '../utils/excel-reader';
import { LabelNode, LevelNode, NavigationPlan, NavigationRow } from '../models/navigation-model';
import { normalizeUrl } from '../utils/url-utils';
import { log } from '../utils/logger';

export class NavigationService {
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
      return null; // No limit
    }
    
    const parsed = parseInt(maxTests, 10);
    if (isNaN(parsed) || parsed <= 0) {
      log(`Warning: Invalid MAX_TESTS_PER_LABEL value "${maxTests}". Ignoring limit.`);
      return null;
    }
    
    return parsed;
  }

  private filterRowsByLabels(rows: NavigationRow[], allowedLabels: string[]): NavigationRow[] {
    // If allowedLabels is empty, return all rows (when NAVIGATION_LABEL=all)
    if (allowedLabels.length === 0) {
      return rows;
    }
    
    return rows.filter(row => 
      allowedLabels.some(label => 
        row.label.toLowerCase() === label.toLowerCase()
      )
    );
  }

  private limitRowsPerLabel(rows: NavigationRow[], maxPerLabel: number | null): NavigationRow[] {
    if (maxPerLabel === null) {
      return rows; // No limit
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

  private substituteUrlsByPod(rows: NavigationRow[]): NavigationRow[] {
    const pod = (process.env.POD || 'stage').toLowerCase();
    
    // If POD is prod, replace all staging URLs with production URLs
    if (pod === 'prod') {
      const replacementMap = {
        'https://odyssey.stage.edx.org': 'https://www.edx.org',
      };
      
      return rows.map(row => ({
        ...row,
        levels: row.levels.map(level => this.replaceUrlDomain(level, replacementMap)),
      }));
    }
    
    return rows; // No substitution for stage
  }

  private replaceUrlDomain(url: string, replacementMap: { [key: string]: string }): string {
    let result = url;
    for (const [oldDomain, newDomain] of Object.entries(replacementMap)) {
      result = result.replace(oldDomain, newDomain);
    }
    return result;
  }

  private buildNestedHierarchy(rows: NavigationRow[], levelIndex: number, totalLevels: number): LevelNode {
    const rootNode: LevelNode = {
      url: 'root',
      children: [],
      rows: [],
      level: levelIndex,
    };

    if (levelIndex >= totalLevels) {
      rootNode.rows = rows;
      return rootNode;
    }

    // Group rows by URL at current level
    const urlMap = new Map<string, NavigationRow[]>();
    for (const row of rows) {
      const url = row.levels[levelIndex];
      if (!urlMap.has(url)) {
        urlMap.set(url, []);
      }
      urlMap.get(url)!.push(row);
    }

    // Build children recursively
    for (const [url, rowsForUrl] of urlMap) {
      const childNode: LevelNode = {
        url,
        children: [],
        rows: rowsForUrl, // Store rows at this level
        level: levelIndex + 1,
      };

      // If not at the deepest level, recursively build children
      if (levelIndex + 1 < totalLevels) {
        const nestedChild = this.buildNestedHierarchy(rowsForUrl, levelIndex + 1, totalLevels);
        childNode.children = nestedChild.children;
      }

      rootNode.children.push(childNode);
    }

    return rootNode;
  }

  async loadAndGroup(): Promise<NavigationPlan> {
    const allRows: NavigationRow[] = (await readExcel(this.excelPath)).map((row, index) => ({
      ...row,
      sourceIndex: index,
    }));

    if (allRows.length === 0) {
      throw new Error('No valid rows found in the input file');
    }

    const totalLevels = allRows[0].levels.length;
    log(`Detected ${totalLevels} level(s) in input data`);

    // Substitute URLs based on POD value (without modifying input file)
    let rows = this.substituteUrlsByPod(allRows);

    const allowedLabels = this.parseNavigationLabels();
    rows = this.filterRowsByLabels(rows, allowedLabels);
    
    const maxPerLabel = this.parseMaxTestsPerLabel();
    const originalRowCount = rows.length;
    rows = this.limitRowsPerLabel(rows, maxPerLabel);
    
    // Update sourceIndex after filtering and limiting
    rows = rows.map((row, index) => ({ ...row, sourceIndex: index }));
    
    // Log which labels are being validated
    if (allowedLabels.length === 0) {
      log('NAVIGATION_LABEL=all: Validating all labels. Total rows:', rows.length);
    } else {
      log(`NAVIGATION_LABEL=${allowedLabels.join(',')}:`, `Validating ${allowedLabels.length} label(s). Total rows to validate: ${rows.length}/${allRows.length}`);
    }
    
    if (maxPerLabel !== null) {
      log(`MAX_TESTS_PER_LABEL=${maxPerLabel}: Limited rows from ${originalRowCount} to ${rows.length}`);
    }

    const labels = new Map<string, LabelNode>();

    for (const row of rows) {
      const labelKey = row.label || 'Unnamed Label';
      let labelNode = labels.get(labelKey);
      if (!labelNode) {
        // Build hierarchical structure for this label
        const root = this.buildNestedHierarchy([row], 0, totalLevels);
        labelNode = { label: labelKey, root };
        labels.set(labelKey, labelNode);
      } else {
        // Add row to existing label's hierarchy
        this.addRowToHierarchy(labelNode.root, row, 0, totalLevels);
      }
    }

    const sortedLabels = Array.from(labels.values()).sort((a, b) => a.label.localeCompare(b.label));
    return {
      rows,
      labels: sortedLabels,
      totalLevels,
    };
  }

  private addRowToHierarchy(node: LevelNode, row: NavigationRow, levelIndex: number, totalLevels: number) {
    if (levelIndex >= totalLevels) {
      node.rows.push(row);
      return;
    }

    const url = row.levels[levelIndex];
    let childNode = node.children.find(child => normalizeUrl(child.url) === normalizeUrl(url));
    
    if (!childNode) {
      childNode = {
        url,
        children: [],
        rows: [],
        level: levelIndex + 1,
      };
      node.children.push(childNode);
    }

    // Store row at every level it passes through (not just leaf levels)
    childNode.rows.push(row);

    // Recursively add to deeper levels
    if (levelIndex + 1 < totalLevels) {
      this.addRowToHierarchy(childNode, row, levelIndex + 1, totalLevels);
    }
  }
}
