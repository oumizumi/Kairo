# TA Scraper

Scrapes TA job postings from the uOttawa eCase portal.

## Target

https://uottawa.syntosolution.com/saml2Login

Angular SPA (eCase platform) behind SAML2 SSO authentication.

## Auth flow

1. Navigate to saml2Login
2. Redirected to uOttawa SSO (Microsoft/Shibboleth IdP)
3. Login with uOttawa credentials
4. SAML assertion posted back to syntosolution.com
5. Angular app loads, table renders

## Scraping approach

Puppeteer (JS execution required — page is client-side rendered).

Table target: `#ecase_opportunities_table` (mat-table, Angular Material)

## MFA problem

uOttawa SSO likely requires MFA (Microsoft Authenticator / Duo).
Options:
- TOTP secret storage (if TOTP-based)
- Manual login once in non-headless mode, save session cookies, reuse until expiry

## Status

Not started.
