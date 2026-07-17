const http = require("http");

const server = http.createServer((req, res) => {
  const url = req.url || "/";

  // Handle redirects
  if (url === "/redirect-source") {
    res.writeHead(301, { Location: "/redirect-target" });
    res.end();
    return;
  }
  if (url === "/redirect-target") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Redirect Target</h1>");
    return;
  }

  // Handle sitemap.xml
  if (url === "/sitemap.xml") {
    res.writeHead(200, { "Content-Type": "application/xml" });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>http://localhost:3001/</loc>
  </url>
  <url>
    <loc>http://localhost:3001/about</loc>
  </url>
  <url>
    <loc>http://localhost:3001/redirect-source</loc>
  </url>
</urlset>`);
    return;
  }

  // Return a mock logo image for status checks
  if (url === "/logo.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    // Minimal valid 1x1 transparent PNG
    res.end(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64"
      )
    );
    return;
  }

  // Semantic validator fixture: a page that passes all default-on semantic checks
  if (url === "/semantic-good") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Semantic Good Page</title>
</head>
<body>
  <header>
    <nav aria-label="Primary">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <h1>Accessible Page</h1>
    <section aria-labelledby="intro-heading">
      <h2 id="intro-heading">Introduction</h2>
      <p>Welcome to the semantically correct page.</p>
      <img src="/logo.png" alt="Company logo">
      <a href="https://example.com" target="_blank" rel="noopener">External resource</a>
    </section>
    <section aria-labelledby="form-heading">
      <h2 id="form-heading">Contact</h2>
      <form>
        <label for="email">Email address</label>
        <input id="email" type="email" name="email">
        <button type="submit">Subscribe</button>
      </form>
    </section>
    <section aria-labelledby="data-heading">
      <h2 id="data-heading">Pricing</h2>
      <table>
        <caption>Course pricing</caption>
        <thead>
          <tr><th scope="col">Course</th><th scope="col">Price</th></tr>
        </thead>
        <tbody>
          <tr><td>Intro</td><td>$10</td></tr>
        </tbody>
      </table>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Example Inc.</p>
  </footer>
</body>
</html>`);
    return;
  }

  // Semantic validator fixture: a page that deliberately violates every default-on check
  if (url === "/semantic-bad") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Bad</title>
</head>
<body>
  <header>
    <nav><a href="/">Home</a></nav>
  </header>
  <nav><a href="/about">About</a></nav>
  <div id="content">
    <h1>First Title</h1>
    <h1>Second Title</h1>
    <h3>Skipped Level</h3>
    <h2></h2>
    <img src="/photo.png">
    <img src="/banner.png" alt="banner.png">
    <iframe src="/embed"></iframe>
    <a href="#">Fake button</a>
    <a href="https://example.com" target="_blank">New tab, no rel</a>
    <a href="/empty" aria-hidden="false"></a>
    <form>
      <input type="text" name="q">
    </form>
    <table>
      <tr><td>No headers here</td></tr>
    </table>
    <p id="content">Duplicate id here</p>
    <span role="foo" aria-labelledby="missing-id">Bad role</span>
    <div tabindex="3">Positive tabindex</div>
    <div aria-hidden="true"><button>Hidden focusable</button></div>
    <button></button>
    <a href="/x"><button>Nested</button></a>
    <li>Orphan list item</li>
  </div>
