What this project does
This is a Playwright-based automation framework for validating website pages. It checks:

page health and HTTP behavior
SEO metadata
header functionality
footer functionality
It runs against a target site, collects a list of URLs, and applies a set of validators to each page. It is designed to be configurable via environment variables and config files, so you can enable or disable checks without changing code.

How it is structured
The flow is:

page-validation.spec.ts defines the test cases for each URL.
page-validation.service.ts orchestrates which validators run.
The validator modules in validations perform the actual assertions.
page-validation.config.ts controls selectors, defaults, and which validators are enabled.
Main files to work on
page-validation.service.ts

Main orchestration layer.
Best file to change if you want to alter how validators are executed.
page-validation.config.ts

Central configuration for URLs, selectors, expected values, and enabled validators.
Best place for defaults and broad behavior changes.
page-health.validator.ts

seo.validator.ts

header.validator.ts

footer.validator.ts

These contain the actual checks for each validation area.
page-validation.spec.ts

Entry point for the test suite.
Good to inspect if you want to change test flow or URL handling.
HomePage.ts

Page Object Model layer for selectors and reusable page interactions.
global-setup.ts

Pre-test setup, especially sitemap loading and URL discovery.
Good starting point
If you are new to the project, I would start with:

README.md for the big picture
page-validation.service.ts
page-validation.config.ts
One validator file such as seo.validator.ts
If you want, I can also walk you through the project file-by-file in a more detailed map.

---

## Navigation Validation System (NEW)

In addition to page validation, this framework includes a **navigation validation** system that tests hierarchical navigation paths through websites. For example: Home → Learn → Python Courses → Advanced Course.

### Key Features

**Dynamic Level Support** (Latest)
- Automatically detects any number of navigation levels from input CSV (level_1, level_2, ..., level_N)
- No code changes needed - add level_4, level_5, etc. and it works automatically
- Recursive hierarchy builder handles arbitrary depth
- Each level is validated independently with proper error reporting

**Label-Based Filtering**
- Filter tests by navigation label (e.g., "Learn", "Become", "Certificates")
- Run `NAVIGATION_LABEL=Learn` to test only that section
- Supports comma-separated labels: `NAVIGATION_LABEL=Learn,Become`
- Default: `NAVIGATION_LABEL=all` (test everything)

**Per-Label URL Limiting**
- `MAX_TESTS_PER_LABEL=5` limits each label to 5 URLs
- Useful for quick smoke tests or batch runs
- Respects the first N URLs per label

**Environment-Based Configuration**
- `POD=stage` or `POD=prod` switches between environments automatically
- URLs are substituted dynamically without modifying input files
- Example: `POD=prod` replaces `odyssey.stage.edx.org` with `www.edx.org`

**Robust Timeout & Retry Strategy**
- HTTP request timeout: 20s
- Page navigation timeout: 20s
- DOM loaded timeout: 8s
- Automatic retries (up to 3 attempts) with exponential backoff
- Content validation (minimum 50 characters per page)

**Interactive HTML Report**
- 2-panel layout: Label navigation on left, detailed results on right
- S.no column and dynamic level columns (Level_1, Level_2, etc.)
- Status sorting (PASS/FAIL)
- Unique screenshots for each failure
- No screenshot column in report (too large)

### Configuration

Environment variables in `.env`:

```bash
# Navigation input file (CSV with headers: label, level_1, level_2, ...)
NAVIGATION_URLS_FILE=page_navigation_urls.csv

# Filter by labels (comma-separated or 'all')
NAVIGATION_LABEL=Learn

# Limit URLs per label (or omit for unlimited)
MAX_TESTS_PER_LABEL=5

# Environment: stage or prod
POD=stage

# Base URL (auto-determined by POD, or override for localhost)
BASE_URL=https://odyssey.stage.edx.org/
```

### Main Files (Navigation System)

**tests/navigation.spec.ts**
- Entry point for navigation validation tests
- Orchestrates the test flow

**services/navigation.service.ts**
- Loads CSV file with dynamic level detection
- Filters rows by label and count
- Substitutes URLs based on POD
- Builds recursive hierarchy tree (any depth)
- Returns `NavigationPlan` with all rows and labels

**services/navigation-validator.ts**
- Recursively validates all levels
- Handles page navigation and link clicking
- Retry logic with exponential backoff
- Screenshot capture for failures
- Builds navigation report

