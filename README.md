# Vypax Technologies — MERN Migration

This package contains the Vypax Technologies website migrated to a MERN-based project while preserving the existing visual UI and static page behavior.

## Stack
- React + Vite
- Node.js + Express
- MongoDB + Mongoose
- FormSubmit.io for public form submissions

## Structure
- `frontend/` — React shell and the preserved website UI/assets under `frontend/public/site/`
- `backend/` — Express server and MongoDB model/API
- `package.json` — root scripts

## Run
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set `MONGODB_URI`.
3. Run `npm install`
4. Run `npm run dev`

For production:
```bash
npm install
npm run build
npm start
```

The existing public enquiry forms use FormSubmit:
`https://formsubmit.co/vypaxtechnologies@gmail.com`

No SQLite database or SMTP mail server is required by this migrated package.
