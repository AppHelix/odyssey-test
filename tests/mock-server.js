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
