/**
 * Text normalization used before comparison. Collapses the incidental differences between the
 * two sites' rendered text (whitespace, non-breaking spaces, smart quotes/dashes) so the
 * comparator only flags genuine content differences. Lifts the normalization idiom used across
 * validations/semantic.validator.ts into one reusable place.
 */

/** Canonicalize visible text: unify unicode punctuation/spaces and collapse whitespace. */
export function normalizeText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/ /g, " ") // non-breaking space -> space
    .replace(/[‘’‛]/g, "'") // smart single quotes -> '
    .replace(/[“”]/g, '"') // smart double quotes -> "
    .replace(/[–—]/g, "-") // en/em dash -> hyphen
    .replace(/…/g, "...") // ellipsis -> ...
    .replace(/\s+/g, " ") // collapse all whitespace runs
    .trim();
}

/** Normalize further for comparison purposes (optionally case-insensitive). */
export function normalizeForCompare(raw: string | null | undefined, ignoreCase = true): string {
  const n = normalizeText(raw);
  return ignoreCase ? n.toLowerCase() : n;
}
