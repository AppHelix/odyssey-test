import { Page, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { NavigationService } from './navigation.service';
import { isSameUrl, normalizeUrl } from '../utils/url-utils';
import { log } from '../utils/logger';
import { generateHtmlReport } from '../utils/report-generator';
import { NavigationReportRow, NavigationRow, LevelNode } from '../models/navigation-model';

interface NavigationOutcome {
  status: 'PASS' | 'FAIL';
  statusCode?: number | string;
  failureReason?: string;
  screenshotPath?: string;
}

// Configurable timeout constants
const TIMEOUTS = {
  HTTP_REQUEST: 20000,
  PAGE_GOTO: 20000,
  DOM_LOADED: 8000,
  NETWORK_IDLE: 10000,
  LINK_CLICK_WAIT: 12000,
  ELEMENT_VISIBLE: 3000,
};

const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY: 1000,
};

export class NavigationValidator {
  navService: NavigationService;
  reportRows: NavigationReportRow[] = [];
  screenshotsDir: string;
  screenshotOnFailure: boolean;

  constructor(navService: NavigationService, screenshotsDir = 'reports/screenshots') {
    this.navService = navService;
    this.screenshotsDir = screenshotsDir;
    this.screenshotOnFailure = process.env.SCREENSHOT_ON_FAILURE === 'true';
    if (!fs.existsSync(this.screenshotsDir)) fs.mkdirSync(this.screenshotsDir, { recursive: true });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateScreenshotFilename(row: NavigationReportRow, levelNumber: number, status: string): string {
    const sanitizeUrl = (url: string): string => {
      return url
        .replace(/https?:\/\//g, '')
        .replace(/\//g, '-')
        .replace(/[^a-z0-9-]/gi, '')
        .substring(0, 30);
    };

    const levelUrl = row.levels[levelNumber - 1] || '';
    const urlSlug = sanitizeUrl(levelUrl);
    const timestamp = Date.now();

    return `${row.label}_level${levelNumber}_${status}_${urlSlug}_${row.sourceIndex}_${timestamp}.png`;
  }

  private async takeFailureScreenshot(page: Page, row: NavigationReportRow, levelNumber: number, status: string): Promise<string> {
    if (!this.screenshotOnFailure) {
      return '';
    }
    
    const filename = this.generateScreenshotFilename(row, levelNumber, status);
    const filePath = path.join(this.screenshotsDir, filename);
    try {
      if (page.isClosed()) {
        return '';
      }
      await page.screenshot({ path: filePath, fullPage: true, timeout: 10000 });
      log(`Screenshot saved: ${filename}`);
      return filePath;
    } catch (e) {
      log('Failed to capture screenshot', e);
      return '';
    }
  }

  private async ensurePage(page: Page): Promise<Page> {
    if (page && !page.isClosed()) {
      return page;
    }

    try {
      return await page.context().newPage();
    } catch (e) {
      const browser = page.context().browser();
      if (browser?.isConnected()) {
        const context = await browser.newContext();
        return await context.newPage();
      }
      throw e;
    }
  }

  private async findLinkByHref(page: Page, targetHref: string, baseURL?: string, retryCount = 0): Promise<any> {
    try {
      const normalizedTarget = normalizeUrl(targetHref, baseURL);
      const anchors = page.locator('a[href]');
      const count = await anchors.count();

      for (let i = 0; i < count; i++) {
        const link = anchors.nth(i);
        try {
          await link.isVisible({ timeout: 2000 }).catch(() => {});
        } catch (e) {
          continue;
        }

        try {
          const href = await link.getAttribute('href');
          if (href) {
            const normalizedLink = normalizeUrl(href, baseURL);
            if (isSameUrl(normalizedLink, normalizedTarget)) {
              return link;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (retryCount < RETRY_CONFIG.MAX_ATTEMPTS - 1) {
        const delayMs = RETRY_CONFIG.INITIAL_DELAY * (retryCount + 1);
        await this.delay(delayMs);
        return this.findLinkByHref(page, targetHref, baseURL, retryCount + 1);
      }

      return null;
    } catch (e: any) {
      log('Error finding link:', e?.message);
      return null;
    }
  }

  private async clickLinkWithRetry(page: Page, link: any, targetHref: string, retryCount = 0): Promise<boolean> {
    try {
      await link.waitForElementState('visible', { timeout: TIMEOUTS.ELEMENT_VISIBLE }).catch(() => {});
      await link.scrollIntoViewIfNeeded();
      await link.click({ timeout: TIMEOUTS.LINK_CLICK_WAIT });

      await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.DOM_LOADED }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.NETWORK_IDLE }).catch(() => {});

      return true;
    } catch (e: any) {
      if (retryCount < RETRY_CONFIG.MAX_ATTEMPTS - 1) {
        const delayMs = RETRY_CONFIG.INITIAL_DELAY * (retryCount + 1);
        await this.delay(delayMs);
        return this.clickLinkWithRetry(page, link, targetHref, retryCount + 1);
      }
      log(`Failed to click link after ${RETRY_CONFIG.MAX_ATTEMPTS} attempts:`, targetHref);
      return false;
    }
  }

  private async openPage(page: Page, request: APIRequestContext, url: string): Promise<NavigationOutcome> {
    try {
      const statusCode = await request.head(url).then((res) => res.status()).catch(() => undefined);
      
      if (statusCode && statusCode >= 400) {
        return {
          status: 'FAIL',
          statusCode,
          failureReason: `HTTP ${statusCode} returned from HTTP request`,
        };
      }

      // Navigate to page
      let gotoResponse;
      try {
        gotoResponse = await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: TIMEOUTS.PAGE_GOTO 
        });
      } catch (e: any) {
        const message = e?.message || String(e);
        return {
          status: 'FAIL',
          statusCode: 'Navigation Failed',
          failureReason: message.includes('timeout') ? 'Page load timeout' : `Navigation error: ${message}`,
        };
      }

      const finalStatus = gotoResponse?.status() ?? statusCode;
      
      if (gotoResponse && gotoResponse.status() >= 400) {
        return {
          status: 'FAIL',
          statusCode: finalStatus,
          failureReason: `HTTP ${finalStatus} returned from page.goto()`,
        };
      }

      // Wait for network to stabilize
      try {
        await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.NETWORK_IDLE }).catch(() => {});
      } catch (e) {
        // Network idle timeout is not critical
      }

      // Validate page has meaningful content
      try {
        const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
        if (!bodyText || bodyText.trim().length < 50) {
          return {
            status: 'FAIL',
            statusCode: finalStatus,
            failureReason: 'Page contains insufficient content (< 50 characters)',
          };
        }
      } catch (e) {
        return {
          status: 'FAIL',
          statusCode: finalStatus,
          failureReason: 'Could not validate page content',
        };
      }

      // Check for common error indicators
      try {
        const hasErrorIndicator = await page.evaluate(() => {
          const pageText = document.body.innerText.toLowerCase();
          const errorPatterns = ['404', 'not found', 'error', 'failed to load', 'page not available'];
          return errorPatterns.some(pattern => pageText.includes(pattern));
        }).catch(() => false);

        if (hasErrorIndicator) {
          log(`Warning: Potential error page detected for ${url}`);
        }
      } catch (e) {
        // Error detection is not critical
      }

      return { status: 'PASS', statusCode: finalStatus };
    } catch (e: any) {
      const message = e?.message || String(e);
      return {
        status: 'FAIL',
        statusCode: 'Unknown Error',
        failureReason: message || 'Unknown error occurred',
      };
    }
  }

