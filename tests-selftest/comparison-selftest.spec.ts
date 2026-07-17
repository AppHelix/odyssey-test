import { test, expect } from "@playwright/test";
import { compareComponents, CompareOptions } from "../comparison/engine/compare";
import { extractComponent } from "../comparison/engine/extractor";
import { heroFields, faqFields } from "../comparison/mappings/presets";
import { learnCourseMap } from "../comparison/mappings/learn/course/learn-course.map";
import { learnMap } from "../comparison/mappings/learn/learn.map";
import { learnDeepMap } from "../comparison/mappings/learn/deep/learn-deep.map";
import type { ComponentSelectorSet } from "../comparison/mappings/types";
import type { NormalizedComponent, NormalizedField } from "../comparison/engine/types";

/**
 * Self-test for the content comparison framework. Two layers:
 *  1. Pure engine cases (no browser) — deterministic match/modified/missing/extra/list behavior.
 *  2. Extractor + engine against mock fixtures with SAME content but DIFFERENT DOM structures —
 *     proves the semantic-content approach: structurally-unrelated markup normalizes to a match.
 *
 * Run with: npm run test:validators  (uses playwright.selftest.config.ts + mock-server.js)
 */

const OPTS: CompareOptions = { matchThreshold: 0.95, ignoreCase: true };

// --- tiny builders for NormalizedComponent ---------------------------------
const txt = (name: string, value: string, optional = false): NormalizedField => ({
  name,
  kind: "text",
  values: [value],
  optional,
});
const listOf = (name: string, items: Array<Record<string, string>>): NormalizedField => ({
  name,
  kind: "list",
  values: items.map((o) => Object.values(o).join(" ")),
  items: items.map((o) => Object.entries(o).map(([n, v]) => txt(n, v))),
});
const listText = (name: string, values: string[], compareAsText = false): NormalizedField => ({
  name,
  kind: "list",
  values,
  compareAsText,
});
const comp = (fields: NormalizedField[], present = true): NormalizedComponent => ({
  type: "t",
  label: "L",
  present,
  fields,
});

test.describe("comparison engine (pure)", () => {
  test("identical text fields => match", () => {
    const d = compareComponents(comp([txt("heading", "Learn Blender")]), comp([txt("heading", "Learn Blender")]), OPTS, true);
    expect(d.status).toBe("match");
    expect(d.parityScore).toBe(1);
  });

  test("case/whitespace/punctuation differences => still match", () => {
    const d = compareComponents(
      comp([txt("heading", "Learn   “Blender”")]),
      comp([txt("heading", 'learn "Blender"')]),
      OPTS,
      true
    );
    expect(d.status).toBe("match");
  });

  test("substantially different text => modified with inline diff", () => {
    const d = compareComponents(comp([txt("body", "The quick brown fox")]), comp([txt("body", "A slow green turtle")]), OPTS, true);
    expect(d.status).toBe("modified");
    expect(d.fields[0].inlineDiff).toBeTruthy();
  });

  test("present in legacy, empty in odyssey => missing", () => {
    const d = compareComponents(comp([txt("cta", "Enroll now")]), comp([txt("cta", "")]), OPTS, true);
    expect(d.fields[0].status).toBe("missing");
  });

  test("present in odyssey, empty in legacy => extra", () => {
    const d = compareComponents(comp([txt("cta", "")]), comp([txt("cta", "Enroll now")]), OPTS, true);
    expect(d.fields[0].status).toBe("extra");
  });

  test("optional field absent on odyssey => match", () => {
    const d = compareComponents(comp([txt("subheading", "Free course", true)]), comp([txt("subheading", "", true)]), OPTS, true);
    expect(d.status).toBe("match");
  });

  test("list reorder => match (order tolerant)", () => {
    const legacy = comp([listOf("items", [{ q: "Is it free?" }, { q: "Certificate?" }])]);
    const odyssey = comp([listOf("items", [{ q: "Certificate?" }, { q: "Is it free?" }])]);
    const d = compareComponents(legacy, odyssey, OPTS, true);
    expect(d.status).toBe("match");
  });

  test("list item present in legacy only => missing", () => {
    const legacy = comp([listOf("items", [{ q: "Is it free?" }, { q: "Certificate?" }])]);
    const odyssey = comp([listOf("items", [{ q: "Is it free?" }])]);
    const d = compareComponents(legacy, odyssey, OPTS, true);
    expect(d.fields[0].status).toBe("missing");
    expect(d.fields[0].children?.some((c) => c.status === "missing")).toBe(true);
  });

  test("list item present in odyssey only => extra", () => {
    const legacy = comp([listOf("items", [{ q: "Is it free?" }])]);
    const odyssey = comp([listOf("items", [{ q: "Is it free?" }, { q: "New question?" }])]);
    const d = compareComponents(legacy, odyssey, OPTS, true);
    expect(d.fields[0].children?.some((c) => c.status === "extra")).toBe(true);
  });

  test("structured list item with a modified answer => modified", () => {
    const legacy = comp([listOf("items", [{ question: "Is it free?", answer: "Yes, completely free of charge." }])]);
    const odyssey = comp([listOf("items", [{ question: "Is it free?", answer: "No, it costs two hundred dollars." }])]);
    const d = compareComponents(legacy, odyssey, OPTS, true);
    expect(d.status).toBe("modified");
  });

  test("legacy mapping not authored => unmapped (excluded from scoring)", () => {
    const d = compareComponents(comp([txt("heading", "x")], false), comp([txt("heading", "y")]), OPTS, false);
    expect(d.status).toBe("unmapped");
  });

  test("component present in legacy but absent in odyssey => component-missing", () => {
    const d = compareComponents(comp([txt("heading", "x")], true), comp([], false), OPTS, true);
    expect(d.status).toBe("component-missing");
  });

  test("compareAsText: legacy bullets vs odyssey one combined paragraph => not itemized 'missing'", () => {
    // Without compareAsText, a 3-vs-1 count mismatch would leave 2 of legacy's 3 bullets unpaired
    // (shown as "missing") even though the content substantively overlaps — a structural false
    // positive, not a real content gap. With compareAsText, both sides are joined and compared
    // holistically instead.
    const legacy = comp([
      listText(
        "paragraphs",
        [
          "Blender is a free and open-source 3D creation suite.",
          "It supports modeling, animation, and rendering.",
          "It also has a built-in video editor.",
        ],
        true
      ),
    ]);
    const odyssey = comp([
      listText(
        "paragraphs",
        [
          "Blender is a free and open-source 3D creation suite that supports modeling, animation, and rendering, and it also has a built-in video editor.",
        ],
        true
      ),
    ]);
    const d = compareComponents(legacy, odyssey, OPTS, true);
    expect(d.fields[0].status).not.toBe("missing");
    expect(d.fields[0].children).toBeUndefined(); // joined text is a single comparison, not aligned items
  });

  test("without compareAsText, the same count mismatch DOES show unpaired items as missing (contrast case)", () => {
    const legacy = comp([listText("paragraphs", ["Bullet one.", "Bullet two.", "Bullet three."], false)]);
    const odyssey = comp([listText("paragraphs", ["One combined paragraph covering everything."], false)]);
    const d = compareComponents(legacy, odyssey, OPTS, true);
    expect(d.fields[0].children?.some((c) => c.status === "missing")).toBe(true);
  });
});

