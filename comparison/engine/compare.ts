import type {
  NormalizedComponent,
  NormalizedField,
  ComponentDiff,
  FieldDiff,
  ParityStatus,
} from "./types";
import { normalizeText } from "./normalize";
import { similarity, inlineDiff } from "./similarity";

/**
 * GENERIC comparison engine. Diffs two NormalizedComponents into a ComponentDiff, treating
 * LEGACY as the source of truth. It operates purely on normalized data — no DOM, no selectors,
 * no knowledge of which page/component/site it is comparing. All page-specific and
 * selector-specific concerns live in the mappings layer, upstream of this file.
 */

export interface CompareOptions {
  /** 0..1 similarity at/above which two texts are considered a match. */
  matchThreshold: number;
  /** Compare case-insensitively. */
  ignoreCase: boolean;
}

/** Below this similarity, two list items are considered unrelated (not a modified pairing). */
const PAIRING_FLOOR = 0.2;

/**
 * Compare one component across sites.
 * `legacyMapped` is false when the legacy selectors were never authored (TODO placeholder):
 * the component is reported "unmapped" (N/A) and excluded from scoring.
 */
export function compareComponents(
  legacy: NormalizedComponent,
  odyssey: NormalizedComponent,
  opts: CompareOptions,
  legacyMapped: boolean
): ComponentDiff {
  const type = legacy.type || odyssey.type;
  const label = legacy.label || odyssey.label;
  // Per-side presence + an identifying snippet, retained on every branch (even one-sided ones,
  // where `fields` is empty) so the reporter can label a component that exists on only one site.
  const meta = {
    odysseyPresent: odyssey.present,
    legacyPresent: legacy.present,
    legacyMapped,
    odysseySnippet: deriveSnippet(odyssey),
    legacySnippet: deriveSnippet(legacy),
  };

  if (!legacyMapped) {
    return { type, label, status: "unmapped", fields: [], parityScore: 1, ...meta };
  }
  if (legacy.present && !odyssey.present) {
    return { type, label, status: "component-missing", fields: [], parityScore: 0, ...meta };
  }
  if (!legacy.present && odyssey.present) {
    return { type, label, status: "component-extra", fields: [], parityScore: 0, ...meta };
  }
  if (!legacy.present && !odyssey.present) {
    return { type, label, status: "match", fields: [], parityScore: 1, ...meta };
  }

  const names = unionByName(legacy.fields, odyssey.fields);
  const fields = names.map((name) =>
    compareField(findField(legacy.fields, name), findField(odyssey.fields, name), opts)
  );
  const parityScore = scoreFields(fields);
  const status = rollUpStatus(fields);
  return { type, label, status, fields, parityScore, ...meta };
}

/** Short identifying text for a component: a heading-like field, else the first non-empty value. */
function deriveSnippet(c: NormalizedComponent): string {
  if (!c.present) return "";
  const firstValue = (f: NormalizedField): string => f.values.find((v) => normalizeText(v)) ?? "";
  for (const name of ["heading", "title", "question"]) {
    const f = c.fields.find((f) => f.name === name);
    const v = f ? firstValue(f) : "";
    if (v) return truncateSnippet(normalizeText(v));
  }
  for (const f of c.fields) {
    const v = firstValue(f);
    if (v) return truncateSnippet(normalizeText(v));
  }
  return "";
}

function truncateSnippet(s: string, n = 100): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** Average component parity across a page, ignoring unmapped components. */
export function pageParityScore(components: ComponentDiff[]): number {
  const scored = components.filter((c) => c.status !== "unmapped");
  if (scored.length === 0) return 1;
  return scored.reduce((acc, c) => acc + c.parityScore, 0) / scored.length;
}

// ---------------------------------------------------------------------------
// Field comparison
// ---------------------------------------------------------------------------

