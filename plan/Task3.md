# Task 3: Header & Footer Validation

- [ ] Create `validation-framework/validations/header.validator.ts` to test:
  - Header element presence and visibility.
  - Required navigation link/element availability.
  - Logo presence, successful image loading (evaluating `.complete` / `.naturalWidth`), and logo URL status success.
  - "Learn" button presence, click action, and assertion of mega-menu/drawer visibility.
  - Search trigger availability, click/focus interaction, and verification of search input focus.
- [ ] Create `validation-framework/validations/footer.validator.ts` to test:
  - Footer element presence.
  - Presence of 4 specific sections and check if they are visible.
  - Social links existence, structure, and validity check (avoiding external network requests unless `checkExternalLinks` is set).
  - Language selector dropdown presence, clicking selector, checking options, selecting a locale (e.g. `es`), clicking "Apply", and verifying page language updates or redirects.
  - Copyright text presence and verification that the current year is displayed.
  - App Store & Play Store download link existence and valid destination URLs.
- [ ] Integrate Header and Footer validations into `validation-framework/tests/page-validation.spec.ts`.
- [ ] Verify both validators run successfully.