test.describe("extractor + engine (mock fixtures, different DOM, same content)", () => {
  // Legacy selector sets mirror the div-heavy /compare/legacy-sample fixture.
  const legacyHero: ComponentSelectorSet = {
    root: ".legacy-hero",
    fields: [
      { name: "heading", selector: ".title", kind: "text" },
      { name: "subheading", selector: ".subtitle", kind: "text", optional: true },
      { name: "cta", selector: ".cta", kind: "text", optional: true },
    ],
  };
  const legacyFaq: ComponentSelectorSet = {
    root: ".legacy-faq",
    fields: [
      { name: "heading", selector: "h2", kind: "text", optional: true },
      {
        name: "items",
        selector: ".faq-row",
        kind: "list",
        itemFields: [
          { name: "question", selector: ".q", kind: "text" },
          { name: "answer", selector: ".a", kind: "text" },
        ],
      },
    ],
  };
  // Odyssey selector sets reuse the shared presets against the semantic /compare/odyssey-sample.
  const odysseyHero: ComponentSelectorSet = { root: "#hero", fields: heroFields() };
  const odysseyFaq: ComponentSelectorSet = { root: "#faq, [data-slot='accordion']", fields: faqFields() };

  test("hero and FAQ reach parity across unrelated DOMs", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/compare/odyssey-sample`);
    const oHero = await extractComponent(page, "hero", "Hero", odysseyHero);
    const oFaq = await extractComponent(page, "faq", "FAQ", odysseyFaq);

    await page.goto(`${baseURL}/compare/legacy-sample`);
    const lHero = await extractComponent(page, "hero", "Hero", legacyHero);
    const lFaq = await extractComponent(page, "faq", "FAQ", legacyFaq);

    // Sanity: extraction actually pulled the content.
    expect(oHero.fields.find((f) => f.name === "heading")?.values[0]).toBe("Learn Blender");
    expect(lHero.fields.find((f) => f.name === "heading")?.values[0]).toBe("Learn Blender");

    const heroDiff = compareComponents(lHero, oHero, OPTS, true);
    const faqDiff = compareComponents(lFaq, oFaq, OPTS, true);
    expect(heroDiff.status, JSON.stringify(heroDiff, null, 2)).toBe("match");
    expect(faqDiff.status, JSON.stringify(faqDiff, null, 2)).toBe("match");
  });
});

test.describe("learn topic map: full component parity (mock fixtures)", () => {
  // Components whose legacy mapping was fixed by this change (heading-region or a real
  // declarative mapping). These use the REAL map's `legacy` set directly — the fixture DOM was
  // authored to match what that real mapping expects — so this test validates exactly what ships.
  const USES_REAL_LEGACY_MAPPING = ["topicOverview", "whyLearn", "exploreJobs", "relatedTopics"];

  // Legacy selector sets for the flat /compare/topic-legacy DOM, for components NOT in scope for
  // this change (still using hand-written test-only selectors matching the `.lg-*` CSS-class
  // fixture). Field names MUST match the Odyssey side (from learnCourseMap) so fields line up.
  const LEGACY_SETS: Record<string, ComponentSelectorSet> = {
    hero: {
      root: ".lg-hero",
      fields: [
        { name: "heading", selector: ".lg-title", kind: "text" },
        { name: "body", selector: ".lg-sub", kind: "text", optional: true },
      ],
    },
    navbar: {
      root: ".lg-nav",
      fields: [{ name: "items", selector: ".lg-navlink", kind: "list" }],
    },
    trendingCourses: {
      root: ".lg-trending",
      fields: [
        { name: "heading", selector: ".lg-head", kind: "text", optional: true },
        { name: "cards", selector: ".lg-course", kind: "list", itemFields: [{ name: "title", selector: ".lg-name", kind: "text" }] },
      ],
    },
    programListing: {
      root: ".lg-programs",
      fields: [
        { name: "categories", selector: ".lg-tab", kind: "list" },
        { name: "visibleCourses", selector: ".lg-prog", kind: "list", optional: true, itemFields: [{ name: "title", selector: ".lg-pname", kind: "text" }] },
      ],
    },
    curriculum: {
      root: ".lg-curriculum",
      fields: [
        { name: "heading", selector: ".lg-head", kind: "text" },
        { name: "paragraphs", selector: ".lg-para", kind: "list" },
      ],
    },
    programGuide: {
      root: ".lg-guide",
      fields: [
        { name: "heading", selector: ".lg-head", kind: "text" },
        { name: "intro", selector: ".lg-intro", kind: "list" },
        { name: "sections", selector: ".lg-gsec", kind: "list", itemFields: [
          { name: "title", selector: ".lg-gtitle", kind: "text" },
          { name: "paragraphs", selector: ".lg-gp", kind: "list" },
        ] },
      ],
    },
    jobsAccordion: {
      root: ".lg-jobs",
      fields: [
        { name: "heading", selector: ".lg-head", kind: "text", optional: true },
        { name: "description", selector: ".lg-desc", kind: "text", optional: true },
        { name: "jobs", selector: ".lg-job", kind: "list", itemFields: [
          { name: "title", selector: ".lg-jtitle", kind: "text" },
          { name: "description", selector: ".lg-jbody", kind: "text" },
        ] },
      ],
    },
    faq: {
      root: ".lg-faq",
      fields: [
        { name: "heading", selector: ".lg-head", kind: "text", optional: true },
        { name: "items", selector: ".lg-qa", kind: "list", itemFields: [
          { name: "question", selector: ".lg-q", kind: "text" },
          { name: "answer", selector: ".lg-a", kind: "text" },
        ] },
      ],
    },
    references: {
      root: ".lg-refs",
      fields: [
        { name: "items", selector: "ol > li", kind: "list", itemFields: [
          { name: "text", selector: "a", kind: "text" },
          { name: "citation", selector: ".lg-rcite", kind: "text", optional: true },
        ] },
      ],
    },
  };

  test("every mapped component reaches parity across odyssey vs legacy DOM", async ({ page, baseURL }) => {
    // Extract each component from the Odyssey-style fixture using the REAL shipped selectors.
    await page.goto(`${baseURL}/compare/topic-odyssey`);
    const odyssey: Record<string, NormalizedComponent> = {};
    for (const m of learnCourseMap.components) {
      odyssey[m.type] = await extractComponent(page, m.type, m.label, m.odyssey);
    }

    // Extract each from the legacy-style fixture. Fixed components use the REAL map's `legacy` set
    // (heading-region or the real declarative mapping); the rest use the hand-written test-only
    // selectors matching the `.lg-*` CSS-class fixture.
    await page.goto(`${baseURL}/compare/topic-legacy`);
    const legacy: Record<string, NormalizedComponent> = {};
    for (const m of learnCourseMap.components) {
      const set = USES_REAL_LEGACY_MAPPING.includes(m.type) ? m.legacy : LEGACY_SETS[m.type];
      legacy[m.type] = await extractComponent(page, m.type, m.label, set);
    }

    // Sanity: the trickier structural selectors actually pulled content.
    const curr = odyssey.curriculum.fields.find((f) => f.name === "paragraphs");
    expect(curr?.values.length, "curriculum paragraphs (xpath=./p)").toBe(2);
    const guideIntro = odyssey.programGuide.fields.find((f) => f.name === "intro");
    expect(guideIntro?.values.length, "program guide intro (direct-child p only)").toBe(1);
    expect(odyssey.whyLearn.present, "why-learn resolved via sibling selector").toBe(true);

    // Heading-region + real-mapping specific assertions (this is the bug-fix under test):
    // trailing empty <p></p>/<li> noise must be filtered, and "View all topics" must be excluded.
    expect(legacy.topicOverview.present, "topic overview resolved via heading-region").toBe(true);
    expect(
      legacy.topicOverview.fields.find((f) => f.name === "paragraphs")?.values.length,
      "topic overview: trailing empty <p></p> filtered out"
    ).toBe(2);
    expect(legacy.whyLearn.present, "why learn resolved via heading-region").toBe(true);
    expect(legacy.exploreJobs.present, "explore jobs resolved via heading-region").toBe(true);
    expect(
      legacy.exploreJobs.fields.find((f) => f.name === "paragraphs")?.values.length,
      "explore jobs: trailing empty <p></p> filtered out"
    ).toBe(2);
    expect(
      legacy.relatedTopics.fields.find((f) => f.name === "items")?.values,
      "related topics: 'View all topics' link excluded"
    ).toEqual(["3D Modeling", "Animation", "Rendering"]);

    // Every component must reach parity.
    for (const m of learnCourseMap.components) {
      const diff = compareComponents(legacy[m.type], odyssey[m.type], OPTS, true);
      expect(diff.status, `${m.label}: ${JSON.stringify(diff, null, 2)}`).toBe("match");
    }
  });
});

test.describe("topicOverview (odyssey): body extraction robust to plain-text content (no <p> wrapper)", () => {
  // Regression for a live-run bug: Odyssey's TopicOverview renders its body via ExpandableHtml ->
  // TextWithDirection, which only wraps content in dangerouslySetInnerHTML (preserving any <p>
  // tags from the CMS source) when it detects actual HTML markup — a plain-text description
  // renders as a bare text node with NO <p> wrapper at all. Selecting on "p" then finds nothing,
  // and the whole field comes back empty even though the container clearly has text. Fixed by
  // targeting the `.space-y-4` wrapper directly (present unconditionally either way) as one
  // combined text field, instead of assuming <p> tags exist.
  test("body has no <p> tags at all (plain-text CMS content) => still extracted, not empty", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
  <div class="gutter-padding max-w-7xl">
    <h2>What is Bookkeeping?</h2>
    <div class="unicode-bidi-plaintext space-y-4 text-mdplus text-gray-700">Bookkeeping is the process of recording daily financial transactions for a business.</div>
  </div>
</body></html>`);
    const m = learnCourseMap.components.find((c) => c.type === "topicOverview")!;
    const result = await extractComponent(page, m.type, m.label, m.odyssey);
    expect(result.present).toBe(true);
    expect(result.fields.find((f) => f.name === "heading")?.values[0]).toBe("What is Bookkeeping?");
    const paragraphs = result.fields.find((f) => f.name === "paragraphs");
    expect(paragraphs?.kind).toBe("text");
    expect(paragraphs?.values[0]).toContain("Bookkeeping is the process of recording daily financial transactions");
  });

  test("body IS wrapped in <p> tags (HTML CMS content) => still extracted correctly (no regression)", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
  <div class="gutter-padding max-w-7xl">
    <h2>What is Bookkeeping?</h2>
    <div class="unicode-bidi-plaintext space-y-4 text-mdplus text-gray-700">
      <p>Bookkeeping is the process of recording daily financial transactions for a business.</p>
      <p>It supports accurate financial reporting.</p>
    </div>
  </div>
</body></html>`);
    const m = learnCourseMap.components.find((c) => c.type === "topicOverview")!;
    const result = await extractComponent(page, m.type, m.label, m.odyssey);
    const paragraphs = result.fields.find((f) => f.name === "paragraphs");
    expect(paragraphs?.values[0]).toContain("Bookkeeping is the process of recording daily financial transactions");
    expect(paragraphs?.values[0]).toContain("It supports accurate financial reporting");
  });
});

test.describe("heading-region: generic across differently-shaped legacy pages (real-DOM regression)", () => {
  // Verbatim (trimmed of unrelated noise like SVG icon markup) DOMs from the original bug reports
  // in issues.html, covering TWO structurally different legacy shapes:
  //   - Blender: Topic Overview / Explore Jobs / Related Topics as self-contained wrapper divs.
  //   - Computer Science: Topic Overview / Why Learn as flat siblings inside one shared rich-text
  //     div, delimited by empty `<a id="...">` anchor markers.
  // The SAME headingRegionSet() specs from learnCourseMap must resolve both shapes correctly —
  // this is the direct regression test for the reported bugs.

  test("Blender: Topic Overview resolves from a self-contained div (issues.html #1)", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="flex flex-wrap py-12"><div><h2>What is Blender?</h2><p>Blender is a free and open-source 3D creation suite. It can create everything from visual effects for movies and games to printed models and simulations.</p><p></p></div></div>
</body></html>`);
    const m = learnCourseMap.components.find((c) => c.type === "topicOverview")!;
    const result = await extractComponent(page, m.type, m.label, m.legacy);
    expect(result.present).toBe(true);
    expect(result.fields.find((f) => f.name === "heading")?.values[0]).toBe("What is Blender?");
    expect(result.fields.find((f) => f.name === "paragraphs")?.values.length).toBe(1);
  });

  test("Blender: Related Topics resolves and excludes 'View all topics' (issues.html #2)", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="pt-0 pb-6 fullwidth bg-putty-100"><h3 class="mb-8 mt-0 text-2xl">Related Topics</h3><div class="flex gap-3 overflow-x-auto scroll-smooth not-prose"><a href="/learn/information-technology">Information Technology</a><a href="/learn/finance">Finance</a><a href="/learn/computer-science">Computer Science</a></div><div class="pt-4"><a class="text-gray-dark text-sm underline" href="/learn">View all topics</a></div></div>
</body></html>`);
    const m = learnCourseMap.components.find((c) => c.type === "relatedTopics")!;
    const result = await extractComponent(page, m.type, m.label, m.legacy);
    expect(result.present).toBe(true);
    expect(result.fields.find((f) => f.name === "items")?.values).toEqual([
      "Information Technology",
      "Finance",
      "Computer Science",
    ]);
  });

  test("Blender: Explore Jobs resolves from a rich-text div with a bulleted list (issues.html #3)", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="Default_content__HO8we"><div id=""><h2>Explore Blender jobs</h2><p>Having skills with Blender can be beneficial for professionals who create educational content, 3D printing models, or 2D animations for social media. Some careers that can use Blender include: </p><ul><li><b>3D artist:</b> Develops 3D models, animations, and other visual effects.</li><li><b>Animator:</b> Creates 2D and 3D animations.</li><li><b>Modeler:</b> Produces 3D models of objects, characters, and environments.</li></ul><p>Professionals with Blender expertise may work in film, television, video games, advertising, forensics, architectural visualization, and more.</p><p></p></div></div>
</body></html>`);
    const m = learnCourseMap.components.find((c) => c.type === "exploreJobs")!;
    const result = await extractComponent(page, m.type, m.label, m.legacy);
    expect(result.present).toBe(true);
    expect(result.fields.find((f) => f.name === "paragraphs")?.values.length).toBe(2);
    expect(result.fields.find((f) => f.name === "items")?.values.length).toBe(3);
  });

  test("Computer Science: Topic Overview and Why Learn resolve independently from a shared anchor-delimited div (issues.html #6)", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="Default_content__HO8we"><a class="subnav-item -mt-1" name="What is computer science?" id="overview"></a><h2>What is computer science?</h2><p>Computer science focuses on applying computing, algorithms, and programming techniques to operating systems, artificial intelligence (AI), and informatics.</p><p>Computers are used in nearly all fields of study and professions.</p><a class="subnav-item -mt-1" name="Why learn computer science?" id="why"></a><h2>Why learn computer science?</h2><div class="mt-xl-0 col-xl-8"><ul class="list-none list-image-none list-inside grid grid-cols-1"><li>You can qualify for opportunities in a high-growth field.</li><li>By studying computer science, you can become a problem-solver in high-impact fields.</li></ul></div></div>
</body></html>`);
    const overviewMap = learnCourseMap.components.find((c) => c.type === "topicOverview")!;
    const whyMap = learnCourseMap.components.find((c) => c.type === "whyLearn")!;
    const overview = await extractComponent(page, overviewMap.type, overviewMap.label, overviewMap.legacy);
    const why = await extractComponent(page, whyMap.type, whyMap.label, whyMap.legacy);

    expect(overview.present).toBe(true);
    expect(overview.fields.find((f) => f.name === "heading")?.values[0]).toBe("What is computer science?");
    expect(overview.fields.find((f) => f.name === "paragraphs")?.values.length).toBe(2);

    expect(why.present).toBe(true);
    expect(why.fields.find((f) => f.name === "heading")?.values[0]).toBe("Why learn computer science?");
    expect(why.fields.find((f) => f.name === "items")?.values.length).toBe(2);
  });
});

test.describe("odyssey selectors: robust against absent siblings and cross-matching", () => {
  // Regression for a live-run bug on /learn/computer-science: with no adjacency anchor, Curriculum's
  // `.first()` fell through to an unrelated section when curriculum data was absent, and Why Learn's
  // loose `~`/unrestricted `:has()` cross-matched Topic Overview's own heading.
  //   - Curriculum: anchored to the one stable id (#explore-jobs) via a GENERAL-sibling
  //     (:has(~ #explore-jobs)) combinator + `pick: "last"` (closest match to the anchor) — a
  //     page.tsx source-order guarantee, independent of which CMS content happens to be present.
  //     A first attempt used a STRICT adjacent-sibling (`+`) combinator, which turned out too
  //     strict on at least one live topic page (see the "pick: last" test below).
  //   - Why Learn: a first attempt at the same CSS-adjacency approach did not hold up against the
  //     live site, so it was switched to heading-region matching (text pattern, any heading level) —
  //     see the "tag-agnostic" test below for the case that specifically exercises this.
  test("curriculum absent + why-learn present: curriculum reports absent, why-learn resolves its OWN heading (not Topic Overview's)", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
  <div class="gutter-padding"><h2>What is computer science?</h2><div class="space-y-4"><p>Topic overview body.</p></div></div>
  <div class="main-grid">
    <!-- No Curriculum section rendered at all (its CMS content is absent for this topic). -->
    <section id="explore-jobs" class="py-12"><h2>Explore computer science jobs</h2><ul class="list-disc"><li>Role one.</li></ul></section>
    <section class="py-12"><h2>Why learn computer science?</h2><ul class="list-disc"><li>Reason one.</li></ul></section>
  </div>
</body></html>`);
    const curriculumMap = learnCourseMap.components.find((c) => c.type === "curriculum")!;
    const whyMap = learnCourseMap.components.find((c) => c.type === "whyLearn")!;

    const curriculum = await extractComponent(page, curriculumMap.type, curriculumMap.label, curriculumMap.odyssey);
    const why = await extractComponent(page, whyMap.type, whyMap.label, whyMap.odyssey);

    expect(curriculum.present, "curriculum must NOT false-match an unrelated section").toBe(false);
    expect(why.present).toBe(true);
    expect(why.fields.find((f) => f.name === "heading")?.values[0]).toBe("Why learn computer science?");
  });

  test("curriculum present: still resolves correctly when immediately before #explore-jobs", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
  <div class="main-grid">
    <section class="py-12"><h3>Course curriculum</h3><p>Module one.</p></section>
    <section id="explore-jobs" class="py-12"><h2>Explore computer science jobs</h2><ul class="list-disc"><li>Role one.</li></ul></section>
    <section class="py-12"><h2>Why learn computer science?</h2><ul class="list-disc"><li>Reason one.</li></ul></section>
  </div>
</body></html>`);
    const curriculumMap = learnCourseMap.components.find((c) => c.type === "curriculum")!;
    const curriculum = await extractComponent(page, curriculumMap.type, curriculumMap.label, curriculumMap.odyssey);
    expect(curriculum.present).toBe(true);
    expect(curriculum.fields.find((f) => f.name === "heading")?.values[0]).toBe("Course curriculum");
  });

  test("curriculum: pick:'last' resolves the CLOSEST h3.py-12 section to #explore-jobs, not an earlier unrelated one", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
  <div class="main-grid">
    <section class="py-12"><h3>Unrelated earlier section</h3><p>Should not be picked.</p></section>
    <section class="py-12"><h3>Course curriculum</h3><p>Should be picked (closest to #explore-jobs).</p></section>
    <section id="explore-jobs" class="py-12"><h2>Explore computer science jobs</h2><ul class="list-disc"><li>Role one.</li></ul></section>
  </div>
</body></html>`);
    const curriculumMap = learnCourseMap.components.find((c) => c.type === "curriculum")!;
    const curriculum = await extractComponent(page, curriculumMap.type, curriculumMap.label, curriculumMap.odyssey);
    expect(curriculum.present).toBe(true);
    expect(curriculum.fields.find((f) => f.name === "heading")?.values[0]).toBe("Course curriculum");
  });

  test("why-learn: tag-agnostic — resolves as <h3> with no #explore-jobs nearby, doesn't cross-match Topic Overview", async ({ page }) => {
    // Deliberately violates every assumption the old CSS-adjacency approach depended on: no
    // #explore-jobs anchor anywhere on the page, "Why learn …" rendered as h3 (not h2), and nested
    // inside an arbitrary wrapper unrelated to any .py-12 section. Topic Overview's own heading
    // ("What is …") sits nearby with a similarly generic wrapper, to prove no cross-matching.
    await page.setContent(`<!DOCTYPE html><html><body>
  <div class="gutter-padding"><h2>What is computer science?</h2><div class="space-y-4"><p>Topic overview body.</p></div></div>
  <div class="some-arbitrary-wrapper">
    <div class="inner"><h3>Why learn computer science?</h3><ul><li>Reason one.</li><li>Reason two.</li></ul></div>
  </div>
</body></html>`);
    const whyMap = learnCourseMap.components.find((c) => c.type === "whyLearn")!;
    const why = await extractComponent(page, whyMap.type, whyMap.label, whyMap.odyssey);
    expect(why.present).toBe(true);
    expect(why.fields.find((f) => f.name === "heading")?.values[0]).toBe("Why learn computer science?");
    expect(why.fields.find((f) => f.name === "items")?.values).toEqual(["Reason one.", "Reason two."]);
  });
});

