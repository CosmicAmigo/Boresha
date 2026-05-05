# Boresha

A finance and business tracking app built with Node.js, PostgreSQL, and Google login.

## Local setup

1. Copy environment values into a `.env` file from `.env.example`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your PostgreSQL database and run the SQL schema:
   ```bash
   psql "$DATABASE_URL" -f database.sql
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open the app in your browser:
   ```bash
   http://localhost:3000
   ```

## Environment variables

- `DATABASE_URL` — PostgreSQL connection URI
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `GOOGLE_CALLBACK_URL` — OAuth callback URL (default: `http://localhost:3000/auth/google/callback`)
- `SESSION_SECRET` — session encryption secret

## Pages

- `/overview` — main financial summary
- `/personal` — personal income and expense entries
- `/goals` — savings goal tracking
- `/business` — business management and transactions
- `/combined` — combined personal and business totals
- `/settings` — currency and alert preferences