</body>
</html>`);
    return;
  }

  // =====================================================================
  // Validator self-test fixtures (see tests-selftest/validator-selftest.spec.ts).
  // Each validator gets a GOOD page (every sub-check must PASS) and a BAD page
  // (the relevant sub-checks must FAIL), so the self-test can prove the
  // validators neither false-positive on correct markup nor false-negative on
  // broken markup.
  // =====================================================================

  // ---- Health fixtures ----
  if (url === "/selftest/health-ok") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!DOCTYPE html><html lang=\"en\"><head><title>OK</title></head><body><h1>OK</h1></body></html>");
    return;
  }
  if (url === "/selftest/health-redirect") {
    res.writeHead(301, { Location: "/selftest/health-target" });
    res.end();
    return;
  }
  if (url === "/selftest/health-target") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!DOCTYPE html><html lang=\"en\"><head><title>Target</title></head><body><h1>Target</h1></body></html>");
    return;
  }
  if (url === "/selftest/not-found") {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("<!DOCTYPE html><html lang=\"en\"><head><title>Not Found</title></head><body><h1>404</h1></body></html>");
    return;
  }

  // ---- SEO fixtures ----
  if (url === "/selftest/seo-good") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SEO Good Page</title>
  <meta name="description" content="A well-formed page with complete SEO metadata.">
  <link rel="canonical" href="http://localhost:3001/selftest/seo-good">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="SEO Good Page">
  <meta property="og:description" content="A well-formed page with complete SEO metadata.">
  <meta property="og:locale" content="en_US">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="SEO Good Page">
  <meta name="twitter:description" content="A well-formed page with complete SEO metadata.">
</head>
<body><h1>SEO Good</h1></body>
</html>`);
    return;
  }
  if (url === "/selftest/seo-bad") {
    // Empty title, and every other SEO tag missing.
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <title></title>
</head>
<body><h1>SEO Bad</h1></body>
</html>`);
    return;
  }

  // ---- Header fixtures ----
  const headerGoodBody = `
  <header>
    <div class="logo-container">
      <a class="logo" href="/"><img src="/logo.png" alt="Logo"></a>
    </div>
    <nav>
      <a href="/about">About</a>
      <button class="learn-btn">Learn</button>
      <button class="search-trigger">Search</button>
    </nav>
    <div class="mega-menu-drawer" style="display: none;">Mega Menu Content</div>
    <div class="search-modal" style="display: none;"><input type="search" placeholder="Search..."></div>
    <script>
      document.querySelector('.learn-btn').addEventListener('click', () => {
        const d = document.querySelector('.mega-menu-drawer');
        d.style.display = d.style.display === 'none' ? 'block' : 'none';
      });
      document.querySelector('.search-trigger').addEventListener('click', () => {
        const m = document.querySelector('.search-modal');
        m.style.display = 'block';
        m.querySelector('input').focus();
      });
      // The header 'search' check presses Escape and asserts the modal closes.
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelector('.search-modal').style.display = 'none';
      });
    </script>
  </header>
  <main><h1>Header Good</h1></main>`;
  if (url === "/selftest/header-good") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Header Good</title></head><body>${headerGoodBody}</body></html>`);
    return;
  }
  if (url === "/selftest/header-bad") {
    // No <header> element at all: every header sub-check should fail fast.
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Header Bad</title></head><body><div class="not-a-header">No header here</div><main><h1>Header Bad</h1></main></body></html>`);
    return;
  }

  // ---- Footer fixtures ----
  const footerGoodBody = `
  <main><h1>Footer Good</h1></main>
  <footer>
    <nav section="footer-links">
      <section class="footer-section"><h3>Company</h3><ul><li><a href="/about">About Us</a></li></ul></section>
      <section class="footer-section"><h3>Resources</h3></section>
      <section class="footer-section"><h3>Legal</h3></section>
      <section class="footer-section"><h3>Social</h3>
        <a href="https://facebook.com/mock">Facebook</a>
        <a href="https://twitter.com/mock">Twitter</a>
        <a href="https://linkedin.com/mock">LinkedIn</a>
        <a href="https://instagram.com/mock">Instagram</a>
      </section>
    </nav>
    <div class="language-selector">
      <select><option value="en">English</option><option value="es">Español</option></select>
      <button class="apply">Apply</button>
    </div>
    <div class="copyright">&copy; ${new Date().getFullYear()} Mock Inc.</div>
    <a href="https://apple.com/app-store">App Store</a>
    <a href="https://google.com/play-store">Google Play</a>
    <script>
      document.querySelector('.language-selector button.apply').addEventListener('click', () => {
        const s = document.querySelector('.language-selector select');
        document.documentElement.setAttribute('lang', s.value);
      });
    </script>
  </footer>`;
  if (url === "/selftest/footer-good") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Footer Good</title></head><body>${footerGoodBody}</body></html>`);
    return;
  }
  if (url === "/selftest/footer-bad") {
    // No <footer> element at all: every footer sub-check should fail fast.
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Footer Bad</title></head><body><div class="not-a-footer">No footer here</div><main><h1>Footer Bad</h1></main></body></html>`);
    return;
  }

  // ---- Extra semantic fixture: covers rules that /semantic-bad cannot violate ----
  // (requireH1, singleNonEmptyTitle, doctypeHtml, requireScopeOrHeaders,
  //  enforceRoleButtonFocusable) — these conflict with violations on /semantic-bad,
  // so a single "everything bad" page cannot exercise them.
  if (url === "/selftest/semantic-bad2") {
    // NOTE: intentionally no <!DOCTYPE html>.
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title></title>
</head>
<body>
  <header><nav aria-label="Primary"><a href="/">Home</a></nav></header>
  <main>
    <h2>No H1 on this page</h2>
    <div role="button">Not keyboard focusable</div>
    <table>
      <tr><th>Course</th><th>Price</th></tr>
      <tr><td>Intro</td><td>$10</td></tr>
    </table>
  </main>
  <footer><p>&copy; ${new Date().getFullYear()} Example Inc.</p></footer>
</body>
</html>`);
    return;
  }

  // Content-comparison fixtures (see tests-selftest/comparison-selftest.spec.ts).
  // Two pages with the SAME visible content but deliberately DIFFERENT DOM structures:
  // an odyssey-style semantic layout and a legacy-style div-heavy layout. Extracting each with
  // its own selector set must normalize to identical content (parity "match").
  if (url === "/compare/odyssey-sample") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Odyssey Sample</title></head><body>
  <main>
    <div id="hero"><h1>Learn Blender</h1><h2>Free online course</h2><a class="btn" href="/enroll">Enroll now</a></div>
    <div class="rich-text"><p>Blender is a free and open-source 3D creation suite.</p></div>
    <div id="faq" data-slot="accordion">
      <div data-slot="accordion-item"><button data-slot="accordion-trigger"><span>Is it free?</span></button><div data-slot="accordion-content"><div>Yes, completely free.</div></div></div>
      <div data-slot="accordion-item"><button data-slot="accordion-trigger"><span>Do I get a certificate?</span></button><div data-slot="accordion-content"><div>Yes, an optional certificate.</div></div></div>
    </div>
  </main>
