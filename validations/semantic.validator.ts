import { Page, expect, test } from "@playwright/test";
import { SemanticValidationConfig, LandmarkName } from "../config/page-validation.config";

/**
 * Three-level registry:
 *   validator (semantic)  ->  section (document, headings, ...)  ->  rule (single check)
 *
 * - Sections are selected via ACTIVE_SEMANTIC_CHECKS (see config).
 * - Each section declares a `gather` (one batched DOM read) and a `rules` array.
 * - Each rule is an independently add/removable entry: it has a stable `key`, a report
 *   `name`, `remediation` text, an `enabled(cfg)` predicate (usually reading its config
 *   flag), and a pure `evaluate(snapshot, cfg)` that returns violation messages.
 *
 * To REMOVE a rule: set its config flag to false (globally in semanticDefaults or per-URL),
 * or delete its entry from the section's `rules` array.
 * To ADD a rule: push a new entry onto the relevant section's `rules` array (and, if it
 * needs new data, extend that section's snapshot). It then runs and appears in the report
 * automatically.
 */

// ---------------------------------------------------------------------------
// Rule / section registry types
// ---------------------------------------------------------------------------

// A section key is a key of the semantic config shape (== a section name). The public
// SemanticCheckType union is DERIVED from the registry further below (single source of truth).
type SectionKey = keyof SemanticValidationConfig;
type SectionCfgOf<K extends SectionKey> = NonNullable<SemanticValidationConfig[K]>;

export interface SemanticRule<Snap, Cfg> {
  key: string;
  name: string;
  remediation: string;
  enabled: (cfg: Cfg) => boolean;
  evaluate: (snapshot: Snap, cfg: Cfg) => string[];
}

export interface SemanticSection<Snap, Cfg> {
  type: SectionKey;
  configKey: SectionKey;
  gather: (page: Page, cfg: Cfg) => Promise<Snap>;
  rules: SemanticRule<Snap, Cfg>[];
}

