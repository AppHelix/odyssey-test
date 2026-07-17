import diff from "fast-diff";

/**
 * String similarity + inline-diff rendering, built on `fast-diff`. Kept in its own module so the
 * scoring metric can be swapped without touching the comparator.
 */

/**
 * Character-level similarity in [0,1] based on fast-diff's edit script.
 * 1 = identical, 0 = nothing in common. Uses common / max(len) so that large insertions or
 * deletions are penalized (a short string embedded in a long one does not score ~1).
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const parts = diff(a, b);
  let common = 0;
  for (const [op, text] of parts) {
    if (op === diff.EQUAL) common += text.length;
  }
  return common / Math.max(a.length, b.length);
}

/**
 * Renders a compact inline diff between two strings for the report:
 * unchanged text as-is, deletions (legacy-only) as [-…-], insertions (odyssey-only) as {+…+}.
 */
export function inlineDiff(a: string, b: string): string {
  const parts = diff(a, b);
  let out = "";
  for (const [op, text] of parts) {
    if (op === diff.EQUAL) out += text;
    else if (op === diff.DELETE) out += `[-${text}-]`;
    else out += `{+${text}+}`;
  }
  return out;
}
