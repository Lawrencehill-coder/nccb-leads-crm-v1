# NCCB Leads CRM — GitHub Pages migration build

This is the NCCB-only CRM frontend under /crm/. It is intentionally **fail-closed** until the administrator configures a Google OAuth Web Client ID and a secure authenticated API in crm/config.js.

## What has been built
- Responsive NCCB-only employee login shell using Google Identity Services.
- Role-aware CRM lead list, filters, counts, and admin-user read view.
- No sensitive records, shared secrets, or demo accounts embedded in the frontend.
- Backend requests send the Google ID token for **server-side** verification on every request.

## Critical migration requirements
1. Inventory the original NCCB Leads CRM, the NCCB2 Netlify function, and relevant Google Sheets / Apps Script deployments. Do not assume the NCCB2 commissions function is the leads CRM backend.
2. Set up a dedicated Google OAuth web client with the GitHub Pages origin. Add the client ID to crm/config.js.
3. Deploy an NCCB-only backend that validates Google ID tokens against Google's signing keys and the exact OAuth audience, checks email and authorized roles from a protected allowlist, and restricts each lead query by role/ownership.
4. Use an access-controlled data store (existing Sheets after matching and verification). Never make the Sheet public or rely on client-side role checks.
5. Implement backend actions: me, listLeads, listUsers, then lead edits, assignments, user administration and audit logging. The UI currently only reads data.
6. Test with SUPER_ADMIN, ADMIN, REPRESENTATIVE, and unauthorized accounts. Test all API endpoints directly for privilege escalation and access to other representatives' records.
7. Enable GitHub Pages for this repository in GitHub Settings > Pages (Deploy from a branch: main / root) to expose /crm/; keep the existing root portal unchanged. GitHub Pages is static hosting only.
8. Verify the new live address and all functions before announcing a cutover or turning off Netlify.

**Security warning:** This repository is public. The frontend is not a substitute for backend authorization. The current frontend blocks all access until configuration is completed; even after configuration, only a verified backend can protect client records.

## Expected frontend URL once GitHub Pages is enabled
https://lawrencehill-coder.github.io/nccb-leads-crm-v1/crm/

The URL above is **not verified live**.