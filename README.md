# Vypax Technologies Website

This project serves the Vypax Technologies website and its public pages. MongoDB Atlas is used for learner accounts and sessions.

## Stack
- React + Vite for the website shell
- Node.js + Express for serving the site, account authentication, and enquiry email delivery
- MongoDB Atlas for persistent accounts and sessions
- Resend for enquiry and application email delivery
- Cloudflare Pages for the public static website deployment

## Structure
- `frontend/` — React shell, static pages/assets under `frontend/public/site/`, and build-time SEO generation
- `backend/` — Express server and email enquiry endpoint
- `package.json` — root scripts

## Run
1. Install Node.js 20.19+ or 22+.
2. Add `MONGODB_URI` from `.env.example` to your local `.env` and set it to your MongoDB Atlas connection string. Preserve any existing `.env` settings, and add the development machine's IP to the Atlas network access list.
3. Run `npm install`.
   Also install the frontend dependencies with `npm --prefix frontend install`.
4. Run `npm run dev`.

Login and sign-up are available from the **Login / Sign up** navigation link. Password reset emails require `RESEND_API_KEY` and `EMAIL_FROM`.

For production:
```bash
npm install
npm --prefix frontend install
npm run build
npm start
```

Public enquiries and hackathon partnership enquiries are delivered using Resend and require `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_TO`. Paid internship applications are saved to the learner account and continue to payment verification. Career applications are delivered using Resend with the applicant's résumé attached (PDF, DOC, or DOCX, up to 5 MB); they use `CAREER_EMAIL_TO` when set, or fall back to `EMAIL_TO`. For production, set `CLIENT_URL` to the public site origin and configure `MONGODB_URI` and `MONGODB_DATABASE` in the deployment environment.

## Payments and administrator verification

The internship application requires login/sign-up and preserves the selected domain and duration. It creates an account-linked payment record, then opens the UPI/QR payment panel. Transaction references and optional receipts are submitted for administrator review. Only administrators can approve or reject submitted proof; approval unlocks the internship workspace. Rejections include feedback and allow corrected proof to be submitted. Review decisions are retained in the payment history.

The QR currently provided by the business belongs to **Harsh Saini**, UPI ID **harshsaini05012004@okaxis**. `PAYMENT_UPI_ID` and `PAYMENT_RECIPIENT` may override the payment link; the existing QR is displayed only for its matching UPI ID. Confirm the amount and recipient in the payment app. This flow uses manual bank verification rather than an automatic payment gateway.

Production requires `MONGODB_URI`. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` before starting a fresh database; there is no built-in administrator password. MongoDB stores accounts, sessions, learner state and receipt uploads. The JSON fallback is for local development. Before switching an existing file-backed deployment, back up its data and run `node backend/migrate-storage.js` with the production database settings. This imports learner records without overwriting existing records; old sessions are not imported. Keep the original backup until the migration has been checked.

Run `npm test` to verify sign-in requirements, application fees, receipt ownership, administrator approval/rejection and access control. Database connection and live deployment require separate validation against the configured Atlas account.

## Administrator content management

The configured administrator email is `vypaxtechnologies@gmail.com`. Keep `ADMIN_PASSWORD` in private backend environment settings; never commit it. On startup, the configured email receives administrator privileges when an admin password is present. An existing matching learner account retains its ID and learning/payment records. New administrators use a unique account ID.

The dashboard at `/admin` manages training programs, internship fees and learning notes, and job opportunities. Listings can be created, edited, saved as drafts, published or unpublished. Records are preserved; unpublishing stops new applications without deleting existing enrolments. MongoDB stores listings and checks versions to prevent stale edits from overwriting newer changes. Public pages read published listings through `/api/catalogue`; private notes and administrator identifiers are excluded. Enquiries and job applications still require the configured email-delivery service.

The frontend now uses the website's `/api` route for its Express backend. Cloudflare Pages alone does not provide this API; configure a working backend route and MongoDB before publishing this branch. Render is no longer hard-coded in the frontend.

## Search Console and deployment

Keep the public name **Vypax Technologies**, with IT services and consulting as the main homepage focus. Build output includes crawlable page content, canonical/social metadata, Organization and WebSite structured data, `robots.txt` and `sitemap.xml`. An optional `GOOGLE_SITE_VERIFICATION` build variable adds the HTML verification tag.

Deploy the complete `frontend/dist` directory. The frontend requires its own dependency installation; use `npm ci && npm --prefix frontend ci && npm run build` in Cloudflare Pages. In Search Console, choose `https://vypax.pages.dev/` using `vypaxtechnologies@gmail.com` and submit `sitemap.xml`. Confirm the report changes to Success, then inspect the homepage, `/services`, `/about` and `/contact`. Google decides indexing, displayed site names and sitelinks; neither submission nor metadata guarantees placement.

For the Cloudflare Pages project, use the repository root as the project root, `npm ci && npm --prefix frontend ci && npm run build` as the build command, and `frontend/dist` as the output directory. The frontend build generates the public page shells, `sitemap.xml`, `robots.txt`, and `404.html` from the route manifest in `frontend/src/seo-pages.js`. Publish the complete `frontend/dist` output; do not deploy only the Vite app shell.

The sitemap uses `https://vypax.pages.dev/` as its canonical origin and lists extensionless paths, matching Cloudflare Pages' automatic `.html` normalization. After deployment, check `/sitemap.xml`, `/robots.txt`, and a nonexistent URL on the live Pages domain, then submit the sitemap in Google Search Console. Sitemap submission helps discovery but does not guarantee that Google will index any page.
