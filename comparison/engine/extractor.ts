import type { Page, Locator } from "@playwright/test";
import type { ComponentSelectorSet, FieldSpec } from "../mappings/types";
import type { NormalizedComponent, NormalizedField } from "./types";
import { normalizeText } from "./normalize";

/**
 * Default bound for the presence wait below. Deliberately small: fixture-backed self-tests have no
 * real network/render delay, so a genuinely-absent component should resolve almost immediately —
 * a large default here would add real seconds to every "reports absent" self-test. Live comparison
 * runs (`content-comparison.spec.ts`) explicitly pass a much larger value via `opts.presenceTimeoutMs`
 * (see that call site for why).
 */
const DEFAULT_PRESENCE_WAIT_MS = 500;

/**
 * GENERIC extractor. Turns a (site-specific) ComponentSelectorSet into a uniform
 * NormalizedComponent by reading the rendered DOM. It knows nothing about which page or component
 * it is extracting — every specific lives in the selector set. Returns present:false when the
 * component is not on the page, or when the mapping is null (an unauthored legacy placeholder).
 */
export async function extractComponent(
  page: Page,
  type: string,
  label: string,
  set: ComponentSelectorSet | null,
  opts?: { presenceTimeoutMs?: number }
): Promise<NormalizedComponent> {
  if (!set) return { type, label, present: false, fields: [] };

  const matches = page.locator(set.root);
  const root = set.pick === "last" ? matches.last() : matches.first();
  // Root presence is awaited (bounded), not `.count()`-checked instantly: `.count()` reflects only
  // the DOM at the exact instant it's called, with no auto-wait. Confirmed via a live diagnostic
  // against a real course page that several components (Course Hero, About This Course, Course
  // Pricing) can render client-side several seconds AFTER `page.waitForLoadState("networkidle")` +
  // a full auto-scroll pass have both already settled — an instant `.count()` check raced ahead of
  // that render and misreported them as absent (a false "component-missing"/"Odyssey only" result),
  // even though the exact same selector resolves correctly moments later. This affects every
  // component uniformly (not a per-mapping fix) since the underlying race is in the engine, not any
  // one selector.
  try {
    await root.waitFor({ state: "attached", timeout: opts?.presenceTimeoutMs ?? DEFAULT_PRESENCE_WAIT_MS });
  } catch {
    return { type, label, present: false, fields: [] };
  }

  if (set.extract) {
    const fields = await set.extract(root);
    if (fields === null) return { type, label, present: false, fields: [] };
    return { type, label, present: true, fields };
  }

  const fields = await extractFields(root, set.fields);
  return { type, label, present: true, fields };
}

/** Extract each field spec relative to a scope locator. */
async function extractFields(scope: Locator, specs: FieldSpec[]): Promise<NormalizedField[]> {
  const out: NormalizedField[] = [];
  for (const spec of specs) {
    out.push(await extractField(scope, spec));
  }
  return out;
}

/** Extract a single field (text | list, with optional nested item fields). */
async function extractField(scope: Locator, spec: FieldSpec): Promise<NormalizedField> {
  const locator = resolveLocator(scope, spec.selector);

  if (spec.kind === "text") {
    const count = await locator.count();
    const text = count > 0 ? normalizeText(await locator.first().textContent()) : "";
    return { name: spec.name, kind: "text", values: [text], optional: spec.optional };
  }

  // list: every match is a value; recurse into item sub-fields when declared. Entries that
  // normalize to empty (e.g. a stray trailing `<p></p>` left by a WYSIWYG editor) are dropped so
  // they never masquerade as a spurious mismatch during comparison.
  const count = await locator.count();
  const values: string[] = [];
  const itemFieldSets: NormalizedField[][] = [];
  const hasItemFields = !!(spec.itemFields && spec.itemFields.length > 0);
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i);
    const text = normalizeText(await item.textContent());
    if (text === "") continue;
    values.push(text);
    if (hasItemFields) {
      itemFieldSets.push(await extractFields(item, spec.itemFields!));
    }
  }

  const field: NormalizedField = { name: spec.name, kind: "list", values, optional: spec.optional };
  if (hasItemFields) field.items = itemFieldSets;
  if (spec.compareAsText) field.compareAsText = true;
  return field;
}

/** ":scope" (or "&" / ".") means the scope element itself; otherwise resolve relative to scope. */
function resolveLocator(scope: Locator, selector: string): Locator {
  if (selector === ":scope" || selector === "&" || selector === ".") return scope;
  return scope.locator(selector);
}