</body></html>`);
    return;
  }
  if (url === "/compare/legacy-sample") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Legacy Sample</title></head><body>
  <div class="page">
    <section class="legacy-hero"><div><div><span class="title">Learn Blender</span></div><div class="subtitle">Free online course</div><div><button class="cta">Enroll now</button></div></div></section>
    <div class="legacy-body"><div class="content"><p>Blender is a free and open-source 3D creation suite.</p></div></div>
    <div class="legacy-faq">
      <div class="faq-row"><div class="q">Is it free?</div><div class="a">Yes, completely free.</div></div>
      <div class="faq-row"><div class="q">Do I get a certificate?</div><div class="a">Yes, an optional certificate.</div></div>
    </div>
  </div>
</body></html>`);
    return;
  }

  // Richer learn-topic fixtures exercising every component shape in learn-course.map.ts.
  // Same content, different DOM: /compare/topic-odyssey mirrors the real Odyssey selectors
  // (#ids, [data-slot], :has()/sibling/:scope structures); /compare/topic-legacy is a flat
  // div-heavy legacy-style layout. Used by tests-selftest/comparison-selftest.spec.ts.
  if (url === "/compare/topic-odyssey") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Topic Odyssey</title></head><body>
  <section class="full-bleed main-grid bg-inverted"><h1>Learn Blender</h1><div class="line-clamp-2">Blender is a free and open-source 3D creation suite.</div></section>
  <div class="bg-fern-500 sticky"><a class="link-nav-item"><span>Overview</span></a><a class="link-nav-item"><span>Courses</span></a></div>
  <div class="gutter-padding max-w-7xl"><h2>What is Blender?</h2><div class="space-y-4">
    <p>Blender is used for modeling, animation, and rendering.</p>
    <p>It is free and open-source.</p>
  </div></div>
  <div id="browse-courses" class="main-grid"><h2>Trending Blender courses</h2>
    <ul class="course-card-grid">
      <li><a href="/c1"><div data-slot="card"><div data-slot="card-content"><span class="line-clamp-2">Introduction to Blender</span></div></div></a></li>
      <li><a href="/c2"><div data-slot="card"><div data-slot="card-content"><span class="line-clamp-2">Advanced Blender Modeling</span></div></div></a></li>
    </ul>
  </div>
  <div id="choosing-the-right-program">
    <div data-slot="tabs-list"><button data-slot="tabs-trigger"><span>Certificates (2)</span></button><button data-slot="tabs-trigger"><span>Degrees (1)</span></button></div>
    <div data-slot="tabs-content"><div data-slot="card"><span class="line-clamp-2">Blender Certificate</span></div><div data-slot="card"><span class="line-clamp-2">3D Design Certificate</span></div></div>
  </div>
  <section class="full-bleed bg-putty-100 gutter-padding"><h3>Related topics</h3><a href="/t1">3D Modeling</a><a href="/t2">Animation</a><a href="/t3">Rendering</a></section>
  <div class="main-grid full-bleed bg-primary-background">
    <section class="py-12"><h3>Course curriculum</h3><p>Module 1 covers the basics.</p><p>Module 2 covers modeling.</p></section>
    <section id="explore-jobs" class="py-12"><h2>Explore Blender jobs</h2><p>These roles use Blender.</p><p>Demand is growing.</p><ul class="list-disc"><li><span>3D Artist: Creates models.</span></li><li><span>Animator: Brings scenes to life.</span></li></ul></section>
    <section class="py-12"><h2>Why learn Blender</h2><ul class="list-disc"><li><span>Free: No license cost.</span></li><li><span>Popular: Widely adopted.</span></li></ul></section>
    <section class="py-12"><h2>Choosing your program</h2><p>Pick a path that fits.</p><div class="mt-6"><h3>Beginner</h3><p>Start with fundamentals.</p></div><div class="mt-6"><h3>Professional</h3><p>Build a portfolio.</p></div></section>
    <section class="mb-4"><h2>Career paths</h2><p>Roles you can pursue.</p>
      <div data-slot="accordion">
        <div data-slot="accordion-item"><h3><button data-slot="accordion-trigger"><span>3D Artist</span></button></h3><div data-slot="accordion-content"><div>Creates 3D assets.</div></div></div>
        <div data-slot="accordion-item"><h3><button data-slot="accordion-trigger"><span>VFX Artist</span></button></h3><div data-slot="accordion-content"><div>Creates visual effects.</div></div></div>
      </div>
    </section>
    <div id="faq"><h2>Frequently asked questions</h2>
      <div data-slot="accordion">
        <div data-slot="accordion-item"><h3><button data-slot="accordion-trigger"><span>Is Blender free?</span></button></h3><div data-slot="accordion-content"><div>Yes, completely free.</div></div></div>
        <div data-slot="accordion-item"><h3><button data-slot="accordion-trigger"><span>Do I get a certificate?</span></button></h3><div data-slot="accordion-content"><div>Yes, optional.</div></div></div>
      </div>
    </div>
    <section class="py-12"><ol class="list-decimal"><li><a href="#a"><span>Blender Foundation</span></a> <span class="italic">Official site, 2024.</span></li><li><a href="#b"><span>Wikipedia</span></a> <span class="italic">Blender article, 2024.</span></li></ol></section>
  </div>
