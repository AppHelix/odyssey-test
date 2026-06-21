import { APIRequestContext } from "@playwright/test";

export interface HttpStatusVerificationResult {
  success: boolean;
  status: number;
  error?: string;
  headers?: Record<string, string>;
}

/**
 * Validates that a string is a valid URL syntactically.
 * If a baseUrl is provided, checks if it can be resolved as a valid relative URL.
 */
export function isValidUrl(urlStr: string, baseUrl?: string): boolean {
  try {
    new URL(urlStr, baseUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Performs a direct HTTP GET request to verify the response status code.
 * If expectedStatus is 3xx, redirects are not followed by default to verify the redirect itself.
 */
export async function verifyHttpStatus(
  requestContext: APIRequestContext,
  url: string,
  expectedStatus: number = 200,
  options?: {
    baseUrl?: string;
    maxRedirects?: number;
  }
): Promise<HttpStatusVerificationResult> {
  try {
    const targetUrl = options?.baseUrl && !url.startsWith("http://") && !url.startsWith("https://")
      ? new URL(url, options.baseUrl).toString()
      : url;

    // By default, if expecting a redirect (3xx), do not follow redirects
    const isRedirectExpected = expectedStatus >= 300 && expectedStatus < 400;
    const maxRedirects = options?.maxRedirects !== undefined
      ? options.maxRedirects
      : (isRedirectExpected ? 0 : undefined);

    const response = await requestContext.get(targetUrl, {
      maxRedirects,
    });

    const status = response.status();
    if (status === expectedStatus) {
      return { success: true, status, headers: response.headers() };
    } else {
      return {
        success: false,
        status,
        error: `Expected status ${expectedStatus}, but got ${status}`,
        headers: response.headers(),
      };
    }
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      error: err.message || String(err),
    };
  }
}

/**
 * Fetches the sitemap, extracts all URLs using regex, and returns them rewritten
 * as relative paths (so they run against the local baseURL).
 */
export async function fetchAndParseSitemap(
  requestContext: APIRequestContext,
  sitemapUrl: string,
  baseUrl: string
): Promise<string[]> {
  const targetUrl = sitemapUrl.startsWith("http://") || sitemapUrl.startsWith("https://")
    ? sitemapUrl
    : new URL(sitemapUrl, baseUrl).toString();

  const response = await requestContext.get(targetUrl);
  if (!response.ok()) {
    throw new Error(`Failed to fetch sitemap from ${targetUrl}: ${response.status()} ${response.statusText()}`);
  }

  const text = await response.text();
  const locRegex = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
  const urls: string[] = [];
  let match;
  while ((match = locRegex.exec(text)) !== null) {
    urls.push(match[1]);
  }

  // Rewrite URLs to be relative paths (so they can be combined with baseURL)
  return urls.map((url) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      return url; // fallback to original if parsing fails
    }
  });
}
