# Mainely Insulation and Weatherization — website

Rebuild of mainelyinsulation.com for Mainely Insulation and Weatherization (28 Old Alfred Rd, Biddeford, ME).
Node/Express + SQLite, with an estimate-request form, email alerts and a login-protected lead dashboard at `/admin`.

## Folder layout

```
server.js            thin entry point
db/init.js           SQLite setup (reads DB_PATH)
lib/                 auth, mailer, rate limiter
routes/              quote form API, admin dashboard, old-URL redirects
views/               admin login + dashboard pages
public/              the website (index, services, thanks, 404, css, js, images)
```

## Photos

Real client job photos live in `public/images/<service>/` (resized to 1024px JPGs), plus:
- `images/logo.png` (transparent, header + footer), `images/og-image.jpg` (1200×630 social-share preview)
- `images/feature/science.jpg` and `images/feature/about.jpg` (cropped homepage feature shots)

To add more job photos, drop them in the right folder and add the name in `public/js/gallery-data.js`.
The vapor barrier gallery currently reuses two fiberglass shots that show poly sheeting; swap in dedicated vapor barrier photos when available.

## Deploy on Render

1. New Web Service from this repo. Build: `npm install`. Start: `npm start`. Node is pinned to 20.x (`.node-version` + `engines`) because better-sqlite3 has no prebuilt binary for newer Node.
2. Add a persistent disk mounted at `/var/data` and set `DB_PATH=/var/data/mainely.sqlite` (otherwise leads are wiped on each redeploy).
3. Environment variables (see `.env.example`):
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD` (8+ chars — login is disabled without it), `SESSION_SECRET` (16+ random chars)
   - `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASS` (Gmail app password)
   - `NOTIFY_EMAIL` — the inbox that gets new estimate requests
   - `SITE_URL=https://mainelyinsulation.com` — for the "View in dashboard" link
4. Point the domain at Render. Old URLs (`/sprayfoam`, `/cellulose`, `/about`, …) 301-redirect to the new pages.

## Lead system (the part that gets them work)

- **Two ways in:** a 4-field quick form right under the hero (name, phone, town, service) and the full estimate form at the bottom. Every "Request an estimate" button goes to the quick form; service pages link to the full form with that service pre-checked, and "Ask about my rebates" pre-checks the rebate box.
- **Alerts:** each lead emails `NOTIFY_EMAIL` (comma-separate for Trey + Scott) with Call / Email buttons. Reply-To is the customer.
- **Customer auto-reply:** if they leave an email, they get a short confirmation from the business (`SEND_CONFIRMATION=false` to turn off).
- **Lead source tracking:** each lead records where the visitor came from (Google search, Facebook/Instagram, Efficiency Maine, direct…) and which form they used. Tag links you control with UTMs so they show up by name, e.g. the Google Business Profile website link:
  `https://mainelyinsulation.com/?utm_source=gbp&utm_medium=organic` → shows as "Google Business Profile".
- **Dashboard (`/admin`):** leads in the last 7/30 days, leads waiting for a call back, jobs won, win rate, top sources and services, a warning when a lead has waited over a day, one-tap Call / Text / Email / Map buttons, search, notes, status pipeline (new → contacted → visit scheduled → quoted → won/lost), and CSV export. Works on a phone.

## Rebate figure — check yearly

The "Up to $8,600" Efficiency Maine figure (homepage + services page, `#rebates` section) comes from
efficiencymaine.com/at-home/insulation-rebates-up-to-8600/ as of Oct 2026. Efficiency Maine changes amounts
periodically; if the program changes, update both pages. Rebates apply to existing homes only, not new construction.

## Editing common things

- Phone + social links: `public/js/site-config.js` (blank social links are hidden).
- Brand colors: top of `public/css/styles.css`.
- Lead statuses: `routes/admin.js` (`STATUSES`).