function compareField(
  legacy: NormalizedField | undefined,
  odyssey: NormalizedField | undefined,
  opts: CompareOptions
): FieldDiff {
  const name = (legacy || odyssey)!.name;
  const kind = legacy?.kind ?? odyssey?.kind ?? "text";
  const optional = !!(legacy?.optional || odyssey?.optional);

  // An optional field that the candidate (odyssey) omits is not a defect.
  if (optional && isEmpty(odyssey)) {
    return {
      name,
      status: "match",
      legacy: displayValues(legacy),
      odyssey: [],
      similarity: 1,
      ...(kind === "list" ? { children: [] } : {}),
    };
  }

  if (kind === "list") {
    // A field flagged compareAsText is prose whose split across multiple elements (e.g. several
    // <p> tags) is a formatting choice, not a semantically distinct list — comparing it as an
    // aligned list would flag a count mismatch (one side splits into bullets, the other doesn't)
    // as several "missing"/"extra" items even when the actual content substantively overlaps.
    // Join each side into one block and compare holistically instead.
    if (legacy?.compareAsText || odyssey?.compareAsText) {
      const joined = (f: NormalizedField | undefined) => (f ? f.values.join(" ") : "");
      return compareTextField(name, joined(legacy), joined(odyssey), opts);
    }
    return compareListField(name, legacy, odyssey, opts);
  }
  return compareTextField(name, legacy?.values[0] ?? "", odyssey?.values[0] ?? "", opts);
}

function compareTextField(
  name: string,
  legacyRaw: string,
  odysseyRaw: string,
  opts: CompareOptions
): FieldDiff {
  const lDisp = normalizeText(legacyRaw);
  const oDisp = normalizeText(odysseyRaw);
  const l = opts.ignoreCase ? lDisp.toLowerCase() : lDisp;
  const o = opts.ignoreCase ? oDisp.toLowerCase() : oDisp;

  let status: ParityStatus;
  let sim = 0;
  let inline: string | undefined;

  if (!l && !o) {
    status = "match";
    sim = 1;
  } else if (l && !o) {
    status = "missing";
  } else if (!l && o) {
    status = "extra";
  } else {
    sim = similarity(l, o);
    if (sim >= opts.matchThreshold) {
      status = "match";
    } else {
      status = "modified";
      inline = inlineDiff(lDisp, oDisp);
    }
  }

  return {
    name,
    status,
    legacy: lDisp ? [lDisp] : [],
    odyssey: oDisp ? [oDisp] : [],
    similarity: sim,
    inlineDiff: inline,
  };
}

// ---------------------------------------------------------------------------
// List comparison (order-tolerant, greedy best-match alignment)
// ---------------------------------------------------------------------------

interface ListItem {
  /** Normalized text used for alignment + scoring. */
  signature: string;
  /** Display text for the report. */
  raw: string;
  /** Structured sub-fields, when the list items declared itemFields. */
  subFields?: NormalizedField[];
}

function compareListField(
  name: string,
  legacy: NormalizedField | undefined,
  odyssey: NormalizedField | undefined,
  opts: CompareOptions
): FieldDiff {
  const L = toItems(legacy, opts.ignoreCase);
  const O = toItems(odyssey, opts.ignoreCase);

  const children: FieldDiff[] = [];
  if (L.length === 0 && O.length === 0) {
    return { name, status: "match", legacy: [], odyssey: [], similarity: 1, children };
  }

  const usedO = new Set<number>();
  for (let li = 0; li < L.length; li++) {
    let bestO = -1;
    let bestSim = 0;
    for (let oi = 0; oi < O.length; oi++) {
      if (usedO.has(oi)) continue;
      const s = similarity(L[li].signature, O[oi].signature);
      if (s > bestSim) {
        bestSim = s;
        bestO = oi;
      }
    }
    if (bestO >= 0 && bestSim >= PAIRING_FLOOR) {
      usedO.add(bestO);
      children.push(compareItem(`${name} item`, L[li], O[bestO], opts));
    } else {
      children.push(itemOnly(`${name} item`, "missing", L[li]));
    }
  }
  for (let oi = 0; oi < O.length; oi++) {
    if (!usedO.has(oi)) children.push(itemOnly(`${name} item`, "extra", O[oi]));
  }

  const score = scoreFields(children);
  return {
    name,
    status: rollUpStatus(children),
    legacy: L.map((i) => i.raw),
    odyssey: O.map((i) => i.raw),
    similarity: score,
    children,
  };
}