// Helper to author a strongly-typed section that still slots into a loosely-typed registry.
function defineSection<K extends SectionKey, Snap>(
  section: SemanticSection<Snap, SectionCfgOf<K>>
): SemanticSection<Snap, SectionCfgOf<K>> {
  return section;
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/**
 * WAI-ARIA 1.2 role names (lowercased). Used by the ARIA "valid roles" rule. Update if
 * the ARIA spec adds/removes roles.
 */
const VALID_ARIA_ROLES: string[] = [
  "button", "checkbox", "gridcell", "link", "menuitem", "menuitemcheckbox", "menuitemradio",
  "option", "progressbar", "radio", "scrollbar", "searchbox", "separator", "slider",
  "spinbutton", "switch", "tab", "tabpanel", "textbox", "treeitem",
  "combobox", "grid", "listbox", "menu", "menubar", "radiogroup", "tablist", "tree", "treegrid",
  "application", "article", "blockquote", "caption", "cell", "code", "columnheader",
  "definition", "deletion", "directory", "document", "emphasis", "feed", "figure", "generic",
  "group", "heading", "img", "insertion", "list", "listitem", "mark", "math", "meter", "none",
  "note", "paragraph", "presentation", "row", "rowgroup", "rowheader", "strong", "subscript",
  "superscript", "table", "term", "time", "toolbar", "tooltip",
  "banner", "complementary", "contentinfo", "form", "main", "navigation", "region", "search",
  "alert", "log", "marquee", "status", "timer",
  "alertdialog", "dialog",
];

const DEFAULT_LANDMARK_SELECTORS: Record<LandmarkName, string> = {
  main: "main, [role='main']",
  nav: "nav, [role='navigation']",
  banner: "header, [role='banner']",
  contentinfo: "footer, [role='contentinfo']",
};

// Node-side basename helper (no DOM/location dependency).
const basename = (src: string): string => src.split(/[?#]/)[0].split("/").pop() || "";

// ---------------------------------------------------------------------------
// Section: Document Structure
// ---------------------------------------------------------------------------

interface DocumentSnapshot {
  lang: string | null;
  titleCount: number;
  titleText: string;
  hasCharset: boolean;
  hasViewport: boolean;
  doctypeName: string | null;
}

const documentSection = defineSection<"document", DocumentSnapshot>({
  type: "document",
  configKey: "document",
  gather: (page) =>
    page.evaluate(() => ({
      lang: document.documentElement.getAttribute("lang"),
      titleCount: document.querySelectorAll("title").length,
      titleText: document.title || "",
      hasCharset:
        !!document.querySelector("head meta[charset]") ||
        Array.from(document.querySelectorAll("head meta[http-equiv]")).some(
          (m) => (m.getAttribute("http-equiv") || "").toLowerCase() === "content-type"
        ),
      hasViewport: Array.from(document.querySelectorAll("head meta[name]")).some(
        (m) => (m.getAttribute("name") || "").toLowerCase() === "viewport"
      ),
      doctypeName: document.doctype ? document.doctype.name : null,
    })),
  rules: [
    {
      key: "htmlLangValid",
      name: "Document: Lang Attribute",
      remediation:
        "Add a valid BCP-47 lang attribute to the <html> element (e.g. lang=\"en\") so assistive technologies announce the correct language.",
      enabled: (c) => c.htmlLangValid,
      evaluate: (s, c) => {
        if (!s.lang || !s.lang.trim()) return ["<html> is missing a non-empty lang attribute"];
        if (c.langPattern) {
          try {
            if (!new RegExp(c.langPattern).test(s.lang.trim()))
              return [`<html lang="${s.lang}"> does not match expected pattern /${c.langPattern}/`];
          } catch {
            /* invalid pattern in config — skip */
          }
        }
        return [];
      },
    },
    {
      key: "singleNonEmptyTitle",
      name: "Document: Title Tag",
      remediation: "Provide exactly one non-empty <title> in the <head> that describes the page.",
      enabled: (c) => c.singleNonEmptyTitle,
      evaluate: (s) => {
        if (s.titleCount === 0) return ["<title> tag is missing"];
        if (s.titleCount > 1) return [`Expected exactly one <title>, found ${s.titleCount}`];
        if (!s.titleText.trim()) return ["<title> is empty"];
        return [];
      },
    },
    {
      key: "charsetPresent",
      name: "Document: Charset",
      remediation: "Declare the character encoding with <meta charset=\"UTF-8\"> as the first element in <head>.",
      enabled: (c) => c.charsetPresent,
      evaluate: (s) => (s.hasCharset ? [] : ["Missing <meta charset> (or Content-Type) in <head>"]),
    },
    {
      key: "viewportPresent",
      name: "Document: Viewport",
      remediation:
        "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> so the page is responsive on mobile.",
      enabled: (c) => c.viewportPresent,
      evaluate: (s) => (s.hasViewport ? [] : ['Missing <meta name="viewport"> in <head>']),
    },
    {
      key: "doctypeHtml",
      name: "Document: Doctype",
      remediation: "Begin the document with the HTML5 doctype: <!DOCTYPE html>.",
      enabled: (c) => c.doctypeHtml,
      evaluate: (s) =>
        !s.doctypeName || s.doctypeName.toLowerCase() !== "html"
          ? ["Missing or non-HTML5 <!DOCTYPE html>"]
          : [],
    },
  ],
});

// ---------------------------------------------------------------------------
// Section: Heading Hierarchy
// ---------------------------------------------------------------------------

interface HeadingsSnapshot {
  headings: { level: number; name: string }[];
}

const headingsSection = defineSection<"headings", HeadingsSnapshot>({
  type: "headings",
  configKey: "headings",
  gather: (page, cfg) =>
    page.evaluate((c) => {
      const selector = c.includeAriaHeadings
        ? "h1,h2,h3,h4,h5,h6,[role='heading']"
        : "h1,h2,h3,h4,h5,h6";
      const isHidden = (el: Element): boolean => {
        const s = getComputedStyle(el as HTMLElement);
        return s.display === "none" || s.visibility === "hidden";
      };
      const accessibleName = (el: Element): string => {
        const label = (el.getAttribute("aria-label") || "").trim();
        return label || (el.textContent || "").trim();
      };
      const headings = Array.from(document.querySelectorAll(selector))
        .filter((el) => !(c.ignoreHidden && isHidden(el)))
        .map((el) => {
          const tag = el.tagName.toLowerCase();
          const level = /^h[1-6]$/.test(tag) ? Number(tag[1]) : Number(el.getAttribute("aria-level")) || 2;
          return { level, name: accessibleName(el) };
        });
      return { headings };
    }, cfg),
  rules: [
    {
      key: "requireH1",
      name: "Headings: H1 Present",
      remediation: "Add a single <h1> that states the page's primary topic.",
      enabled: (c) => c.requireH1,
      evaluate: (s) => (s.headings.some((h) => h.level === 1) ? [] : ["No <h1> found on the page"]),
    },
    {
      key: "requireSingleH1",
      name: "Headings: Single H1",
      remediation: "Use exactly one <h1> per page; demote additional top-level headings to <h2>.",
      enabled: (c) => c.requireSingleH1,
      evaluate: (s) => {
        const n = s.headings.filter((h) => h.level === 1).length;
        return n > 1 ? [`Expected exactly one <h1>, found ${n}`] : [];
      },
    },
    {
      key: "enforceNoSkippedLevels",
      name: "Headings: No Skipped Levels",
      remediation: "Nest headings without skipping levels (h1 → h2 → h3, never h1 → h3).",
      enabled: (c) => c.enforceNoSkippedLevels,
      evaluate: (s) => {
        const out: string[] = [];
        let prev = 0;
        for (const h of s.headings) {
          if (prev !== 0 && h.level > prev + 1)
            out.push(`Heading level jumps from h${prev} to h${h.level} ("${h.name.slice(0, 40)}")`);
          prev = h.level;
        }
        return out;
      },
    },
    {
      key: "disallowEmptyHeadings",
      name: "Headings: No Empty Headings",
      remediation: "Ensure every heading has visible text or an accessible name; remove headings used only for styling.",
      enabled: (c) => c.disallowEmptyHeadings,
      evaluate: (s) => {
        const n = s.headings.filter((h) => !h.name).length;
        return n ? [`${n} heading(s) have no text / accessible name`] : [];
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Section: Landmark Regions
// ---------------------------------------------------------------------------

interface LandmarksSnapshot {
  presence: Record<string, number>;
  mainCount: number;
  uniqueness: { name: string; total: number; unnamed: number }[];
  orphanCount: number;
}

const landmarksSection = defineSection<"landmarks", LandmarksSnapshot>({
  type: "landmarks",
  configKey: "landmarks",
  gather: (page, cfg) => {
    const selectors = { ...DEFAULT_LANDMARK_SELECTORS, ...(cfg.landmarkSelectors || {}) };
    return page.evaluate((args) => {
      const { selectors } = args;
      const presence: Record<string, number> = {};
      const uniqueness: { name: string; total: number; unnamed: number }[] = [];
      for (const name of Object.keys(selectors)) {
        const els = Array.from(document.querySelectorAll(selectors[name as keyof typeof selectors]));
        presence[name] = els.length;
        if (els.length > 1) {
          const unnamed = els.filter(
            (el) => !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || "").trim()
          ).length;
          uniqueness.push({ name, total: els.length, unnamed });
        }
      }
      const landmarkSel =
        "main,[role='main'],nav,[role='navigation'],header,[role='banner'],footer,[role='contentinfo'],aside,[role='complementary'],section,article,form,[role='search'],[role='region']";
      const inLandmark = (el: Element | null): boolean => {
        let cur: Element | null = el;
        while (cur && cur !== document.body) {
          if (cur.matches(landmarkSel)) return true;
          cur = cur.parentElement;
        }
        return false;
      };
      const orphanCount = Array.from(
        document.querySelectorAll("body p, body h1, body h2, body h3, body button, body a")
      ).filter((el) => (el.textContent || "").trim().length > 0 && !inLandmark(el)).length;

      return { presence, mainCount: presence.main || 0, uniqueness, orphanCount };
    }, { selectors });
  },
  rules: [
    {
      key: "requiredLandmarksPresent",
      name: "Landmarks: Required Regions",
      remediation:
        "Wrap the page in the expected landmarks: a <main>, plus <nav>, <header>/banner, and <footer>/contentinfo.",
      enabled: (c) => c.requiredLandmarks.length > 0,
      evaluate: (s, c) =>
        c.requiredLandmarks
          .filter((name) => (s.presence[name] || 0) < 1)
          .map((name) => `Missing required landmark: ${name}`),
    },
    {
      key: "requireSingleMain",
      name: "Landmarks: Single Main",
      remediation: "Use exactly one <main> landmark per page.",
      enabled: (c) => c.requireSingleMain,
      evaluate: (s) => (s.mainCount !== 1 ? [`Expected exactly one main landmark, found ${s.mainCount}`] : []),
    },
    {
      key: "requireUniqueLandmarkNames",
      name: "Landmarks: Unique Names",
      remediation:
        "When a landmark type repeats (e.g. two <nav>s), give each a distinguishing aria-label or aria-labelledby.",
      enabled: (c) => c.requireUniqueLandmarkNames,
      evaluate: (s) =>
        s.uniqueness
          .filter((u) => u.unnamed > 0)
          .map(
            (u) =>
              `${u.total} "${u.name}" landmarks present but ${u.unnamed} lack an aria-label/aria-labelledby to distinguish them`
          ),
    },
    {
      key: "requireContentInLandmarks",
      name: "Landmarks: Content In Landmarks",
      remediation: "Ensure significant content (text, headings, controls) lives inside a landmark region.",
      enabled: (c) => c.requireContentInLandmarks,
      evaluate: (s) =>
        s.orphanCount ? [`${s.orphanCount} significant element(s) render outside any landmark region`] : [],
    },
  ],
});

// ---------------------------------------------------------------------------
// Section: Image & Media Alternatives
// ---------------------------------------------------------------------------

interface MediaSnapshot {
  imgs: { alt: string | null; src: string; ariaHidden: boolean; role: string }[];
  iframes: { title: string; ariaHidden: boolean; src: string }[];
  svgImgs: { hasTitle: boolean; label: string }[];
  figures: { hasFigcaption: boolean }[];
}

const mediaSection = defineSection<"media", MediaSnapshot>({
  type: "media",
  configKey: "media",
  gather: (page) =>
    page.evaluate(() => ({
      imgs: Array.from(document.querySelectorAll("img")).map((img) => ({
        alt: img.getAttribute("alt"),
        src: img.getAttribute("src") || "",
        ariaHidden: img.getAttribute("aria-hidden") === "true",
        role: (img.getAttribute("role") || "").toLowerCase(),
      })),
      iframes: Array.from(document.querySelectorAll("iframe")).map((f) => ({
        title: (f.getAttribute("title") || "").trim(),
        ariaHidden: f.getAttribute("aria-hidden") === "true",
        src: f.getAttribute("src") || "",
      })),
      svgImgs: Array.from(document.querySelectorAll("svg[role='img']")).map((s) => ({
        hasTitle: !!s.querySelector("title"),
        label: (s.getAttribute("aria-label") || s.getAttribute("aria-labelledby") || "").trim(),
      })),
      figures: Array.from(document.querySelectorAll("figure")).map((f) => ({
        hasFigcaption: !!f.querySelector("figcaption"),
      })),
    })),
  rules: [
    {
      key: "requireImgAlt",
      name: "Media: Image Alt",
      remediation: "Give every <img> an alt attribute; use alt=\"\" only for purely decorative images.",
      enabled: (c) => c.requireImgAlt,
      evaluate: (s, c) => {
        const out: string[] = [];
        for (const img of s.imgs) {
          if (c.ignoreAriaHidden && (img.ariaHidden || img.role === "presentation" || img.role === "none")) continue;
          if (img.alt === null) out.push(`<img> missing alt attribute (src="${img.src.slice(0, 60)}")`);
          else if (img.alt === "" && !c.allowDecorativeEmptyAlt)
            out.push(`<img> has empty alt but decorative empty alt is disallowed (src="${img.src.slice(0, 60)}")`);
        }
        return out;
      },
    },
    {
      key: "disallowFilenameAlt",
      name: "Media: Alt Not Filename",
      remediation: "Write descriptive alt text; do not use the image filename as the alt value.",
      enabled: (c) => c.disallowFilenameAlt,
      evaluate: (s, c) => {
        const out: string[] = [];
        let fnRe: RegExp | null = null;
        try {
          fnRe = new RegExp(c.filenameAltPattern || "\\.(jpe?g|png|gif|svg|webp|avif|bmp|ico)$", "i");
        } catch {
          fnRe = null;
        }
        for (const img of s.imgs) {
          if (c.ignoreAriaHidden && (img.ariaHidden || img.role === "presentation" || img.role === "none")) continue;
          if (img.alt && img.alt.trim()) {
            const a = img.alt.trim();
            if ((fnRe && fnRe.test(a)) || (img.src && a.toLowerCase() === basename(img.src).toLowerCase()))
              out.push(`<img> alt text looks like a filename: "${a}"`);
          }
        }
        return out;
      },
    },
    {
      key: "requireIframeTitle",
      name: "Media: Iframe Title",
      remediation: "Give every <iframe> a descriptive title attribute.",
      enabled: (c) => c.requireIframeTitle,
      evaluate: (s) =>
        s.iframes
          .filter((f) => !f.ariaHidden && !f.title)
          .map((f) => `<iframe> missing a non-empty title (src="${f.src.slice(0, 60)}")`),
    },
    {
      key: "requireSvgAccessibleName",
      name: "Media: SVG Name",
      remediation: "Give meaningful <svg role=\"img\"> a <title> child or an aria-label.",
      enabled: (c) => c.requireSvgAccessibleName,
      evaluate: (s) =>
        s.svgImgs.filter((v) => !v.hasTitle && !v.label).map(() => '<svg role="img"> lacks a <title> or aria-label'),
    },
    {
      key: "requireFigcaption",
      name: "Media: Figcaption",
      remediation: "Give each <figure> a <figcaption> describing it.",
      enabled: (c) => c.requireFigcaption,
      evaluate: (s) => s.figures.filter((f) => !f.hasFigcaption).map(() => "<figure> lacks a <figcaption>"),
    },
  ],
});

// ---------------------------------------------------------------------------
// Section: Link Integrity
// ---------------------------------------------------------------------------

interface LinksSnapshot {
  anchors: { href: string | null; accName: string; target: string; rel: string; ariaHidden: boolean }[];
  hasSkipLink: boolean;
}

const linksSection = defineSection<"links", LinksSnapshot>({
  type: "links",
  configKey: "links",
  gather: (page) =>
    page.evaluate(() => {
      const accName = (a: Element): string => {
        const label = (a.getAttribute("aria-label") || a.getAttribute("title") || "").trim();
        if (label) return label;
        const labelledby = a.getAttribute("aria-labelledby");
        if (labelledby) {
          const t = labelledby
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent || "")
            .join(" ")
            .trim();
          if (t) return t;
        }
        const text = (a.textContent || "").trim();
        if (text) return text;
        const img = a.querySelector("img[alt]");
        if (img) {
          const al = (img.getAttribute("alt") || "").trim();
          if (al) return al;
        }
        const svgTitle = a.querySelector("svg title");
        if (svgTitle) {
          const st = (svgTitle.textContent || "").trim();
          if (st) return st;
        }
        return "";
      };
      const anchors = Array.from(document.querySelectorAll("a")).map((a) => ({
        href: a.getAttribute("href"),
        accName: accName(a),
        target: (a.getAttribute("target") || "").toLowerCase(),
        rel: (a.getAttribute("rel") || "").toLowerCase(),
        ariaHidden: a.getAttribute("aria-hidden") === "true",
      }));
      const hasSkipLink = Array.from(document.querySelectorAll("a"))
        .slice(0, 5)
        .some((a) => {
          const href = a.getAttribute("href") || "";
          return href.startsWith("#") && /skip|main|content/i.test(`${a.textContent || ""} ${href}`);
        });
      return { anchors, hasSkipLink };
    }),
  rules: [
    {
      key: "requireDiscernibleText",
      name: "Links: Discernible Text",
      remediation:
        "Give every link discernible text or an accessible name (visible text, aria-label, title, or a nested image alt).",
      enabled: (c) => c.requireDiscernibleText,
      evaluate: (s) =>
        s.anchors
          .filter((a) => a.href !== null && !a.ariaHidden && !a.accName)
          .map((a) => `<a href="${(a.href || "").slice(0, 60)}"> has no discernible text / accessible name`),
    },
    {
      key: "disallowHrefLessAnchors",
      name: "Links: No Href-less Anchors",
      remediation: "Use <button> for actions; reserve <a href> for navigation. Avoid href=\"#\" / javascript: links.",
      enabled: (c) => c.disallowHrefLessAnchors,
      evaluate: (s) =>
        s.anchors
          .filter((a) => {
            const h = (a.href || "").trim();
            return a.href === null || h === "" || h === "#" || h.toLowerCase().startsWith("javascript:");
          })
          .map((a) => `<a> used without a valid href (href="${a.href ?? "null"}") — should be a <button>`),
    },
    {
      key: "requireBlankRelSafe",
      name: "Links: Blank Target Rel",
      remediation: 'Add rel="noopener" (or noreferrer) to links using target="_blank" to prevent reverse-tabnabbing.',
      enabled: (c) => c.requireBlankRelSafe,
      evaluate: (s) =>
        s.anchors
          .filter((a) => a.target === "_blank" && !/\b(noopener|noreferrer)\b/.test(a.rel))
          .map((a) => `<a target="_blank"> missing rel="noopener" (href="${(a.href || "").slice(0, 60)}")`),
    },
    {
      key: "disallowAmbiguousText",
      name: "Links: Ambiguous Text",
      remediation: 'Replace vague link text like "click here" / "read more" with text describing the destination.',
      enabled: (c) => c.disallowAmbiguousText,
      evaluate: (s, c) => {
        const phrases = c.ambiguousPhrases || ["click here", "read more", "learn more", "here", "more", "link"];
        return s.anchors
          .filter((a) => a.href !== null)
          .map((a) => a.accName.toLowerCase().replace(/\s+/g, " ").trim())
          .filter((name) => name && phrases.includes(name))
          .map((name) => `Ambiguous link text: "${name}"`);
      },
    },
    {
      key: "requireSkipLink",
      name: "Links: Skip Link",
      remediation: "Provide a skip-to-content link near the top of the page for keyboard users.",
      enabled: (c) => c.requireSkipLink,
      evaluate: (s) => (s.hasSkipLink ? [] : ["No skip-to-content link found near the top of the page"]),
    },
  ],
});

// ---------------------------------------------------------------------------
// Section: Form Control Labels
// ---------------------------------------------------------------------------

interface FormsSnapshot {
  controls: { desc: string; hasName: boolean; required: boolean; ariaRequired: string | null }[];
  groups: { name: string; size: number; allWrapped: boolean }[];
}

const formsSection = defineSection<"forms", FormsSnapshot>({
  type: "forms",
  configKey: "forms",
  gather: (page) =>
    page.evaluate(() => {
      const controlsEls = Array.from(document.querySelectorAll("input, select, textarea")).filter((el) => {
        const type = (el.getAttribute("type") || "").toLowerCase();
        return !(el.tagName === "INPUT" && type === "hidden");
      });
      const hasAccessibleName = (el: Element): boolean => {
        const type = (el.getAttribute("type") || "").toLowerCase();
        if (el.tagName === "INPUT" && ["submit", "button", "reset"].includes(type))
          return !!(el.getAttribute("value") || "").trim() || !!(el.getAttribute("aria-label") || "").trim();
        if (el.tagName === "INPUT" && type === "image")
          return !!(el.getAttribute("alt") || el.getAttribute("aria-label") || "").trim();
        if ((el.getAttribute("aria-label") || "").trim()) return true;
        const labelledby = el.getAttribute("aria-labelledby");
        if (labelledby && labelledby.split(/\s+/).some((id) => document.getElementById(id))) return true;
        if ((el.getAttribute("title") || "").trim()) return true;
        const id = el.getAttribute("id");
        if (id) {
          const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id;
          try {
            if (document.querySelector(`label[for="${escaped}"]`)) return true;
          } catch {
            /* invalid selector — fall through */
          }
        }
        return !!el.closest("label");
      };
      const controls = controlsEls.map((el) => ({
        desc: `<${el.tagName.toLowerCase()}${el.getAttribute("type") ? `[type=${el.getAttribute("type")}]` : ""}${
          el.getAttribute("name") ? `[name=${el.getAttribute("name")}]` : ""
        }>`,
        hasName: hasAccessibleName(el),
        required: el.hasAttribute("required"),
        ariaRequired: el.getAttribute("aria-required"),
      }));

      const groupEls = Array.from(document.querySelectorAll("input[type='radio'], input[type='checkbox']"));
      const names = Array.from(new Set(groupEls.map((g) => g.getAttribute("name")).filter((n): n is string => !!n)));
      const groups = names.map((name) => {
        const members = groupEls.filter((g) => g.getAttribute("name") === name);
        const allWrapped = members.every((m) => {
          const fs = m.closest("fieldset");
          return !!fs && !!fs.querySelector("legend");
        });
        return { name, size: members.length, allWrapped };
      });
      return { controls, groups };
    }),
  rules: [
    {
      key: "requireControlLabels",
      name: "Forms: Control Labels",
      remediation:
        "Associate every input/select/textarea with a <label for>, wrapping <label>, aria-label, or aria-labelledby.",
      enabled: (c) => c.requireControlLabels,
      evaluate: (s) =>
        s.controls.filter((ctl) => !ctl.hasName).map((ctl) => `Form control has no associated label / accessible name: ${ctl.desc}`),
    },
    {
      key: "requireRequiredMarked",
      name: "Forms: Required Marked",
      remediation: 'Expose required fields programmatically with aria-required="true" (in addition to the required attribute).',
      enabled: (c) => c.requireRequiredMarked,
      evaluate: (s) =>
        s.controls
          .filter((ctl) => ctl.required && ctl.ariaRequired !== "true")
          .map((ctl) => `Required control missing aria-required="true": ${ctl.desc}`),
    },
    {
      key: "requireFieldsetLegend",
      name: "Forms: Fieldset Legend",
      remediation: "Wrap related radio/checkbox groups in a <fieldset> with a <legend> describing the group.",
      enabled: (c) => c.requireFieldsetLegend,
      evaluate: (s) =>
        s.groups
          .filter((g) => g.size > 1 && !g.allWrapped)
          .map((g) => `Radio/checkbox group "${g.name}" is not wrapped in <fieldset><legend>`),
    },
  ],
});

// ---------------------------------------------------------------------------
// Section: Table Semantics
// ---------------------------------------------------------------------------

interface TablesSnapshot {
  tables: { thCount: number; hasScope: boolean; hasHeadersAssoc: boolean; hasCaption: boolean; hasAriaLabel: boolean }[];
}

const tablesSection = defineSection<"tables", TablesSnapshot>({
  type: "tables",
  configKey: "tables",
  gather: (page) =>
    page.evaluate(() => ({
      tables: Array.from(document.querySelectorAll("table"))
        .filter((t) => {
          const role = (t.getAttribute("role") || "").toLowerCase();
          return role !== "presentation" && role !== "none";
        })
        .map((t) => {
          const ths = Array.from(t.querySelectorAll("th"));
          return {
            thCount: ths.length,
            hasScope: ths.some((th) => (th.getAttribute("scope") || "").trim()),
            hasHeadersAssoc: Array.from(t.querySelectorAll("td")).some((td) => (td.getAttribute("headers") || "").trim()),
            hasCaption: !!t.querySelector("caption"),
            hasAriaLabel: !!(t.getAttribute("aria-label") || t.getAttribute("aria-labelledby") || "").trim(),
          };
        }),
    })),
  rules: [
    {
      key: "requireHeaderCells",
      name: "Tables: Header Cells",
      remediation: "Give each data table <th> header cells identifying rows/columns.",
      enabled: (c) => c.requireHeaderCells,
      evaluate: (s) =>
        s.tables.map((t, i) => ({ t, i })).filter(({ t }) => t.thCount === 0).map(({ i }) => `Table #${i + 1} has no <th> header cells`),
    },
    {
      key: "requireScopeOrHeaders",
      name: "Tables: Scope/Headers",
      remediation: "Add a scope attribute to each <th> (or use headers= associations on cells) to bind headers to cells.",
      enabled: (c) => c.requireScopeOrHeaders,
      evaluate: (s) =>
        s.tables
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => t.thCount > 0 && !t.hasScope && !t.hasHeadersAssoc)
          .map(({ i }) => `Table #${i + 1} <th> cells lack a scope attribute and no cell uses headers= association`),
    },
    {
      key: "requireCaption",
      name: "Tables: Caption",
      remediation: "Give each data table a <caption> (or aria-label) summarizing its contents.",
      enabled: (c) => c.requireCaption,
      evaluate: (s) =>
        s.tables
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => !t.hasCaption && !t.hasAriaLabel)
          .map(({ i }) => `Table #${i + 1} has no <caption> or aria-label`),
    },
    {
      key: "disallowLayoutTables",
      name: "Tables: No Layout Tables",
      remediation: "Do not use <table> for visual layout; use CSS grid/flexbox instead.",
      enabled: (c) => c.disallowLayoutTables,
      evaluate: (s) =>
        s.tables
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => t.thCount === 0 && !t.hasCaption)
          .map(({ i }) => `Table #${i + 1} appears to be a layout table (no <th>/<caption>) — use CSS for layout`),
    },
  ],
});

// ---------------------------------------------------------------------------
// Section: ARIA & ID Integrity
// ---------------------------------------------------------------------------

interface AriaSnapshot {
  duplicateIds: { id: string; count: number }[];
  roledEls: { tag: string; roles: string[] }[];
  brokenRefs: string[];
  ariaHiddenFocusable: string[];
  positiveTabindex: { tag: string; ti: number }[];
}

const IMPLICIT_ROLES: Record<string, string> = {
  BUTTON: "button", NAV: "navigation", MAIN: "main", ASIDE: "complementary",
  UL: "list", OL: "list", LI: "listitem", TABLE: "table", ARTICLE: "article", FORM: "form",
  H1: "heading", H2: "heading", H3: "heading", H4: "heading", H5: "heading", H6: "heading",
  HEADER: "banner", FOOTER: "contentinfo",
};

const ariaSection = defineSection<"ariaIntegrity", AriaSnapshot>({
  type: "ariaIntegrity",
  configKey: "ariaIntegrity",
  gather: (page) =>
    page.evaluate(() => {
      const counts: Record<string, number> = {};
      document.querySelectorAll("[id]").forEach((el) => {
        const id = el.getAttribute("id") || "";
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
      const duplicateIds = Object.keys(counts)
        .filter((id) => counts[id] > 1)
        .map((id) => ({ id, count: counts[id] }));

      const roledEls = Array.from(document.querySelectorAll("[role]")).map((el) => ({
        tag: el.tagName.toLowerCase(),
        roles: (el.getAttribute("role") || "").split(/\s+/).filter(Boolean),
      }));

      const brokenRefs: string[] = [];
      const idrefAttrs = ["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-details", "aria-flowto"];
      for (const attr of idrefAttrs) {
        document.querySelectorAll(`[${attr}]`).forEach((el) => {
          for (const id of (el.getAttribute(attr) || "").split(/\s+/).filter(Boolean)) {
            if (!document.getElementById(id))
              brokenRefs.push(`${attr} on <${el.tagName.toLowerCase()}> references missing id "${id}"`);
          }
        });
      }
      document.querySelectorAll("label[for]").forEach((el) => {
        const id = el.getAttribute("for") || "";
        if (id && !document.getElementById(id)) brokenRefs.push(`<label for="${id}"> references a missing id`);
      });

      const focusableSel =
        'a[href], button, input:not([type="hidden"]), select, textarea, [contenteditable="true"], audio[controls], video[controls], [tabindex]';
      const inTabOrder = (el: Element): boolean => {
        const ti = el.getAttribute("tabindex");
        return ti !== null ? Number(ti) >= 0 : true;
      };
      const ariaHiddenFocusable: string[] = [];
      document.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => {
        const focusables = Array.from(hidden.querySelectorAll(focusableSel));
        if (hidden.matches(focusableSel)) focusables.push(hidden);
        for (const f of focusables) {
          if (inTabOrder(f)) {
            ariaHiddenFocusable.push(`Focusable <${f.tagName.toLowerCase()}> inside an aria-hidden="true" subtree`);
            break;
          }
        }
      });

      const positiveTabindex: { tag: string; ti: number }[] = [];
      document.querySelectorAll("[tabindex]").forEach((el) => {
        const ti = Number(el.getAttribute("tabindex"));
        if (Number.isFinite(ti) && ti > 0) positiveTabindex.push({ tag: el.tagName.toLowerCase(), ti });
      });

      return { duplicateIds, roledEls, brokenRefs, ariaHiddenFocusable, positiveTabindex };
    }),
  rules: [
    {
      key: "noDuplicateIds",
      name: "ARIA: Unique IDs",
      remediation: "Make every id unique; duplicate ids break label/aria references and getElementById.",
      enabled: (c) => c.noDuplicateIds,
      evaluate: (s) => s.duplicateIds.map((d) => `Duplicate id="${d.id}" appears ${d.count} times`),
    },
    {
      key: "validRoles",
      name: "ARIA: Valid Roles",
      remediation: "Use only valid WAI-ARIA role tokens on the role attribute.",
      enabled: (c) => c.validRoles,
      evaluate: (s) => {
        const roleSet = new Set(VALID_ARIA_ROLES);
        const out: string[] = [];
        for (const el of s.roledEls)
          for (const r of el.roles) if (!roleSet.has(r.toLowerCase())) out.push(`Invalid ARIA role "${r}" on <${el.tag}>`);
        return out;
      },
    },
    {
      key: "referentialIntegrity",
      name: "ARIA: Reference Integrity",
      remediation:
        "Ensure every id referenced by aria-labelledby/aria-describedby/aria-controls/aria-owns or label[for] exists in the DOM.",
      enabled: (c) => c.referentialIntegrity,
      evaluate: (s) => s.brokenRefs,
    },
    {
      key: "noAriaHiddenFocusable",
      name: "ARIA: No Hidden Focusable",
      remediation: "Do not place focusable elements inside an aria-hidden=\"true\" subtree; they become keyboard traps.",
      enabled: (c) => c.noAriaHiddenFocusable,
      evaluate: (s) => s.ariaHiddenFocusable,
    },
    {
      key: "noPositiveTabindex",
      name: "ARIA: No Positive Tabindex",
      remediation: "Avoid tabindex values greater than 0; rely on DOM order (use 0 or -1 only).",
      enabled: (c) => c.noPositiveTabindex,
      evaluate: (s) => s.positiveTabindex.map((t) => `Positive tabindex=${t.ti} on <${t.tag}> disrupts natural focus order`),
    },
    {
      key: "noRedundantRoles",
      name: "ARIA: No Redundant Roles",
      remediation: "Remove role attributes that merely duplicate an element's implicit role (e.g. <button role=\"button\">).",
      enabled: (c) => c.noRedundantRoles,
      evaluate: (s) => {
        const out: string[] = [];
        for (const el of s.roledEls) {
          const tag = el.tag.toUpperCase();
          for (const r of el.roles)
            if (IMPLICIT_ROLES[tag] && IMPLICIT_ROLES[tag] === r.toLowerCase())
              out.push(`Redundant role="${r}" duplicates the implicit role of <${el.tag}>`);
        }
        return out;
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Section: Interactive & List Markup
// ---------------------------------------------------------------------------

interface MarkupSnapshot {
  orphanLiCount: number;
  nestedInteractive: string[];
  roleButtonNotFocusable: string[];
  buttonsNoName: string[];
  divOnclickCount: number;
}

const markupSection = defineSection<"markup", MarkupSnapshot>({
  type: "markup",
  configKey: "markup",
  gather: (page) =>
    page.evaluate(() => {
      const orphanLiCount = Array.from(document.querySelectorAll("li")).filter(
        (li) => !["UL", "OL", "MENU"].includes(li.parentElement?.tagName || "")
      ).length;

      const nestedSel =
        "a[href], button, input, select, textarea, [role='button'], [role='link'], [role='menuitem'], [role='checkbox'], [role='tab']";
      const nestedInteractive: string[] = [];
      for (const container of Array.from(document.querySelectorAll("a[href], button, [role='button'], [role='link']"))) {
        const nested = container.querySelector(nestedSel);
        if (nested && nested !== container)
          nestedInteractive.push(`Nested interactive element: <${nested.tagName.toLowerCase()}> inside <${container.tagName.toLowerCase()}>`);
      }

      const roleButtonNotFocusable: string[] = [];
      for (const b of Array.from(document.querySelectorAll("[role='button']"))) {
        if (["BUTTON", "A", "INPUT"].includes(b.tagName)) continue;
        if (!b.hasAttribute("tabindex"))
          roleButtonNotFocusable.push(`Element with role="button" is not keyboard-focusable (missing tabindex): <${b.tagName.toLowerCase()}>`);
      }

      const buttonsNoName: string[] = [];
      for (const b of Array.from(document.querySelectorAll("button, [role='button']"))) {
        if (b.getAttribute("aria-hidden") === "true") continue;
        const text = (b.textContent || "").trim();
        const label = (b.getAttribute("aria-label") || b.getAttribute("title") || "").trim();
        const labelledby = b.getAttribute("aria-labelledby");
        const lblText = labelledby
          ? labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim()
          : "";
        const valueText = b.tagName === "INPUT" ? (b.getAttribute("value") || "").trim() : "";
        const imgEl = b.querySelector("img[alt]");
        const imgAlt = imgEl ? (imgEl.getAttribute("alt") || "").trim() : "";
        const svgTitleEl = b.querySelector("svg title");
        const svgTitle = svgTitleEl ? (svgTitleEl.textContent || "").trim() : "";
        if (!text && !label && !lblText && !valueText && !imgAlt && !svgTitle)
          buttonsNoName.push(`<${b.tagName.toLowerCase()}> (button) has no accessible name`);
      }

      const divOnclickCount = document.querySelectorAll("div[onclick], span[onclick]").length;

      return { orphanLiCount, nestedInteractive, roleButtonNotFocusable, buttonsNoName, divOnclickCount };
    }),
  rules: [
    {
      key: "enforceListItemParent",
      name: "Markup: List Item Parent",
      remediation: "Place every <li> directly inside a <ul>, <ol>, or <menu>.",
      enabled: (c) => c.enforceListItemParent,
      evaluate: (s) => (s.orphanLiCount ? [`${s.orphanLiCount} <li> element(s) are not directly inside <ul>/<ol>/<menu>`] : []),
    },
    {
      key: "disallowNestedInteractive",
      name: "Markup: No Nested Interactive",
      remediation: "Never nest interactive elements (e.g. a <button> inside an <a>); split them into siblings.",
      enabled: (c) => c.disallowNestedInteractive,
      evaluate: (s) => s.nestedInteractive,
    },
    {
      key: "enforceRoleButtonFocusable",
      name: "Markup: Role Button Focusable",
      remediation: 'Add tabindex="0" to non-button elements with role="button" so they are keyboard-focusable.',
      enabled: (c) => c.enforceRoleButtonFocusable,
      evaluate: (s) => s.roleButtonNotFocusable,
    },
    {
      key: "requireButtonAccessibleName",
      name: "Markup: Button Names",
      remediation: "Give every button an accessible name via text content, aria-label, aria-labelledby, or title.",
      enabled: (c) => c.requireButtonAccessibleName,
      evaluate: (s) => s.buttonsNoName,
    },
    {
      key: "disallowInlineClickHandlersOnDivs",
      name: "Markup: No Div Onclick",
      remediation: "Use a <button> for click behavior instead of onclick on a <div>/<span>.",
      enabled: (c) => c.disallowInlineClickHandlersOnDivs,
      evaluate: (s) => (s.divOnclickCount ? [`${s.divOnclickCount} <div>/<span> element(s) with inline onclick — use a <button> instead`] : []),
    },
  ],
});

// ---------------------------------------------------------------------------
// The section registry (fetched by section key)
// ---------------------------------------------------------------------------

/**
 * THE single source of truth for semantic sections. Add or remove a section by adding or
 * removing one entry here — the SemanticCheckType union, the ALL_SEMANTIC_CHECKS list, the
 * ACTIVE_SEMANTIC_CHECKS env validation, and the report rows are all derived from it.
 * (Adding a section also needs a matching config shape + `semanticDefaults` block in
 * config/page-validation.config.ts, where per-section defaults naturally live.)
 *
 * NOTE: uses `satisfies` (not a `Record<string, …>` annotation) so the literal keys are
 * preserved for `keyof typeof` below.
 */
export const SEMANTIC_SECTION_REGISTRY = {
  document: documentSection,
  headings: headingsSection,
  landmarks: landmarksSection,
  media: mediaSection,
  links: linksSection,
  forms: formsSection,
  tables: tablesSection,
  ariaIntegrity: ariaSection,
  markup: markupSection,
} satisfies Record<string, SemanticSection<any, any>>;

/** Section-key union + ordered list, DERIVED from the registry above. */
export type SemanticCheckType = keyof typeof SEMANTIC_SECTION_REGISTRY;
export const ALL_SEMANTIC_CHECKS = Object.keys(SEMANTIC_SECTION_REGISTRY) as SemanticCheckType[];

// Loosely-typed view for generic iteration. Each section encapsulates its own snapshot/cfg
// types internally (via defineSection); the runner treats them uniformly.
const SECTIONS = SEMANTIC_SECTION_REGISTRY as Record<SemanticCheckType, SemanticSection<any, any>>;

/**
 * Resolves which semantic sections are active from the ACTIVE_SEMANTIC_CHECKS env var
 * (comma-separated, case-insensitive; defaults to all). Preserves the user's order,
 * de-duplicates, and ignores unknown names so a typo can never crash the run.
 */
export function resolveActiveSemanticChecks(): SemanticCheckType[] {
  const envVal = process.env.ACTIVE_SEMANTIC_CHECKS;
  if (!envVal || !envVal.trim()) {
    return [...ALL_SEMANTIC_CHECKS];
  }
  const byLower = new Map(ALL_SEMANTIC_CHECKS.map((c) => [c.toLowerCase(), c] as const));
  const result: SemanticCheckType[] = [];
  for (const raw of envVal.split(",")) {
    const canonical = byLower.get(raw.trim().toLowerCase());
    if (canonical && !result.includes(canonical)) result.push(canonical);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Runner + reporter helpers
// ---------------------------------------------------------------------------

/** Assert a rule produced no violations, embedding the full list in the failure message. */
function assertNoViolations(violations: string[], summary: string): void {
  const message =
    violations.length > 0 ? `${summary} (${violations.length}):\n- ${violations.join("\n- ")}` : summary;
  expect(violations.length === 0, message).toBe(true);
}

/**
 * Validates the semantic HTML structure of the rendered page. For each active section
 * (activeChecks), gathers one DOM snapshot, then runs each enabled rule as its own
 * soft-failing test.step.
 */
export async function validateSemantic(
  page: Page,
  config: SemanticValidationConfig,
  activeChecks: readonly SemanticCheckType[] = resolveActiveSemanticChecks()
): Promise<void> {
  for (const sectionKey of activeChecks) {
    const section = SECTIONS[sectionKey];
    if (!section) continue;
    const cfg = config[section.configKey];
    if (!cfg || !(cfg as { required?: boolean }).required) continue; // section-level gate

    const activeRules = section.rules.filter((rule) => rule.enabled(cfg));
    if (activeRules.length === 0) continue;

    const snapshot = await section.gather(page, cfg);
    for (const rule of activeRules) {
      await test.step(rule.name, async () => {
        try {
          assertNoViolations(rule.evaluate(snapshot, cfg), rule.name);
        } catch (err: any) {
          expect.soft(true, `Sub-check failed: ${err.message || String(err)}`).toBe(false);
        }
      });
    }
  }
}

/**
 * Ordered list of the rule (sub-test) display names that WILL run for the given config +
 * active sections. Used by the custom reporter to build the semantic report rows so that
 * adding/removing/toggling a rule flows through automatically.
 */
export function getActiveSemanticSubtestNames(
  config: SemanticValidationConfig,
  activeChecks: readonly SemanticCheckType[] = resolveActiveSemanticChecks()
): string[] {
  const names: string[] = [];
  for (const sectionKey of activeChecks) {
    const section = SECTIONS[sectionKey];
    if (!section) continue;
    const cfg = config[section.configKey];
    if (!cfg || !(cfg as { required?: boolean }).required) continue;
    for (const rule of section.rules) if (rule.enabled(cfg)) names.push(rule.name);
  }
  return names;
}

/** Map of every semantic rule's display name -> its remediation guidance (for the reporter). */
export function getSemanticRemediationByName(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(SEMANTIC_SECTION_REGISTRY) as SemanticCheckType[])
    for (const rule of SECTIONS[key].rules) out[rule.name] = rule.remediation;
  return out;
}
