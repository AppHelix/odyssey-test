import { test } from '@playwright/test';
import { NavigationService } from '../services/navigation.service';
import { NavigationValidator } from '../services/navigation-validator';
import { log } from '../utils/logger';

const excelPath = process.env.NAVIGATION_URLS_FILE || process.env.INPUT_EXCEL || './data/navigation.xlsx';

test.setTimeout(1800000);

test('Data-driven navigation validation', async ({ page, request }) => {
  log('Reading Excel at', excelPath);
  const navService = new NavigationService(excelPath);
  const validator = new NavigationValidator(navService);
  const report = await validator.run(page, request);
  log('Navigation validation completed. Report:', report);
});