/** Compare a matched pair of list items (structured sub-fields when available, else text). */
function compareItem(name: string, l: ListItem, o: ListItem, opts: CompareOptions): FieldDiff {
  if (l.subFields && o.subFields) {
    const names = unionByName(l.subFields, o.subFields);
    const children = names.map((n) =>
      compareField(findField(l.subFields!, n), findField(o.subFields!, n), opts)
    );
    return {
      name,
      status: rollUpStatus(children),
      legacy: [l.raw],
      odyssey: [o.raw],
      similarity: scoreFields(children),
      children,
    };
  }
  return compareTextField(name, l.raw, o.raw, opts);
}

function itemOnly(name: string, status: ParityStatus, item: ListItem): FieldDiff {
  return {
    name,
    status,
    legacy: status === "missing" ? [item.raw] : [],
    odyssey: status === "extra" ? [item.raw] : [],
    similarity: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toItems(field: NormalizedField | undefined, ignoreCase: boolean): ListItem[] {
  if (!field) return [];
  return field.values.map((v, i) => {
    const subFields = field.items?.[i];
    const sigSource = subFields ? subFields.map((f) => f.values.join(" ")).join(" · ") : v;
    const disp = normalizeText(sigSource);
    return {
      signature: ignoreCase ? disp.toLowerCase() : disp,
      raw: normalizeText(v) || disp,
      subFields,
    };
  });
}

function unionByName(a: { name: string }[], b: { name: string }[]): string[] {
  const names: string[] = [];
  for (const f of a) if (!names.includes(f.name)) names.push(f.name);
  for (const f of b) if (!names.includes(f.name)) names.push(f.name);
  return names;
}

function findField(fields: NormalizedField[], name: string): NormalizedField | undefined {
  return fields.find((f) => f.name === name);
}

function isEmpty(field: NormalizedField | undefined): boolean {
  if (!field) return true;
  if (field.kind === "list") return field.values.filter((v) => normalizeText(v)).length === 0;
  return !normalizeText(field.values[0] ?? "");
}

function displayValues(field: NormalizedField | undefined): string[] {
  if (!field) return [];
  return field.values.map((v) => normalizeText(v)).filter(Boolean);
}

/** Partial credit per field: match=1, modified=similarity, missing/extra=0, unmapped ignored. */
function scoreFields(fields: FieldDiff[]): number {
  const scored = fields.filter((f) => f.status !== "unmapped");
  if (scored.length === 0) return 1;
  const total = scored.reduce((acc, f) => acc + fieldScore(f), 0);
  return total / scored.length;
}

function fieldScore(f: FieldDiff): number {
  switch (f.status) {
    case "match":
    case "unmapped":
      return 1;
    case "modified":
      return f.similarity;
    default:
      return 0;
  }
}

/** Roll up a set of child diffs into a single status. */
function rollUpStatus(children: FieldDiff[]): ParityStatus {
  const real = children.filter((c) => c.status !== "unmapped");
  if (real.length === 0) return "match";
  if (real.every((c) => c.status === "match")) return "match";

  const hasMissing = real.some((c) => c.status === "missing" || c.status === "component-missing");
  const hasExtra = real.some((c) => c.status === "extra" || c.status === "component-extra");
  const hasModified = real.some((c) => c.status === "modified");

  if (hasModified || (hasMissing && hasExtra)) return "modified";
  if (hasMissing) return "missing";
  if (hasExtra) return "extra";
  return "modified";
}