**utils/excel-reader.ts**
- Reads CSV/Excel files
- Auto-detects level_1, level_2, ... level_N columns via regex
- Returns rows with dynamic `levels[]` array

**utils/report-generator.ts**
- Generates interactive HTML report
- Dynamic column generation (Level_1, Level_2, etc.)
- 2-panel layout with label navigation
- Status sorting functionality

**models/navigation-model.ts**
- `NavigationRow`: Input row with `label`, `levels[]`, `sourceIndex`
- `LevelNode`: Recursive tree node for any depth
- `LabelNode`: Grouping by label with root hierarchy
- `NavigationPlan`: Complete plan with rows, labels, `totalLevels`
- `NavigationReportRow`: Report output with status per level

**tests/global-setup.ts**
- Determines BASE_URL based on POD value
- Sets up environment for both page and navigation validation

### How to Use

**Basic test run:**
```bash
npm test -- tests/navigation.spec.ts
```

**Test specific label with limit:**
```bash
NAVIGATION_LABEL=Learn MAX_TESTS_PER_LABEL=5 npm test -- tests/navigation.spec.ts
```

**Test production environment:**
```bash
POD=prod npm test -- tests/navigation.spec.ts
```

**Multiple labels:**
```bash
NAVIGATION_LABEL=Learn,Become,Certificates npm test -- tests/navigation.spec.ts
```

### Input CSV Format

The navigation input file should have:
- **label**: Category (e.g., "Learn", "Become", "Certificates")
- **level_1**: First navigation level URL
- **level_2**: Second navigation level URL
- **level_3**: Third navigation level URL
- **level_4+**: As many levels as needed

Example:
```csv
label,level_1,level_2,level_3,level_4
Learn,https://odyssey.stage.edx.org/learn,https://odyssey.stage.edx.org/learn/python,https://odyssey.stage.edx.org/learn/python/basics,
Become,https://odyssey.stage.edx.org/become,https://odyssey.stage.edx.org/become/data-scientist,https://odyssey.stage.edx.org/become/data-scientist/path,
```

### Report Output

Report is generated at `reports/navigation-report.html`

**Design Features:**
- **Modern gradient header** with purple-violet color scheme and glassmorphism effects
- **Professional typography** using system fonts with proper hierarchy
- **Responsive layout** that works on desktop, tablet, and mobile
- **Smooth animations** and transitions for better UX
- **Accessible color contrast** meeting WCAG standards
- **Interactive elements** with hover states and visual feedback

**Report Sections:**

1. **Header** (Gradient purple background)
   - Report title with compass emoji
   - Summary statistics in glass-effect boxes:
     - Total Tests
     - Passed (green)
     - Failed (red)
     - Success Rate (large prominent number)
     - Levels Tested

2. **Left Navigation Panel**
   - Label cards with pass/fail counts
   - Active state highlighting
   - Hover effects with shadow elevation
   - Scrollable on smaller screens

3. **Right Content Panel**
   - Label header with per-label statistics (Total, Passed, Failed)
   - Data table with:
     - **S.No column**: Sequential numbering
     - **Label column**: Category badges with gradient backgrounds
     - **Level_N columns** (dynamic): URLs as clickable links + status
     - **Failure Reason column**: Error descriptions with styled warnings

4. **URL Links** (NEW!)
   - 🔗 Icon with each URL
   - Clickable links that open in new tabs
   - Truncated display (50 chars) with full URL in tooltip
   - Light blue background with hover effect
   - Opens in new tab with Ctrl+Click or normal click

5. **Status Indicators**
   - PASS: Green background with checkmark-like styling
   - FAIL: Red background with error styling
   - PENDING: Yellow/orange background

6. **Footer**
   - Report generation timestamp
   - Framework attribution