test.describe("curriculum: two legacy rendering styles (positional anchor, not heading text)", () => {
  // Curriculum's heading wording does NOT follow a template across topics — confirmed by real DOM:
  // "Blender course curriculum" vs "How to get started in computer science". A heading-text-pattern
  // fix (like Topic Overview/Why Learn/Explore Jobs) would have quietly broken whichever topic's
  // wording it didn't match. Legacy is located instead by POSITION relative to Explore Jobs's
  // heading (which DOES follow a template), walking backward and skipping known earlier headings.

  test("simple style (Blender, verbatim real DOM): plain heading + paragraphs, no tabs", async ({ page }) => {
    const heading = "Blender course curriculum";
    const p1 =
      "A beginner course on Blender may introduce the software and its capabilities. It may cover the basics of 3D modeling, animation, rendering, and compositing.";
    const p2 =
      "Learning about how to use this tool can supplement your knowledge of web development and computer science. edX offers a variety of educational opportunities for learners interested in studying these topics.";

    await page.setContent(`<!DOCTYPE html><html><body>
  <section class="py-12"><h3>${heading}</h3><p>${p1}</p><p>${p2}</p></section>
  <section id="explore-jobs" class="py-12"><h2>Explore Blender jobs</h2><ul class="list-disc"><li>3D artist role.</li></ul></section>
</body></html>`);
    const curriculumMap = learnCourseMap.components.find((c) => c.type === "curriculum")!;
    const odyssey = await extractComponent(page, curriculumMap.type, curriculumMap.label, curriculumMap.odyssey);
    expect(odyssey.present).toBe(true);
    expect(odyssey.fields.find((f) => f.name === "heading")?.values[0]).toBe(heading);
    expect(odyssey.fields.find((f) => f.name === "paragraphs")?.values).toEqual([p1, p2]);

    await page.setContent(`<!DOCTYPE html><html><body>
  <div class="Default_content__HO8we"><div id=""><h3>${heading}</h3><p>${p1}</p><p>${p2}</p><p></p></div></div>
  <h2>Explore Blender jobs</h2>
  <ul><li>3D artist role.</li></ul>
</body></html>`);
    const legacy = await extractComponent(page, curriculumMap.type, curriculumMap.label, curriculumMap.legacy);
    expect(legacy.present).toBe(true);
    expect(legacy.fields.find((f) => f.name === "heading")?.values[0]).toBe(heading);
    // Trailing empty <p></p> must be filtered out (2 values, not 3).
    expect(legacy.fields.find((f) => f.name === "paragraphs")?.values).toEqual([p1, p2]);

    const diff = compareComponents(legacy, odyssey, OPTS, true);
    expect(diff.status, JSON.stringify(diff, null, 2)).toBe("match");
  });

  test("tabbed style (Computer Science): clicks through every tab, folds all content in (not just the first/active tab)", async ({ page }) => {
    // Simulates Radix's real lazy-mount behavior with vanilla JS: only the first tab's content
    // exists in the initial HTML; the other 3 panels' content is injected ONLY on click — proving
    // extraction genuinely requires the click (reading pre-rendered-but-hidden content would not
    // exercise the same code path a real lazily-mounted widget does).
    await page.setContent(`<!DOCTYPE html><html><body>
  <h2>How to get started in computer science</h2>
  <p>The outset of your journey to learn computer science can feel daunting.</p>
  <div class="not-prose">
    <div role="tablist">
      <button role="tab" data-target="panel-1">Focus on foundations</button>
      <button role="tab" data-target="panel-2">Consider a certificate</button>
      <button role="tab" data-target="panel-3">Enroll in a degree program</button>
      <button role="tab" data-target="panel-4">Continue with advanced education</button>
    </div>
    <div role="tabpanel" id="panel-1" data-state="active">
      <h3>1. Focus on foundations</h3>
      <p>Many computer science concepts draw heavily on logic and math.</p>
      <ul><li>Classical rule-based logic systems</li><li>Boolean logic</li></ul>
    </div>
    <div role="tabpanel" id="panel-2" data-state="inactive" hidden></div>
    <div role="tabpanel" id="panel-3" data-state="inactive" hidden></div>
    <div role="tabpanel" id="panel-4" data-state="inactive" hidden></div>
  </div>
  <h2>Explore computer science jobs</h2>
  <ul><li>Data scientist role.</li></ul>
  <script>
    const LAZY_CONTENT = {
      "panel-2": "<h3>2. Consider a certificate</h3><p>Certificates can boost your resume quickly.</p>",
      "panel-3": "<h3>3. Enroll in a degree program</h3><p>Degrees offer comprehensive foundational education.</p>",
      "panel-4": "<h3>4. Continue with advanced education</h3><p>Advanced study deepens specialized expertise.</p>",
    };
    document.querySelectorAll('[role="tab"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll('[role="tabpanel"]').forEach((p) => {
          p.dataset.state = "inactive";
          p.hidden = true;
        });
        const targetId = btn.getAttribute("data-target");
        const target = document.getElementById(targetId);
        if (LAZY_CONTENT[targetId] && !target.dataset.loaded) {
          target.innerHTML = LAZY_CONTENT[targetId];
          target.dataset.loaded = "true";
        }
        target.dataset.state = "active";
        target.hidden = false;
      });
    });
  </script>
</body></html>`);
    const curriculumMap = learnCourseMap.components.find((c) => c.type === "curriculum")!;
    const legacy = await extractComponent(page, curriculumMap.type, curriculumMap.label, curriculumMap.legacy);

    expect(legacy.present).toBe(true);
    expect(legacy.fields.find((f) => f.name === "heading")?.values[0]).toBe(
      "How to get started in computer science"
    );
    const paragraphs = legacy.fields.find((f) => f.name === "paragraphs")?.values ?? [];
    // Must contain content from the intro paragraph AND all 4 tabs, not just the first/active one.
    expect(paragraphs.some((v) => v.includes("outset of your journey"))).toBe(true);
    expect(paragraphs.some((v) => v.includes("Classical rule-based logic systems"))).toBe(true);
    expect(paragraphs.some((v) => v.includes("boost your resume"))).toBe(true);
    expect(paragraphs.some((v) => v.includes("comprehensive foundational education"))).toBe(true);
    expect(paragraphs.some((v) => v.includes("deepens specialized expertise"))).toBe(true);
  });

  test("absent: backward walk skips Related Topics AND Topic Overview's headings, returns absent (not a false match)", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
  <h2>What is computer science?</h2>
  <p>Topic overview text.</p>
  <h3>Related Topics</h3>
  <a href="/x">Chip</a>
  <!-- No Curriculum heading at all — its content is genuinely absent for this topic. -->
  <h2>Explore computer science jobs</h2>
  <ul><li>Role.</li></ul>
</body></html>`);
    const curriculumMap = learnCourseMap.components.find((c) => c.type === "curriculum")!;
    const legacy = await extractComponent(page, curriculumMap.type, curriculumMap.label, curriculumMap.legacy);
    expect(legacy.present, "must not false-match Related Topics or Topic Overview's heading").toBe(false);
  });
});

test.describe("learn hub map: every odyssey selector resolves (mock fixture)", () => {
  // Odyssey-only fixture (legacy is null for every component on this page type, pending a
  // follow-up DOM-paste round) — validates every shipped selector against a fixture built from
  // the real page.tsx + component source, not just that it typechecks.
  test("hero, uspBlock, trendingTopics, trendingCourses, topicDirectory, faq all resolve with real content", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/compare/learn-hub-odyssey`);

    const extract = async (type: string) => {
      const m = learnMap.components.find((c) => c.type === type)!;
      return extractComponent(page, m.type, m.label, m.odyssey);
    };

    const hero = await extract("hero");
    expect(hero.present).toBe(true);
    expect(hero.fields.find((f) => f.name === "heading")?.values[0]).toBe("Find the right course for you");

    const usp = await extract("uspBlock");
    expect(usp.present).toBe(true);
    const uspItems = usp.fields.find((f) => f.name === "items")?.items ?? [];
    expect(uspItems.length).toBe(2);
    expect(uspItems[0].find((f) => f.name === "title")?.values[0]).toBe("Learn from experts");
    expect(uspItems[0].find((f) => f.name === "description")?.values[0]).toBe(
      "Courses developed by leading universities."
    );

    const trendingTopics = await extract("trendingTopics");
    expect(trendingTopics.present).toBe(true);
    expect(trendingTopics.fields.find((f) => f.name === "items")?.values).toEqual([
      "Computer Science",
      "Data Science",
      "Business",
    ]);

    const trendingCourses = await extract("trendingCourses");
    expect(trendingCourses.present).toBe(true);
    const cards = trendingCourses.fields.find((f) => f.name === "cards")?.items ?? [];
    expect(cards.length).toBe(2);
    expect(cards[0].find((f) => f.name === "title")?.values[0]).toBe("Introduction to Python");

    const topicDirectory = await extract("topicDirectory");
    expect(topicDirectory.present).toBe(true);
    const categories = topicDirectory.fields.find((f) => f.name === "categories")?.items ?? [];
    expect(categories.length).toBe(2);
    expect(categories[0].find((f) => f.name === "category")?.values[0]).toBe("Computer Science");
    // Confirms the "|" separator span is excluded (only real subtopic links counted).
    expect(categories[0].find((f) => f.name === "subtopics")?.values).toEqual(["Python", "Java"]);

    const faq = await extract("faq");
    expect(faq.present).toBe(true);
    expect(faq.fields.find((f) => f.name === "heading")?.values[0]).toBe("Frequently asked questions");
    const faqItems = faq.fields.find((f) => f.name === "items")?.items ?? [];
    expect(faqItems.length).toBe(2);
    expect(faqItems[0].find((f) => f.name === "question")?.values[0]).toBe("Is edX free?");
  });
});