  private createReportRow(row: NavigationRow, totalLevels: number): NavigationReportRow {
    // Use actualLevels from the row, not the global totalLevels
    const levelStatuses: any = {};
    for (let i = 1; i <= row.actualLevels; i++) {
      levelStatuses[`level${i}`] = {
        componentExists: 'N',
        status: 'PENDING' as const,
      };
    }

    return {
      ...row,
      levelStatuses,
    };
  }

  private async validateLevelRecursively(
    page: Page,
    request: APIRequestContext,
    levelNode: LevelNode,
    rows: NavigationReportRow[],
    baseURL: string | undefined,
    totalLevels: number,
    parentLevelUrl?: string
  ): Promise<Page> {
    const levelNumber = levelNode.level;
    let currentPage = page;
    
    // Use actual levels from the first row in this group
    const actualLevels = rows.length > 0 ? rows[0].actualLevels : totalLevels;
    
    // Stop if we've gone beyond the actual levels for these rows
    if (levelNumber > actualLevels) {
      return currentPage;
    }
    
    if (levelNumber >= actualLevels) {
      // Leaf level - validate the final URL
      for (const row of rows) {
        const outcome = await this.openPage(currentPage, request, row.levels[levelNumber - 1]);
        const levelKey = `level${levelNumber}`;
        row.levelStatuses[levelKey] = {
          componentExists: outcome.status === 'PASS' ? 'Y' : 'N',
          statusCode: outcome.statusCode,
          status: outcome.status,
        };
        if (outcome.status === 'FAIL') {
          row.failureReason = outcome.failureReason || `Level_${levelNumber} page failed to load`;
          await this.takeFailureScreenshot(currentPage, row, levelNumber, 'load-failed');
        }
      }
      if (rows.length > 0 && rows[0].levelStatuses[`level${levelNumber}`].status === 'PASS') {
        log(`Level_${levelNumber} PASS`, rows[0].levels[levelNumber - 1]);
      }
      return currentPage;
    }

    // Navigate to current level
    const levelUrl = rows[0]?.levels[levelNumber - 1];
    log(`Opening Level_${levelNumber}`, levelUrl);

    const outcome = await this.openPage(currentPage, request, levelUrl);
    const levelKey = `level${levelNumber}`;

    for (const row of rows) {
      row.levelStatuses[levelKey] = {
        componentExists: outcome.status === 'PASS' ? 'Y' : 'N',
        statusCode: outcome.statusCode,
        status: outcome.status,
      };
      if (outcome.status === 'FAIL') {
        row.failureReason = outcome.failureReason || `Level_${levelNumber} page failed to load`;
        // Mark all deeper levels as failed (only up to actualLevels)
        for (let i = levelNumber + 1; i <= row.actualLevels; i++) {
          row.levelStatuses[`level${i}`] = {
            componentExists: 'N',
            statusCode: 'N/A',
            status: 'FAIL',
          };
        }
        await this.takeFailureScreenshot(currentPage, row, levelNumber, 'failed');
      }
    }

    if (outcome.status === 'FAIL') {
      log(`Level_${levelNumber} FAIL`, levelUrl, outcome.failureReason);
      return currentPage;
    }

    // Process children (next levels)
    for (const childNode of levelNode.children) {
      const childRows = childNode.rows.map((row) => this.reportRows[row.sourceIndex]);
      if (childRows.length === 0) continue;

      currentPage = await this.ensurePage(currentPage);
      const childUrl = childRows[0].levels[childNode.level - 1];
      log(`Searching Level_${childNode.level}`, childUrl);

      const childLink = await this.findLinkByHref(currentPage, childUrl, baseURL);
      if (!childLink) {
        for (const row of childRows) {
          const childLevelKey = `level${childNode.level}`;
          row.levelStatuses[childLevelKey] = {
            componentExists: 'N',
            statusCode: 'N/A',
            status: 'FAIL',
          };
          row.failureReason = `Level_${childNode.level} URL not found on Level_${levelNumber} page`;
          await this.takeFailureScreenshot(currentPage, row, childNode.level, 'not-found');
        }
        log(`Level_${childNode.level} missing`, childUrl);
        continue;
      }

      log(`Navigating Level_${childNode.level}`, childUrl);
      let clickSuccess = await this.clickLinkWithRetry(currentPage, childLink, childUrl);
      
      let navigationOutcome: NavigationOutcome | null = null;
      
      // If click failed, try direct navigation instead
      if (!clickSuccess) {
        log(`Failed to click Level_${childNode.level} link, attempting direct navigation:`, childUrl);
        navigationOutcome = await this.openPage(currentPage, request, childUrl);
        
        if (navigationOutcome.status === 'PASS') {
          log(`Direct navigation succeeded for Level_${childNode.level}:`, childUrl);
          clickSuccess = true; // Mark as success since we reached the page via direct nav
          currentPage = await this.ensurePage(currentPage);
        } else {
          log(`Direct navigation failed for Level_${childNode.level}:`, childUrl);
        }
      }
      
      if (!clickSuccess) {
        log(`Failed to navigate to Level_${childNode.level} (both click and direct nav):`, childUrl);
        for (const row of childRows) {
          const childLevelKey = `level${childNode.level}`;
          row.levelStatuses[childLevelKey] = {
            componentExists: 'Y',
            statusCode: navigationOutcome?.statusCode || 'Navigation Failed',
            status: 'FAIL',
          };
          row.failureReason = navigationOutcome?.failureReason || `Failed to navigate to Level_${childNode.level} URL`;
          await this.takeFailureScreenshot(currentPage, row, childNode.level, 'click-failed');
        }
        continue;
      }
      
      // Update status for successful navigation to child level
      for (const row of childRows) {
        const childLevelKey = `level${childNode.level}`;
        row.levelStatuses[childLevelKey] = {
          componentExists: 'Y',
          statusCode: '200',
          status: 'PASS',
        };
      }

      // Recursively validate deeper levels
      currentPage = await this.validateLevelRecursively(
        currentPage,
        request,
        childNode,
        childRows,
        baseURL,
        totalLevels,
        levelUrl
      );

      // Return to parent level
      if (levelNumber > 0) {
        currentPage = await this.ensurePage(currentPage);
        await currentPage.goto(levelUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.PAGE_GOTO }).catch(() => undefined);
        try {
          await currentPage.waitForLoadState('networkidle', { timeout: TIMEOUTS.NETWORK_IDLE }).catch(() => {});
        } catch (e) {
          // Network idle timeout is not critical
        }
      }
    }

    return currentPage;
  }

  async run(page: Page, request: APIRequestContext): Promise<string> {
    const plan = await this.navService.loadAndGroup();
    this.reportRows = plan.rows.map((row) => this.createReportRow(row, plan.totalLevels));

    log(`Starting validation for ${plan.labels.length} label(s) with ${plan.rows.length} total rows`);
    const baseURL = process.env.BASE_URL || undefined;
    let currentPage = page;

    for (const labelNode of plan.labels) {
      log('Processing label', labelNode.label);

      const labelRows = plan.rows.filter((row) => row.label === labelNode.label);
      
      // Get root level nodes
      for (const rootChild of labelNode.root.children) {
        const nodeRows = rootChild.rows.map((row) => this.reportRows[row.sourceIndex]);
        if (nodeRows.length === 0) continue;

        currentPage = await this.ensurePage(currentPage);
        
        currentPage = await this.validateLevelRecursively(
          currentPage,
          request,
          rootChild,
          nodeRows,
          baseURL,
          plan.totalLevels
        );
      }

      log(`Finished Label ${labelNode.label}`);
    }

    const reportPath = await generateHtmlReport(this.reportRows);
    log(`Report generated at ${reportPath}`);
    return reportPath;
  }
}
