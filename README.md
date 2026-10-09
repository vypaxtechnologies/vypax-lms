# Vypax Technologies Website

This project serves the Vypax Technologies website and its public pages. MongoDB Atlas is used for learner accounts and sessions.

## Stack
- React + Vite for the website shell
- Node.js + Express for serving the site, account authentication, and enquiry email delivery
- MongoDB Atlas for persistent accounts and sessions
- Resend for enquiry and application email delivery

## Structure
- `frontend/` — React shell and the preserved website UI/assets under `frontend/public/site/`
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
