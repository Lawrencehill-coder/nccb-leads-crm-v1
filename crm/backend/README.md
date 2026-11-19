# NCCB Apps Script backend deployment

This backend is **NCCB only**, separate from the NCCB2 commissions Netlify Function. It supports authenticated, read-only CRM functions `me`, `listLeads`, and `listUsers`.

## Setup
1. Create a restricted NCCB Google Spreadsheet (or map the verified existing CRM spreadsheet) with tabs:
   - `Leads`: `id,name,company,status,assignedTo,followUp`
   - `Users`: `email,role,active`
2. In a new Apps Script project, paste `Code.gs`. Under Project Settings > Script Properties, set:
   - `NCCB_GOOGLE_CLIENT_ID` = Google OAuth web client ID
   - `NCCB_SHEET_ID` = spreadsheet ID
   - `NCCB_SUPER_ADMIN_EMAIL` = approved NCCB owner email (must be verified before assigning)
3. Deploy as Web App, executing as the owner; access set to anyone so Google ID-token verification can occur in the script. The API **rejects every unauthenticated request**.
4. Add the Google OAuth web client ID and Apps Script `/exec` URL to `../crm/config.js`.
5. Set the GitHub Pages origin in the Google Cloud OAuth client authorized JavaScript origins. Test from the published site.
6. Confirm that an unauthorized account is rejected, representatives only see their assigned records, admins see the authorized roster, and super admin access is assigned only to the approved owner.
7. Do not deactivate Netlify until lead counts and data have been reconciled and all required workflow functions have replacements.

## Limitations
This first backend supports **read-only leads and user roster**. It does not yet implement create/edit/delete, assignment changes, audit logging, or a complete sales workflow. Never advertise those functions as working. Do not put the client secret or private Sheet data in the GitHub repository. Google Apps Script has quotas and performance limits. If Google authentication, CORS, or Google Apps Script redirect behavior prevents requests from GitHub Pages, move to an authenticated non-Netlify API before release.

The tokeninfo verification performs an online verification on each request; for high-volume production use, implement signed JWT verification with appropriate caching and security controls in a dedicated backend.
