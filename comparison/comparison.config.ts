import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load .env with override:true so it is the single source of truth, mirroring
// config/page-validation.config.ts and the rest of the framework.
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

/** Runtime configuration for a content-parity run. */
export interface CompareConfig {
  /** Odyssey origin, no trailing slash (e.g. https://odyssey.stage.edx.org). */
  odysseyBaseUrl: string;
  /** Legacy origin, no trailing slash (e.g. https://www.edx.org). */
  legacyBaseUrl: string;
  /** 0..1 similarity at/above which two texts count as a match. */
  matchThreshold: number;
  /** Compare case-insensitively. */
  ignoreCase: boolean;
}

/** One legacy↔odyssey page pair to compare. Paths are relative and applied to each origin. */
export interface UrlPair {
  name?: string;
  /** Route pattern key into MAP_REGISTRY, e.g. "learn/[slug]". */
  pageType: string;
  /** Odyssey path, e.g. "/learn/blender". */
  odyssey: string;
  /** Legacy path, e.g. "/learn/blender". */
  legacy: string;
}

/**
 * One entry from config/urls.json. Shared with the page-validation suite
 * (tests/page-validation.spec.ts), which only ever reads `url`/`expectedStatus`/
 * `expectedRedirectUrl` and ignores the rest — so `pageType`/`name`/`legacyUrl` are safe
 * comparison-only additions on the SAME entries, not a second parallel file to keep in sync.
 * A plain string entry (no comparison metadata) is valid too; it's just skipped here.
 */
interface UrlsJsonEntry {
  url?: string;
  /** Route pattern key into MAP_REGISTRY — entries without this are validator-only, not compared. */
  pageType?: string;
  name?: string;
  /** Only needed when the legacy path genuinely differs from `url`; defaults to `url` otherwise. */
  legacyUrl?: string;
}

const stripTrailingSlash = (u: string): string => u.replace(/\/+$/, "");

function clamp01(raw: string | undefined, fallback: number): number {
  const n = parseFloat(raw ?? "");
  if (Number.isNaN(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export const compareConfig: CompareConfig = {
  odysseyBaseUrl: stripTrailingSlash(
    process.env.ODYSSEY_BASE_URL || process.env.BASE_URL || "https://odyssey.stage.edx.org"
  ),
  legacyBaseUrl: stripTrailingSlash(process.env.LEGACY_BASE_URL || "https://www.edx.org"),
  matchThreshold: clamp01(process.env.MATCH_THRESHOLD, 0.95),
  ignoreCase: (process.env.COMPARE_IGNORE_CASE || "true").trim().toLowerCase() !== "false",
};

// Same file (and same env var) the page-validation suite uses for its manual URL list — see
// tests/page-validation.spec.ts. One list, not two kept in sync by hand.
const URLS_FILE = process.env.URLS_FILE || "config/urls.json";

/**
 * Load the legacy↔odyssey URL pairs from config/urls.json (empty array if absent/invalid).
 * Only entries with a `pageType` participate in comparison — plain strings and objects without
 * one are validator-only (health/seo/header/footer/semantic) and are silently skipped here.
 */
export function loadUrlPairs(): UrlPair[] {
  const file = path.resolve(process.cwd(), URLS_FILE);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(parsed)) return [];
    const pairs: UrlPair[] = [];
    for (const entry of parsed as UrlsJsonEntry[]) {
      if (!entry || typeof entry !== "object" || !entry.pageType || !entry.url) continue;
      pairs.push({
        name: entry.name,
        pageType: entry.pageType,
        odyssey: entry.url,
        legacy: entry.legacyUrl || entry.url,
      });
    }
    return pairs;
  } catch {
    return [];
  }
}