test.describe("course-detail map: every odyssey selector resolves (mock fixture)", () => {
  test("courseHero, whatYoullLearn, aboutCourse, meetInstructors, testimonials, coursePricing, faq all resolve with real content", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/compare/learn-deep-odyssey`);

    const extract = async (type: string) => {
      const m = learnDeepMap.components.find((c) => c.type === type)!;
      return extractComponent(page, m.type, m.label, m.odyssey);
    };

    const hero = await extract("courseHero");
    expect(hero.present).toBe(true);
    expect(hero.fields.find((f) => f.name === "heading")?.values[0]).toBe(
      "Agentic AI with LangChain and LangGraph"
    );
    expect(hero.fields.find((f) => f.name === "body")?.values[0]).toContain("autonomous AI agents");

    const wyl = await extract("whatYoullLearn");
    expect(wyl.present).toBe(true);
    expect(wyl.fields.find((f) => f.name === "items")?.values).toEqual([
      "Build multi-agent workflows.",
      "Integrate LLMs with external tools.",
    ]);

    const about = await extract("aboutCourse");
    expect(about.present).toBe(true);
    expect(about.fields.find((f) => f.name === "heading")?.values[0]).toBe("About this course");
    expect(about.fields.find((f) => f.name === "paragraphs")?.values[0]).toContain(
      "fundamentals of agentic AI systems"
    );

    const instructors = await extract("meetInstructors");
    expect(instructors.present).toBe(true);
    const instructorItems = instructors.fields.find((f) => f.name === "instructors")?.items ?? [];
    expect(instructorItems.length).toBe(2);
    expect(instructorItems[0].find((f) => f.name === "name")?.values[0]).toBe("Dr. Ada Lovelace");
    expect(instructorItems[0].find((f) => f.name === "title")?.values[0]).toBe("Professor of Computer Science");

    const testimonials = await extract("testimonials");
    expect(testimonials.present).toBe(true);
    const testimonialItems = testimonials.fields.find((f) => f.name === "items")?.items ?? [];
    expect(testimonialItems.length).toBe(2);
    expect(testimonialItems[0].find((f) => f.name === "quote")?.values[0]).toContain("changed how I think");
    expect(testimonialItems[0].find((f) => f.name === "name")?.values[0]).toBe("Jane Smith");
    expect(testimonialItems[0].find((f) => f.name === "location")?.values[0]).toBe("United States");

    const pricing = await extract("coursePricing");
    expect(pricing.present).toBe(true);
    // Regression: "Certificate" and the price share identical classes — must resolve to the
    // price ($149 USD), not the "Certificate" label.
    expect(pricing.fields.find((f) => f.name === "price")?.values[0]).toBe("$149 USD");
    expect(pricing.fields.find((f) => f.name === "seatLabel")?.values[0]).toBe("Verified");

    const faq = await extract("faq");
    expect(faq.present).toBe(true);
    expect(faq.fields.find((f) => f.name === "heading")?.values[0]).toBe("Frequently asked questions");
  });

  test("courseCurriculum: clicks 'show more' to reveal week 3, which is genuinely absent from the DOM until clicked", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/compare/learn-deep-odyssey`);
    const m = learnDeepMap.components.find((c) => c.type === "courseCurriculum")!;
    const result = await extractComponent(page, m.type, m.label, m.odyssey);

    expect(result.present).toBe(true);
    const weeks = result.fields.find((f) => f.name === "weeks");
    // Flat, consolidated list (not itemized): every week title + every sub-item's text, in order.
    expect(weeks?.compareAsText).toBe(true);
    expect(weeks?.values, "must include week 3, not just the 2 initially visible").toEqual([
      "Week 1: Introduction to Agents",
      "Basics of AI agents",
      "Week 2: Building with LangChain",
      "LangChain setup and tools",
      "Week 3: Advanced Workflows",
      "Multi-agent orchestration",
    ]);
  });

  test("whatYoullLearn: does NOT false-match the whole-page layout <section>, even when an earlier sibling component has its own 'read more' list", async ({ page }) => {
    // Regression for a live-run bug: learn/layout.tsx's single <section> wraps the ENTIRE
    // course-detail page (no more specific route layout exists), so an unrestricted
    // `section:has(#what-youll-learn-heading)` ALSO matches that outer wrapper (it "has" the id as
    // a descendant, just not a direct child) and — being first in document order — gets picked
    // instead of what-youll-learn.tsx's own <section>. `ul li` then sweeps in <li>s from any
    // earlier sibling, e.g. the hero sidebar's "Show more" skills list. The fix requires the id'd
    // heading to be a DIRECT CHILD of the matched <section>.
    await page.setContent(`<!DOCTYPE html><html><body>
<section class="full-bleed main-grid">
  <div id="course-hero">
    <ul aria-label="Skills you'll gain"><li>Python</li><li>LangChain</li></ul>
    <button aria-expanded="false">Show more</button>
  </div>
  <section class="py-8 md:py-12">
    <h2 id="what-youll-learn-heading">What you'll learn</h2>
    <ul class="grid grid-cols-1 gap-x-12 gap-y-4 px-6 text-lg md:grid-cols-2">
      <li><span>Describe why automation is important.</span></li>
      <li><span>Understand basic API mechanisms.</span></li>
    </ul>
  </section>
</section>
</body></html>`);
    const m = learnDeepMap.components.find((c) => c.type === "whatYoullLearn")!;
    const result = await extractComponent(page, m.type, m.label, m.odyssey);
    expect(result.present).toBe(true);
    expect(
      result.fields.find((f) => f.name === "items")?.values,
      "must be exactly the 2 real bullets, not swept-in <li>s from the hero sidebar's skills list"
    ).toEqual(["Describe why automation is important.", "Understand basic API mechanisms."]);
  });
});