</body></html>`);
    return;
  }
  if (url === "/compare/topic-legacy") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Topic Legacy</title></head><body>
  <div class="lg-hero"><h1 class="lg-title">Learn Blender</h1><div class="lg-sub">Blender is a free and open-source 3D creation suite.</div></div>
  <nav class="lg-nav"><a class="lg-navlink">Overview</a><a class="lg-navlink">Courses</a></nav>
  <!-- Topic Overview: self-contained div, no anchor marker, matches heading-region generically.
       Trailing empty <p></p> tests the empty-value filter. -->
  <div class="flex flex-wrap py-12"><div><h2>What is Blender?</h2><p>Blender is used for modeling, animation, and rendering.</p><p>It is free and open-source.</p><p></p></div></div>
  <div class="lg-trending"><div class="lg-head">Trending Blender courses</div><div class="lg-grid"><div class="lg-course"><div class="lg-name">Introduction to Blender</div></div><div class="lg-course"><div class="lg-name">Advanced Blender Modeling</div></div></div></div>
  <div class="lg-programs"><div class="lg-tabbar"><span class="lg-tab">Certificates (2)</span><span class="lg-tab">Degrees (1)</span></div><div class="lg-panel"><div class="lg-prog"><div class="lg-pname">Blender Certificate</div></div><div class="lg-prog"><div class="lg-pname">3D Design Certificate</div></div></div></div>
  <!-- Related Topics: heading text is constant across topics; chips in the first sibling div,
       "View all topics" in a second sibling div that must be excluded. -->
  <div class="fullwidth bg-putty-100"><h3>Related Topics</h3><div class="flex gap-3"><a href="/learn/t1">3D Modeling</a><a href="/learn/t2">Animation</a><a href="/learn/t3">Rendering</a></div><div class="pt-4"><a href="/learn">View all topics</a></div></div>
  <div class="lg-curriculum"><div class="lg-head">Course curriculum</div><p class="lg-para">Module 1 covers the basics.</p><p class="lg-para">Module 2 covers modeling.</p></div>
  <!-- Explore Jobs: rich-text div, heading-region matched by pattern. Trailing empty <p></p>
       tests the empty-value filter. -->
  <div class="Default_content"><h2>Explore Blender jobs</h2><p>These roles use Blender.</p><p>Demand is growing.</p><ul><li>3D Artist: Creates models.</li><li>Animator: Brings scenes to life.</li></ul><p></p></div>
  <!-- Why Learn: same rich-text-div pattern, no intro paragraph (matches real legacy shape). -->
  <div class="Default_content"><h2>Why learn Blender</h2><ul><li>Free: No license cost.</li><li>Popular: Widely adopted.</li></ul></div>
  <div class="lg-guide"><div class="lg-head">Choosing your program</div><p class="lg-intro">Pick a path that fits.</p><div class="lg-gsec"><div class="lg-gtitle">Beginner</div><p class="lg-gp">Start with fundamentals.</p></div><div class="lg-gsec"><div class="lg-gtitle">Professional</div><p class="lg-gp">Build a portfolio.</p></div></div>
  <div class="lg-jobs"><div class="lg-head">Career paths</div><div class="lg-desc">Roles you can pursue.</div><div class="lg-job"><div class="lg-jtitle">3D Artist</div><div class="lg-jbody">Creates 3D assets.</div></div><div class="lg-job"><div class="lg-jtitle">VFX Artist</div><div class="lg-jbody">Creates visual effects.</div></div></div>
  <div class="lg-faq"><div class="lg-head">Frequently asked questions</div><div class="lg-qa"><div class="lg-q">Is Blender free?</div><div class="lg-a">Yes, completely free.</div></div><div class="lg-qa"><div class="lg-q">Do I get a certificate?</div><div class="lg-a">Yes, optional.</div></div></div>
  <div class="lg-refs"><ol><li><a class="lg-rlink">Blender Foundation</a> <span class="lg-rcite">Official site, 2024.</span></li><li><a class="lg-rlink">Wikipedia</a> <span class="lg-rcite">Blender article, 2024.</span></li></ol></div>
</body></html>`);
    return;
  }

  // Learn HUB fixture (see comparison/mappings/learn/learn.map.ts). Odyssey-only (legacy is null
  // for this page type) — used by tests-selftest/comparison-selftest.spec.ts to validate every
  // shipped Odyssey selector actually resolves.
  //
  // The outer `full-bleed main-grid` section below mirrors odyssey/src/app/[locale]/learn/layout.tsx,
  // which wraps the ENTIRE page in exactly this section — kept here deliberately (not flattened)
  // because a flat fixture is what let the trendingTopics selector bug ship undetected: its root
  // used to match this outer section too (also `:has(#trending-topics-heading)`, and first in DOM
  // order), so `items` picked up every link on the page, not just the topic chips. Keeping the real
  // nesting here means the `items` assertion below actually exercises that regression.
  if (url === "/compare/learn-hub-odyssey") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Learn Hub Odyssey</title></head><body>
  <section class="full-bleed main-grid bg-color-primary min-h-screen">
  <section class="full-bleed main-grid bg-inverted"><h1>Find the right course for you</h1><div class="line-clamp-2">Explore thousands of courses from top universities.</div></section>
  <section class="full-bleed bg-putty-100 py-16"><div class="gutter-padding mx-auto max-w-7xl">
    <h2>Why millions of learners choose edX</h2>
    <div class="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      <div class="flex flex-col"><h3>Learn from experts</h3><p>Courses developed by leading universities.</p></div>
      <div class="flex flex-col"><h3>Flexible learning</h3><p>Study at your own pace, anywhere.</p></div>
    </div>
  </div></section>
  <section class="py-4 gutter-padding w-full"><div>
    <h2 id="trending-topics-heading">Trending subjects</h2>
    <div class="py-8"><div class="grid grid-cols-1 gap-3">
      <a href="/learn/computer-science"><span>Computer Science</span></a>
      <a href="/learn/data-science"><span>Data Science</span></a>
      <a href="/learn/business"><span>Business</span></a>
    </div></div>
  </div></section>
  <section class="mt-3 mb-20 flex w-full flex-col"><h2>Trending courses</h2>
    <ul class="course-card-grid">
      <li><a href="/c1"><div data-slot="card"><div data-slot="card-content"><span class="line-clamp-2">Introduction to Python</span></div></div></a></li>
      <li><a href="/c2"><div data-slot="card"><div data-slot="card-content"><span class="line-clamp-2">Data Analysis with R</span></div></div></a></li>
    </ul>
  </section>
  <section id="browse-topics" class="py-6 pt-10"><h2>edX courses and programs by topic</h2><p>Browse by subject.</p>
    <div>
      <div class="bg-putty-100 shadow-section my-4 rounded-md p-8"><h3>Computer Science</h3><div class="flex flex-wrap">
        <div class="not-prose mt-2 font-normal"><a href="/learn/python">Python</a><span class="text-washed-red mx-2">|</span></div>
        <div class="not-prose mt-2 font-normal"><a href="/learn/java">Java</a></div>
      </div></div>
      <div class="bg-putty-100 shadow-section my-4 rounded-md p-8"><h3>Business</h3><div class="flex flex-wrap">
        <div class="not-prose mt-2 font-normal"><a href="/learn/finance">Finance</a><span class="text-washed-red mx-2">|</span></div>
        <div class="not-prose mt-2 font-normal"><a href="/learn/marketing">Marketing</a></div>
      </div></div>
    </div>
  </section>
  <div class="mb-12"><div class="flex flex-col py-4 lg:pt-16">
    <h2>Frequently asked questions</h2>
    <div class="flex flex-col gap-3">
      <div data-slot="accordion">
        <div data-slot="accordion-item"><button data-slot="accordion-trigger"><span>Is edX free?</span></button><div data-slot="accordion-content"><div>Many courses are free to audit.</div></div></div>
        <div data-slot="accordion-item"><button data-slot="accordion-trigger"><span>Do I get a certificate?</span></button><div data-slot="accordion-content"><div>Verified certificates are available for a fee.</div></div></div>
      </div>
    </div>
  </div></div>
  </section>
