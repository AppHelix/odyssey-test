# Standalone Page Validation Framework

A configurable, standalone Playwright-based validation framework for verifying page health, SEO metadata, header, and footer functionality across target websites.

---

## 📂 Project Structure

```text
validation-framework/
├── config/
│   ├── page-validation.config.ts  # TypeScript interfaces and default configurations
│   ├── urls.json                  # Manual URL list (used when USE_SITEMAP=false)
│   └── sitemap-urls.json          # Cached sitemap URLs (auto-generated at runtime)
├── docs/
│   ├── architecture-guide.md      # Layer-by-layer file reference
│   ├── functionality-guide.md     # Usage scenarios, execution flow, and extension guide
│   └── test-specifications.md     # Detailed per-validator assertion specifications
├── pages/
│   └── HomePage.ts                # Page Object Model encapsulating DOM selectors
├── services/
│   └── page-validation.service.ts # Central orchestrator and validator registry
├── tests/
│   ├── global-setup.ts            # Pre-test sitemap fetcher and port coordinator
│   ├── mock-server.js             # Zero-dependency local HTTP server for offline testing
│   └── page-validation.spec.ts    # Main Playwright E2E test runner
├── utils/
│   └── network.ts                 # HTTP helpers, URL validation, and sitemap parser
├── validations/
│   ├── page-health.validator.ts   # HTTP status codes and redirect location checks
│   ├── seo.validator.ts           # HTML meta tags, Open Graph, and Twitter Card checks
│   ├── header.validator.ts        # Logo, navigation, mega-menu, and search checks
│   └── footer.validator.ts        # Footer sections, social links, locale, and copyright checks
├── .env                           # Environment configuration (BASE_URL, USE_SITEMAP, etc.)
├── package.json                   # NPM package and scripts
├── playwright.config.ts           # Playwright runner settings
└── tsconfig.json                  # TypeScript compiler configuration
```

---

## 🚀 Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (bundled with Node.js)

### 1. Install Dependencies

Navigate to the `validation-framework/` directory and install packages:

```bash
cd validation-framework
npm install
```

### 2. Install Playwright Browser Binaries

Install the Chromium browser binary required for test execution:

```bash
npx playwright install chromium
```

### 3. Configure Environment Variables

Copy or edit the `.env` file at the root of `validation-framework/`. See the [Environment Configuration](#️-environment-configuration) section below for all available options.

### 4. Run the Tests

```bash
npm test
```

To open the interactive Playwright UI:

```bash
npm run test:ui
```

To view the HTML report after a test run:

```bash
npm run test:report
```

---

## ⚙️ Environment Configuration

All runtime behavior is controlled via the `.env` file in the framework root:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `BASE_URL` | `http://localhost:3001` | Target website URL (e.g., `https://odyssey.stage.edx.org/`) |
| `USE_SITEMAP` | `false` | `true` to discover URLs from sitemap; `false` to use `config/urls.json` |
| `SITEMAP_PATH` | `/sitemap.xml` | Path to the sitemap endpoint, relative to `BASE_URL` |
| `URLS_FILE` | `config/urls.json` | Path to the manual URL list file (used when `USE_SITEMAP=false`) |
| `ACTIVE_VALIDATORS` | `health,seo,header,footer` | Comma-separated list of validators to enable |

### Example `.env`

```ini
BASE_URL=https://odyssey.stage.edx.org/
USE_SITEMAP=true
SITEMAP_PATH=/sitemap.xml
ACTIVE_VALIDATORS=health,seo,header,footer
```

---

## 🛡️ Validators

The framework runs four validation layers sequentially per page. Each layer can be independently toggled via `ACTIVE_VALIDATORS`:

| Validator | Key | File |
| :--- | :--- | :--- |
| HTTP Status & Health | `health` | `validations/page-health.validator.ts` |
| SEO Metadata | `seo` | `validations/seo.validator.ts` |
| Header Functionality | `header` | `validations/header.validator.ts` |
| Footer Functionality | `footer` | `validations/footer.validator.ts` |

> Redirect pages (3xx) only run the `health` validator — content checks are automatically skipped.

---

## 📖 Documentation

| Document | Description |
| :--- | :--- |
| [architecture-guide.md](docs/architecture-guide.md) | Layer-by-layer breakdown of all files and their roles |
| [test-specifications.md](docs/test-specifications.md) | Detailed assertion specifications for each validator |
| [functionality-guide.md](docs/functionality-guide.md) | Usage scenarios, execution flow diagram, and extension guide |

---

## 🧪 Running Specific Validators

Disable validators at runtime by editing `ACTIVE_VALIDATORS` in `.env`:

```ini
# Run only health and SEO checks
ACTIVE_VALIDATORS=health,seo
```

---

## 📦 Dependencies

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `@playwright/test` | `^1.58.2` | E2E test runner and browser automation |
| `dotenv` | `^17.4.2` | Environment variable loading |
| `typescript` | `^5.0.0` | TypeScript compilation (dev) |
