# NCCB connected-system inventory — 19 November 2026

## Verified sources
- GitHub frontend source: Lawrencehill-coder/nccb-leads-crm-v1 (original portal in root index.html; new CRM migration in /crm).
- Netlify site: nccb2.netlify.app (September 18, 2026 production deploy, ready).
- Netlify nccb2 is connected to **a different GitHub repository**, Lawrencehill-coder/NCCB-SALES-COMMISSIONS-2026-V1. Its serverless function netlify/functions/nccb-api.js proxies requests to an Apps Script /exec URL. This is **not yet established** to be the Leads CRM backend.
- Netlify nccb-sales-intake.netlify.app (June 23, 2026 manual deploy).
- Google Sheet: NCCB Sales Command Center DB, spreadsheet ID 1p4wUPFExJKzBucVmQiJd38t_pv6pEWLzGca-dtMyTZE.
- Verified tabs and **header fields only** (no private row contents exported):
  - Reps: RepID, Name, PIN, Active, DateAdded
  - AdminLogins: AdminID, Name, PIN, Role, Active
  - Enrollment_Clients: ClientID, Date, RepID, FirstName, LastName, Service, CreatedAt, CreatedBy, Active
  - Activity: Date, RepID, EventType, Quantity, Timestamp, EnteredBy
  - AuditLog: Timestamp, ActorID, ActorRole, Action, Details

## Separation rules
- The Sales Command Center sheet is a **candidate operational source**, not a verified prospect Leads CRM database. Do not map Enrollment_Clients to Leads without authorization and validation.
- Never copy legacy PINs into public source or expose them through browser APIs.
- The new backend's default Leads and Users tabs are **not present** in this candidate sheet; do not set NCCB_SHEET_ID to it and claim the API works.
- Preserve original Netlify deployments and all Google Sheets records until reconciled and verified.

## Go-live checklist
1. Identify the actual leads datastore and match schema and record counts.
2. Confirm NCCB Super Admin Google email; configure Google OAuth web client.
3. Deploy authenticated backend; restrict all roles server-side and test representative isolation.
4. Implement full lead editing, assignments, user administration, audit log, and export as appropriate.
5. Configure GitHub Pages and verify HTTPS URL and browser sign-in.
6. Reconcile data and perform role/security acceptance tests.
7. Only then communicate cutover; leave Netlify running until sign-off.

## Current state
GitHub source has been committed. No Google OAuth client ID, Apps Script web-app deployment, Pages activation, or end-to-end authentication has been confirmed. **Not production-ready.**