</body></html>`);
    return;
  }

  // Course-detail fixture (see comparison/mappings/learn-deep.map.ts). Odyssey-only. The
  // "show more" button starts with week 3 genuinely ABSENT from the DOM (simulating React's real
  // conditional-slice rendering), and only injects it on click via the inline script below.
  if (url === "/compare/learn-deep-odyssey") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Course Detail Odyssey</title></head><body>
  <div id="course-hero"><section><div class="bg-card rounded-2xl p-6">
    <h1>Agentic AI with LangChain and LangGraph</h1>
    <div class="text-muted-foreground mt-4 mb-6 max-w-3xl text-lg leading-relaxed">Learn to build autonomous AI agents using LangChain and LangGraph.</div>
  </div></section></div>
  <section><h2 id="what-youll-learn-heading">What you'll learn</h2>
    <ul><li>Build multi-agent workflows.</li><li>Integrate LLMs with external tools.</li></ul>
  </section>
  <section><h2>About this course</h2><div class="space-y-4">
    <p>This course covers the fundamentals of agentic AI systems.</p>
    <p>You will build real-world agents using LangGraph.</p>
  </div></section>
  <section><h2>Curriculum</h2><div>
    <div class="bg-putty-500 px-8 py-5"><p>4 weeks, 5 hours per week</p></div>
    <div class="bg-card px-12 py-6"><div>
      <ul class="flex flex-col gap-6" id="weeks-list">
        <li><p>Week 1: Introduction to Agents</p><ul class="mt-2 flex flex-col gap-1 pl-8"><li>Basics of AI agents</li></ul></li>
        <li><p>Week 2: Building with LangChain</p><ul class="mt-2 flex flex-col gap-1 pl-8"><li>LangChain setup and tools</li></ul></li>
      </ul>
      <button type="button" aria-expanded="false" id="show-more-btn">Show more</button>
    </div></div>
  </div></section>
  <section><h2>Meet the instructors</h2>
    <ul><li><div><p>Dr. Ada Lovelace</p><p>Professor of Computer Science</p></div></li>
    <li><div><p>Dr. Alan Turing</p><p>AI Research Lead</p></div></li></ul>
  </section>
  <section><h2>Hear what other learners have to say</h2><div>
    <div data-slot="carousel-item"><article>
      <div data-testid="expandable-block"><p>This course changed how I think about AI.</p></div>
      <div class="text-gray-light text-small flex flex-col font-bold"><p>Jane Smith</p><p>United States</p></div>
    </article></div>
    <div data-slot="carousel-item"><article>
      <div data-testid="expandable-block"><p>Excellent hands-on projects.</p></div>
      <div class="text-gray-light text-small flex flex-col font-bold"><p>Carlos Diaz</p><p>Mexico</p></div>
    </article></div>
  </div></section>
  <section id="ways-to-take-course"><h2>Ways to take this course</h2>
    <div class="flex flex-col gap-6"><div class="border-putty-400 overflow-hidden rounded-2xl border">
      <div class="bg-foreground flex items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <span class="text-background text-lg font-bold">Certificate</span>
          <span class="border-background text-micro text-inverted-foreground rounded border px-2 py-0.5">Verified</span>
        </div>
        <span class="text-background text-lg font-bold">$149 USD</span>
      </div>
    </div></div>
  </section>
  <div class="flex flex-col py-4 lg:pt-16">
    <h2>Frequently asked questions</h2>
    <div class="flex flex-col gap-3"><div data-slot="accordion">
      <div data-slot="accordion-item"><button data-slot="accordion-trigger"><span>Do I need prior AI experience?</span></button><div data-slot="accordion-content"><div>No prior experience is required.</div></div></div>
    </div></div>
  </div>
  <script>
    document.getElementById("show-more-btn").addEventListener("click", function () {
      var list = document.getElementById("weeks-list");
      if (!list.dataset.expanded) {
        var li = document.createElement("li");
        li.innerHTML = "<p>Week 3: Advanced Workflows</p><ul class=\\"mt-2 flex flex-col gap-1 pl-8\\"><li>Multi-agent orchestration</li></ul>";
        list.appendChild(li);
        list.dataset.expanded = "true";
      }
      this.setAttribute("aria-expanded", "true");
    });
  </script>
</body></html>`);
    return;
  }

  // Handle standard HTML pages (e.g. / or /about)
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mock Home Page</title>
  <meta name="description" content="This is a description of the mock home page.">
  <link rel="canonical" href="http://localhost:3001${url}">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="Mock Home Page">
  <meta property="og:description" content="This is a description of the mock home page.">
  <meta property="og:url" content="http://localhost:3001${url}">
  <meta property="og:image" content="http://localhost:3001/image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Mock Home Page">
  <meta name="twitter:description" content="This is a description of the mock home page.">
  <meta name="twitter:image" content="http://localhost:3001/image.jpg">