**Styling Details:**
- Color scheme: Purple (#667eea, #764ba2) gradients with complementary neutrals
- Spacing: Consistent 8px/16px/24px rhythm
- Typography: 13-15px for body text, scalable headers
- Shadows: Subtle elevation (0 10px 40px rgba(0,0,0,0.15))
- Border radius: 10-12px for modern look
- Transitions: 0.2s-0.3s ease for smooth interactions

**Mobile Responsiveness:**
- Header scales at 1400px breakpoint
- Navigation becomes horizontal scroll at 1400px
- Table font size reduces at 768px
- Grid layout adapts to available space
- Touch-friendly tap targets (40px+ minimum)

### Recent Changes (Dynamic Level Support)

**What Changed:**
- ✅ Removed hardcoded level_1, level_2, level_3 references throughout
- ✅ Implemented dynamic level detection from CSV columns
- ✅ Built recursive hierarchy for any number of levels
- ✅ Updated validator to iterate through dynamic levels
- ✅ Generated report columns dynamically based on totalLevels
- ✅ Fixed hierarchy storage (rows now kept at each level)

**Files Modified:**
- `models/navigation-model.ts`: NavigationRow uses `levels[]`, LevelNode is recursive
- `utils/excel-reader.ts`: Dynamic column detection with regex
- `services/navigation.service.ts`: Recursive buildNestedHierarchy() method
- `services/navigation-validator.ts`: validateLevelRecursively() replaces hardcoded loops
- `utils/report-generator.ts`: Dynamic header/column generation

**Testing:**
- Verified with 4-level input CSV
- Tests successfully open Level_1, search Level_2, navigate, take screenshots
- Report renders all 4 levels dynamically

### Recent Changes (Enhanced Report Styling)

**New Features:**
- ✨ **Modern gradient header** with purple-violet theme
- ✨ **Clickable URL links** with 🔗 icon in every level cell
- ✨ **Professional glass-effect UI** with backdrop filters
- ✨ **Responsive mobile design** with breakpoints
- ✨ **Enhanced data table** with better visual hierarchy
- ✨ **Interactive label navigation** with hover states
- ✨ **Color-coded status indicators** (green=pass, red=fail, yellow=pending)
- ✨ **Smooth animations** and transitions throughout

**Styling Highlights:**
- Linear gradient header: `#667eea → #764ba2`
- Glass-morphism effects on stat boxes
- Shadow elevation for depth: `0 10px 40px rgba(0,0,0,0.15)`
- Consistent spacing system: 8px/16px/24px
- Accessible contrast ratios and color blindness friendly
- Modern font stack with fallbacks
- 0.2-0.3s ease transitions for interactivity

**URL Features:**
- Clickable links open in new tab automatically
- Ctrl+Click for custom behavior
- Truncated display (50 chars) with tooltip on hover
- Full URL visible in browser tab
- Link styling: light blue background, hover animation

**Files Modified:**
- `utils/report-generator.ts`: Complete style overhaul with new HTML structure

---

## Integration Guide

This framework supports **two test modes**:

1. **Page Validation** (Original) - Run: `npm test -- tests/page-validation.spec.ts`
   - Validates individual pages: health, SEO, headers, footers
   - Configured via config files

2. **Navigation Validation** (New) - Run: `npm test -- tests/navigation.spec.ts`
   - Validates hierarchical navigation paths
   - Configured via environment variables and CSV input
   - Dynamic level support for any hierarchy depth

Both can run independently or together with proper environment setup.

---

## Report Styling Quick Reference

**Color Palette:**
```
Primary Gradient: #667eea → #764ba2 (purple-violet)
Success Green: #4ade80, #38a169
Error Red: #f87171, #cb2431
Warning Yellow: #ffe082
Neutral Gray: #2d3748, #718096, #cbd5e0, #e2e8f0
```

**Interactive Elements:**
- **Label Cards**: Click to switch between labels
- **URL Links**: Click to open in new tab (🔗 icon)
- **Hover States**: Subtle background/shadow changes
- **Active States**: Color highlight + left border

**How to Access the Report:**
1. Run tests: `npm test -- tests/navigation.spec.ts`
2. Report generates at: `reports/navigation-report.html`
3. Open in browser to view
4. Screenshots saved at: `reports/screenshots/`

**Report Navigation:**
- Click label cards on left to switch between test groups
- Hover over URLs to see full path in tooltip
- Click URLs to open in new browser tab
- Table data shows all levels tested (dynamic columns)
- Green rows = all tests passed, Red rows = failures

**Export/Share:**
- HTML report is standalone (no external dependencies)
- Can copy entire `reports/` folder
- Screenshots embedded via local file paths
- Compatible with all modern browsers (Chrome, Firefox, Safari, Edge)