test.describe("course-detail map: every LEGACY selector resolves (real-DOM regression)", () => {
  // Verbatim (trimmed of unrelated img/svg/srcset noise) DOM pasted from a real legacy course-detail
  // page (AWS: Automation in the AWS Cloud) into learn/deep/legacy-dom-input-learn-deep.md. Every wrapper
  // class/tag/nesting depth the legacy selectors below depend on is preserved as-is.
  const legacyOf = (type: string) => learnDeepMap.components.find((c) => c.type === type)!.legacy!;

  test("courseHero: heading + both description paragraphs (fully present, only CSS line-clamped)", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="hidden md:block"><div class="bg-white rounded-xl py-6 px-4 sm:p-10 md:flex md:items-start md:justify-between}"><div class="flex flex-col gap-5 w-full"><div class="flex border-putty-400 border-b pb-4 w-full gap-4"><div class="flex flex-col"><div class="flex justify-center sm:justify-start"><a class="d-inline-block" href="/school/aws"><img alt="AWS logo"></a></div><div class="flex flex-col gap-5"><h1 class="m-0 p-0 tracking-tight " style="font-weight: 900;">AWS: Automation in the AWS Cloud</h1><div class="md:[&_p]:text-lg [&_p]:m-0 w-full"><div data-testid="expandable-text-content" class="line-clamp-2 transition-all duration-300 ease-in-out"><p>This three-module course covers automation topics.</p><p>The content is divided into modules that build on top of each other.</p></div><button data-testid="toggle-button" class="mt-2 text-sm underline underline-offset-2">Show more</button></div><div id="enroll"></div></div></div></div></div></div></div>
</body></html>`);
    const result = await extractComponent(page, "courseHero", "Course Hero", legacyOf("courseHero"));
    expect(result.present).toBe(true);
    expect(result.fields.find((f) => f.name === "heading")?.values[0]).toBe(
      "AWS: Automation in the AWS Cloud"
    );
    const body = result.fields.find((f) => f.name === "body");
    expect(body?.values).toEqual([
      "This three-module course covers automation topics.",
      "The content is divided into modules that build on top of each other.",
    ]);
  });

  test("whatYoullLearn: bullet items resolve, heading text disambiguates from the reused 'flex flex-col gap-6' wrapper class", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="flex flex-col gap-6"><h2 class="my-0 text-primary md:text-3xl font-bold">What you'll learn</h2><div class="md:columns-2"><ul><li class="flex items-start pl-2 break-inside-avoid-column"><img alt=""><span class="flex-1">Describe why automation is important.</span></li><li class="flex items-start pl-2 break-inside-avoid-column"><img alt=""><span class="flex-1">Understand basic API mechanisms.</span></li></ul></div></div>
</body></html>`);
    const result = await extractComponent(page, "whatYoullLearn", "What You'll Learn", legacyOf("whatYoullLearn"));
    expect(result.present).toBe(true);
    expect(result.fields.find((f) => f.name === "items")?.values).toEqual([
      "Describe why automation is important.",
      "Understand basic API mechanisms.",
    ]);
  });

  test("aboutCourse: heading + 3 separate <p> tags joined via compareAsText (no .space-y-4 equivalent on legacy)", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="relative grid grid-cols-1 xl:grid-cols-1 lg:grid-cols-2 gap-y-12 lg:gap-12"><div class="flex flex-col gap-4"><h2 class="md:text-3xl font-bold mt-0 mb-0">About this course</h2><div class="mx-auto bg-inherit max-w-full"><div data-testid="expandable-block" class="overflow-hidden transition-max-height duration-500 ease-in-out relative max-h-fit"><div class="h-100"><div class="text-gray-800"><p class="text-base md:text-lg text-gray-800 font-sans">This three-module course covers automation topics.</p><p class="text-base md:text-lg text-gray-800 font-sans">The content is divided into modules that build on top of each other.</p><p class="text-base md:text-lg text-gray-800 font-sans">An AWS Cloud Technology Consultant is someone who advises clients.</p></div></div></div><button data-testid="expandable-block-trigger">Show less</button></div></div><div class="w-full flex justify-center items-start hidden md:flex xl:hidden"></div></div>
</body></html>`);
    const result = await extractComponent(page, "aboutCourse", "About This Course", legacyOf("aboutCourse"));
    expect(result.present).toBe(true);
    expect(result.fields.find((f) => f.name === "heading")?.values[0]).toBe("About this course");
    const paragraphs = result.fields.find((f) => f.name === "paragraphs");
    expect(paragraphs?.compareAsText).toBe(true);
    expect(paragraphs?.values.length).toBe(3);
  });

  test("courseCurriculum: flattens every <p> (title-only, or title+<br>-joined items) into one consolidated list, robust to an irregular (odd) <p> count, and excludes the info-bar's own <p> tags", async ({ page }) => {
    // Deliberately includes a lone title-only <p> ("Welcome", no colon/items — mirrors real CMS
    // content like the "Welcome"/"Course Introduction" entries seen on a live course) BEFORE the
    // regular title/items pairs, making the total <p> count ODD (7). The old "pair every 2
    // consecutive <p>" logic would have mis-paired "Welcome" with "Week 1: Why Automate?" as its
    // own "items" — this proves the new flat, no-pairing-assumption extraction handles it correctly.
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="flex flex-col gap-6"><h2 class="m-0 md:text-3xl">Curriculum</h2><div class="border border-putty-400 rounded-xl"><div class="flex flex-col align-items-center gap-4 py-6 px-4 sm:px-10 bg-putty-400 rounded-t-xl"><h3 class="m-0 text-gray-800 text-xl">3 Weeks, 2-4 hours per week</h3><div class="flex flex-col sm:flex-row gap-4 flex-wrap"><div class="flex flex-row gap-4"><p class="text-primary sm:text-gray-800 font-bold m-0 text-sm sm:text-base">Language</p><p class="m-0 text-sm sm:text-base">English</p></div></div></div><div class="py-8 bg-white rounded-b-xl px-4 sm:px-10"><div class="mx-auto bg-inherit"><div data-testid="expandable-block" class="overflow-hidden transition-max-height duration-500 ease-in-out relative max-h-fit"><div class="h-100"><div class="prose"><p><strong>Welcome</strong></p><p><strong>Week 1: Why Automate?</strong></p><p>Introduction to Automation in the Cloud<br>Automation with Scripting </p><p><strong>Week 2: Infrastructure as Code</strong></p><p>Infrastructure as Code<br>Configuration as Code </p><p><strong>Week 3: AWS Services for automation</strong></p><p>Resource Management Best Practices<br>Scaling Resource Management</p></div></div></div><button data-testid="expandable-block-trigger">Show less</button></div></div></div></div>
</body></html>`);
    const result = await extractComponent(page, "courseCurriculum", "Course Curriculum", legacyOf("courseCurriculum"));
    expect(result.present).toBe(true);
    const weeks = result.fields.find((f) => f.name === "weeks");
    expect(weeks?.compareAsText).toBe(true);
    // Consolidated flat list, in reading order — the info bar's "Language"/"English" <p> pair
    // (outside [data-testid='expandable-block']) must be excluded.
    expect(weeks?.values, "info-bar <p> tags outside expandable-block must be excluded").toEqual([
      "Welcome",
      "Week 1: Why Automate?",
      "Introduction to Automation in the Cloud",
      "Automation with Scripting",
      "Week 2: Infrastructure as Code",
      "Infrastructure as Code",
      "Configuration as Code",
      "Week 3: AWS Services for automation",
      "Resource Management Best Practices",
      "Scaling Resource Management",
    ]);
  });

  test("meetInstructors: <a> cards (not <li>), name/title via nth-of-type <p> siblings", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div><div class="flex justify-start align-center mb-1"><h2 class="md:text-3xl text-primary mt-0">Meet the instructors</h2></div><div class="grid grid-cols-1 gap-4"><a class="min-w-[200px] md:h-[154px] border border-putty-400 p-6 md:p-8 flex flex-col md:flex-row rounded-xl justify-between md:gap-4 bg-white" href="/bio/russell-sayers"><div class="flex flex-row gap-4"><div class="flex items-center justify-center min-w-[90px] min-h-[90px] flex-shrink-0 hidden md:block"><img alt="Russell"></div><div class="md:h-24 flex gap-2 flex-col justify-center"><p class="text-lg font-bold lg:text-base m-0 text-secondary-500">Russell Sayers</p><p class="text-base font-bold md:font-normal lg:text-sm m-0 text-gray-800">Senior Cloud Technologist at Amazon Web Services</p></div></div><div class="md:!flex items-center justify-center min-w-[90px] md:min-h-[90px]"><img alt="logo"></div></a><a class="min-w-[200px] md:h-[154px] border border-putty-400 p-6 md:p-8 flex flex-col md:flex-row rounded-xl justify-between md:gap-4 bg-white" href="/bio/rafael-lopes"><div class="flex flex-row gap-4"><div class="flex items-center justify-center min-w-[90px] min-h-[90px] flex-shrink-0 hidden md:block"><img alt="Rafael"></div><div class="md:h-24 flex gap-2 flex-col justify-center"><p class="text-lg font-bold lg:text-base m-0 text-secondary-500">Rafael Lopes</p><p class="text-base font-bold md:font-normal lg:text-sm m-0 text-gray-800">Senior Cloud Technologist at Amazon Web Services</p></div></div><div class="md:!flex items-center justify-center min-w-[90px] md:min-h-[90px]"><img alt="logo"></div></a></div></div>
</body></html>`);
    const result = await extractComponent(page, "meetInstructors", "Meet the Instructors", legacyOf("meetInstructors"));
    expect(result.present).toBe(true);
    const instructors = result.fields.find((f) => f.name === "instructors")?.items ?? [];
    expect(instructors.length).toBe(2);
    expect(instructors[0].find((f) => f.name === "name")?.values[0]).toBe("Russell Sayers");
    expect(instructors[0].find((f) => f.name === "title")?.values[0]).toBe(
      "Senior Cloud Technologist at Amazon Web Services"
    );
    expect(instructors[1].find((f) => f.name === "name")?.values[0]).toBe("Rafael Lopes");
  });

  test("testimonials: Embla carousel, all slides present regardless of aria-hidden; name/location are plain sibling <div>s, not <p>", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div data-items="3" class="embla social-proof bg-putty-100 flex flex-col items-center side-rail-shown"><h2 class="elm-h3 text-left mb-10 w-full lg:max-w-[1200px] lg:mx-auto">Hear what other learners have to say</h2><div id="carousel-container" class="embla__viewport" role="region" aria-label="Social proof carousel" aria-roledescription="carousel"><div class="embla__container flex"><div aria-label="Slide 1" aria-roledescription="slide" aria-hidden="true" class="embla__slide"><div class="p-5 bg-white rounded-xl flex flex-col border border-lightgray-200 min-h-[200px] h-full"><div class="flex flex-row gap-4"><svg></svg><div class="flex flex-col flex-1"><div class="flex-1 overflow-hidden"><p class="text-base text-gray-600 m-0">I'm a fan of edX's new way of learning.</p></div><button type="button">Show More</button></div></div><div class="flex flex-col gap-4 mt-auto pt-4"><div class="h-px w-full bg-putty-400"></div><div class="flex flex-row items-center gap-4"><div class="h-[68px] w-[68px] rounded-full"><img alt="Sarah"></div><div class="flex flex-col text-sm font-bold"><div>Sarah Riggot</div><div>Guatemala</div></div></div></div></div></div><div aria-label="Slide 2" aria-roledescription="slide" aria-hidden="false" class="embla__slide"><div class="p-5 bg-white rounded-xl flex flex-col border border-lightgray-200 min-h-[200px] h-full"><div class="flex flex-row gap-4"><svg></svg><div class="flex flex-col flex-1"><div class="flex-1 overflow-hidden"><p class="text-base text-gray-600 m-0">The edX experience is the most valuable experience I have ever had.</p></div><button type="button">Show More</button></div></div><div class="flex flex-col gap-4 mt-auto pt-4"><div class="h-px w-full bg-putty-400"></div><div class="flex flex-row items-center gap-4"><div class="h-[68px] w-[68px] rounded-full"><img alt="Nader"></div><div class="flex flex-col text-sm font-bold"><div>Nader Haddad</div><div>Tunisia</div></div></div></div></div></div></div></div></div>
</body></html>`);
    const result = await extractComponent(page, "testimonials", "Testimonials", legacyOf("testimonials"));
    expect(result.present).toBe(true);
    const items = result.fields.find((f) => f.name === "items")?.items ?? [];
    // Both slides must be captured even though Slide 1 is aria-hidden="true" (Embla renders all
    // slides statically and only toggles aria-hidden, never unmounts).
    expect(items.length, "aria-hidden slides must still be captured, not just the active one").toBe(2);
    expect(items[0].find((f) => f.name === "quote")?.values[0]).toContain("fan of edX's new way");
    expect(items[0].find((f) => f.name === "name")?.values[0]).toBe("Sarah Riggot");
    expect(items[0].find((f) => f.name === "location")?.values[0]).toBe("Guatemala");
    expect(items[1].find((f) => f.name === "name")?.values[0]).toBe("Nader Haddad");
  });

  test("coursePricing: 'Certificate' label and price share IDENTICAL classes — must resolve price via direct-child position, not class", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="flex justify-between items-end bg-primary-500 p-6 md:py-6 md:px-10 rounded-t-xl"><div class="flex items-center space-x-2"><h3 class="text-white text-[16px] sm:text-lg m-0">Certificate</h3><div class="border border-[#A5B5B1] rounded text-white px-2 py-1 text-xs">Premium</div></div><h3 class="text-white text-[16px] sm:text-lg m-0">$99 USD</h3></div>
</body></html>`);
    const result = await extractComponent(page, "coursePricing", "Course Pricing", legacyOf("coursePricing"));
    expect(result.present).toBe(true);
    expect(result.fields.find((f) => f.name === "price")?.values[0], "must be the price, not 'Certificate'").toBe(
      "$99 USD"
    );
    expect(result.fields.find((f) => f.name === "seatLabel")?.values[0]).toBe("Premium");
  });

  test("faq: single AccordionTextItemRefresh item packs all Q&A as <br>-separated <p> tags — split, strip 'Q./A.' prefixes, and strip embedded <a> tags", async ({ page }) => {
    await page.setContent(`<!DOCTYPE html><html><body>
<div class="flex flex-col gap-6"><div class="flex flex-col gap-6"><h2 class="my-0 md:text-3xl">Frequently asked questions</h2><div class="relative overflow-hidden"><div class="flex flex-col relative"><div class="md:p-6 md:rounded-2xl md:bg-putty-400"><div class="flex flex-col gap-6" data-orientation="vertical"><div data-state="open" data-orientation="vertical" class="border-b AccordionTextItemRefresh_item__79Tdm"><h3 data-orientation="vertical" data-state="open" class="flex"><button type="button" aria-expanded="true" data-state="open" class="AccordionTextItemRefresh_trigger__SmKl5"><div class="py-2 text-base md:text-lg"><span>Frequently Asked Questions</span></div></button></h3><div class="AccordionTextItemRefresh_content__qxy4h" data-state="open" role="region"><div class="prose"><p><strong>Q. Are there any prerequisites for this course?</strong><br>A. There are no required prerequisites for this course.</p><p><strong>Q. What is the grading policy for this course?</strong><br>A. All learners may take weekly quizzes, which are not graded.<br>Learners in the Verified Certificate track can take the final assessment.<br>Learners in the Audit track will not have access to the final assessment.</p><p><strong>Q. Will this course help me prepare for an AWS Certification?</strong><br>A. For more information, visit <a href="https://aws.amazon.com/certification">aws.amazon.com/certification.</a></p></div></div></div></div></div></div></div></div></div>
</body></html>`);
    const result = await extractComponent(page, "faq", "FAQ", legacyOf("faq"));
    expect(result.present).toBe(true);
    // The page-level h2, not the per-item trigger's differently-cased "Frequently Asked Questions".
    expect(result.fields.find((f) => f.name === "heading")?.values[0]).toBe("Frequently asked questions");
    const items = result.fields.find((f) => f.name === "items")?.items ?? [];
    expect(items.length).toBe(3);
    expect(items[0].find((f) => f.name === "question")?.values[0]).toBe(
      "Are there any prerequisites for this course?"
    );
    expect(items[0].find((f) => f.name === "answer")?.values[0]).toBe(
      "There are no required prerequisites for this course."
    );
    // Multiple <br> in one <p> (no repeated "Q./A." markers) must all fold into one answer string.
    expect(items[1].find((f) => f.name === "answer")?.values[0]).toBe(
      "All learners may take weekly quizzes, which are not graded. Learners in the Verified Certificate track can take the final assessment. Learners in the Audit track will not have access to the final assessment."
    );
    // Embedded <a> tag inside the answer must be stripped to plain text, not left as raw HTML.
    expect(items[2].find((f) => f.name === "answer")?.values[0]).toBe(
      "For more information, visit aws.amazon.com/certification."
    );
  });

  test("full parity: every legacy field matches its odyssey counterpart when content is equivalent", async ({ page, baseURL }) => {
    // Legacy fixture built with the SAME text as /compare/learn-deep-odyssey (see mock-server.js)
    // but in legacy's own structurally-different shape — proves the two mappings actually line up
    // field by field, not just that each resolves in isolation.
    const TYPES = ["courseHero", "whatYoullLearn", "aboutCourse", "meetInstructors", "testimonials", "coursePricing"];

    await page.goto(`${baseURL}/compare/learn-deep-odyssey`);
    const odyssey: Record<string, NormalizedComponent> = {};
    for (const type of TYPES) {
      const m = learnDeepMap.components.find((c) => c.type === type)!;
      odyssey[type] = await extractComponent(page, m.type, m.label, m.odyssey);
    }

    await page.setContent(`<!DOCTYPE html><html><body>
<div class="flex flex-col gap-5"><h1>Agentic AI with LangChain and LangGraph</h1><div data-testid="expandable-text-content"><p>Learn to build autonomous AI agents using LangChain and LangGraph.</p></div></div>
<div class="flex flex-col gap-6"><h2>What you'll learn</h2><div><ul><li>Build multi-agent workflows.</li><li>Integrate LLMs with external tools.</li></ul></div></div>
<div><div class="flex flex-col gap-4"><h2>About this course</h2><div data-testid="expandable-block"><p>This course covers the fundamentals of agentic AI systems.</p><p>You will build real-world agents using LangGraph.</p></div></div></div>
<div><div class="flex justify-start"><h2>Meet the instructors</h2></div><div class="grid grid-cols-1 gap-4"><a href="/bio/ada"><p>Dr. Ada Lovelace</p><p>Professor of Computer Science</p></a><a href="/bio/alan"><p>Dr. Alan Turing</p><p>AI Research Lead</p></a></div></div>
<div class="social-proof"><h2>Hear what other learners have to say</h2><div aria-roledescription="slide"><p>This course changed how I think about AI.</p><div class="flex flex-col text-sm font-bold"><div>Jane Smith</div><div>United States</div></div></div><div aria-roledescription="slide"><p>Excellent hands-on projects.</p><div class="flex flex-col text-sm font-bold"><div>Carlos Diaz</div><div>Mexico</div></div></div></div>
<div class="flex justify-between items-end rounded-t-xl"><div class="flex items-center space-x-2"><h3>Certificate</h3><div>Verified</div></div><h3>$149 USD</h3></div>
</body></html>`);
    const legacy: Record<string, NormalizedComponent> = {};
    for (const type of TYPES) {
      const m = learnDeepMap.components.find((c) => c.type === type)!;
      legacy[type] = await extractComponent(page, m.type, m.label, m.legacy!);
    }

    for (const type of TYPES) {
      const m = learnDeepMap.components.find((c) => c.type === type)!;
      const diff = compareComponents(legacy[type], odyssey[type], OPTS, true);
      expect(diff.status, `${m.label}: ${JSON.stringify(diff, null, 2)}`).toBe("match");
    }
  });
});