</head>
<body>
  <header>
    <div class="logo-container">
      <a class="logo" href="/">
        <img src="/logo.png" alt="Logo">
      </a>
    </div>
    <nav>
      <a href="/about">About</a>
      <button class="learn-btn">Learn</button>
      <button class="search-trigger">Search</button>
    </nav>
    <div class="mega-menu-drawer" style="display: none;">
      Mega Menu Content
    </div>
    <div class="search-modal" style="display: none;">
      <input type="search" placeholder="Search...">
    </div>
    <script>
      // Simple interactive behavior
      document.querySelector('.learn-btn').addEventListener('click', () => {
        const drawer = document.querySelector('.mega-menu-drawer');
        drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
      });
      document.querySelector('.search-trigger').addEventListener('click', () => {
        const modal = document.querySelector('.search-modal');
        modal.style.display = 'block';
        modal.querySelector('input').focus();
      });
    </script>
  </header>

  <main>
    <h1>Welcome to the Mock Site</h1>
  </main>

  <footer>
    <nav section="footer-links">
      <section class="footer-section">
        <h3>Company</h3>
        <ul>
          <li><a href="/about">About Us</a></li>
        </ul>
      </section>
      <section class="footer-section">
        <h3>Resources</h3>
      </section>
      <section class="footer-section">
        <h3>Legal</h3>
      </section>
      <section class="footer-section">
        <h3>Social</h3>
        <a href="https://facebook.com/mock">Facebook</a>
        <a href="https://twitter.com/mock">Twitter</a>
        <a href="https://linkedin.com/mock">LinkedIn</a>
        <a href="https://instagram.com/mock">Instagram</a>
      </section>
    </nav>
    <div class="language-selector">
      <select>
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
      <button class="apply">Apply</button>
    </div>
    <div class="copyright">&copy; ${new Date().getFullYear()} Mock Inc.</div>
    <a href="https://apple.com/app-store">App Store</a>
    <a href="https://google.com/play-store">Google Play</a>
    <script>
      document.querySelector('.language-selector button.apply').addEventListener('click', () => {
        const select = document.querySelector('.language-selector select');
        document.documentElement.setAttribute('lang', select.value);
      });
    </script>
  </footer>
</body>
</html>`);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Mock server running at http://localhost:${PORT}/`);
});
