import { Page, APIRequestContext, expect } from "@playwright/test";
import { verifyHttpStatus } from "../utils/network";

export type HealthCheckType = "redirect" | "navigation";

export interface HealthCheckDefinition {
  type: HealthCheckType;
  name: string;
  validate: (
    page: Page,
    requestContext: APIRequestContext,
    url: string,
    expectedStatus: number,
    expectedRedirectUrl: string | undefined,
    baseUrl: string | undefined
  ) => Promise<void>;
}

// Configurable list of active health checks. Comment out elements to toggle checks.
export const ACTIVE_HEALTH_CHECKS: HealthCheckType[] = [
  "redirect",
  "navigation",
];

/**
 * Validates the health (HTTP response status) of a page.
 */
export async function validatePageHealth(
  page: Page,
  requestContext: APIRequestContext,
  url: string,
  expectedStatus: number = 200,
  expectedRedirectUrl?: string,
  baseUrl?: string
): Promise<void> {
  const isRedirect = expectedStatus >= 300 && expectedStatus < 400;

  for (const checkType of ACTIVE_HEALTH_CHECKS) {
    if (isRedirect && checkType !== "redirect") {
      continue;
    }
    if (!isRedirect && checkType !== "navigation") {
      continue;
    }

    const check = HEALTH_CHECK_REGISTRY[checkType];
    if (check) {
      await check.validate(page, requestContext, url, expectedStatus, expectedRedirectUrl, baseUrl);
    }
  }
}

/**
 * Registry mapping health check types to their respective execution logic.
 */
const HEALTH_CHECK_REGISTRY: Record<HealthCheckType, HealthCheckDefinition> = {
  redirect: {
    type: "redirect",
    name: "HTTP Redirect Verification",
    validate: async (page, requestContext, url, expectedStatus, expectedRedirectUrl, baseUrl) => {
      const result = await verifyHttpStatus(requestContext, url, expectedStatus, {
        baseUrl,
        maxRedirects: 0,
      });

      expect(result.success, `Redirect health check failed for ${url}: ${result.error}`).toBe(true);

      if (expectedRedirectUrl && result.headers) {
        const location = result.headers["location"];
        expect(location, `Redirect URL missing Location header`).toBeDefined();

        const targetBase = baseUrl || "http://localhost:3000";
        const resolvedLocation = new URL(location!, targetBase).pathname;
        const resolvedExpected = new URL(expectedRedirectUrl, targetBase).pathname;

        expect(
          resolvedLocation,
          `Expected redirect location to be ${resolvedExpected}, but got ${resolvedLocation}`
        ).toBe(resolvedExpected);
      }
    },
  },
  navigation: {
    type: "navigation",
    name: "Browser Navigation Health",
    validate: async (page, requestContext, url, expectedStatus, expectedRedirectUrl, baseUrl) => {
      const targetUrl = baseUrl && !url.startsWith("http://") && !url.startsWith("https://")
        ? new URL(url, baseUrl).toString()
        : url;

      const response = await page.goto(targetUrl);
      expect(response, `Failed to load page: response was null for ${targetUrl}`).not.toBeNull();
      expect(
        response!.status(),
        `Expected status ${expectedStatus} for ${targetUrl}, but got ${response!.status()}`
      ).toBe(expectedStatus);
    },
  },
};
