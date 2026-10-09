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
4. Run `npm run dev`.

Login and sign-up are available from the **Login / Sign up** navigation link. Password reset emails require `RESEND_API_KEY` and `EMAIL_FROM`.

For production:
```bash
npm install
npm run build
npm start
```

Public enquiries, hackathon partnership enquiries, and paid internship applications are delivered using Resend and require `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_TO`. Career applications are also delivered using Resend with the applicant's résumé attached (PDF, DOC, or DOCX, up to 5 MB); they use `CAREER_EMAIL_TO` when set, or fall back to `EMAIL_TO`. For production, set `CLIENT_URL` to the public site origin and configure `MONGODB_URI` and `MONGODB_DATABASE` in the deployment environment.

## Cloudflare Pages and SEO

For the Cloudflare Pages project, use the repository root as the project root, `npm run build` as the build command, and `frontend/dist` as the output directory. The frontend build generates the public page shells, `sitemap.xml`, `robots.txt`, and `404.html` from the route manifest in `frontend/src/seo-pages.js`. Publish the complete `frontend/dist` output; do not deploy only the Vite app shell.

The sitemap uses `https://vypax.pages.dev/` as its canonical origin and lists extensionless paths, matching Cloudflare Pages' automatic `.html` normalization. After deployment, check `/sitemap.xml`, `/robots.txt`, and a nonexistent URL on the live Pages domain, then submit the sitemap in Google Search Console. Sitemap submission helps discovery but does not guarantee that Google will index any page.
