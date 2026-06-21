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
