# Boresha

A finance and business tracking app built with Node.js, PostgreSQL, and Google login.

## Local Development

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

## Deploying on Render

### Option 1: Using render.yaml (Recommended)

1. Push your code to GitHub
2. Connect your Render account and create a new service from your repository
3. Select **Deploy with render.yaml**
4. Add the following environment variables in Render's dashboard:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL` (e.g., `https://your-app.render.com/auth/google/callback`)
5. Deploy

### Option 2: Using Dockerfile (Alternative)

If render.yaml doesn't work, Render will automatically use the Dockerfile:

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Render will detect the Dockerfile automatically
4. Add the following environment variables:
   - `DATABASE_URL` (Render provides this from the PostgreSQL instance)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL` (use your Render domain)
   - `SESSION_SECRET` (generate a secure random string)
   - `NODE_ENV=production`
5. Deploy

### Option 3: Manual Setup

1. Create a new Web Service and PostgreSQL database on Render
2. Connect your GitHub repository
3. Set these environment variables:
   - `DATABASE_URL` (Render provides this automatically from the PostgreSQL instance)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL` (use your Render domain)
   - `SESSION_SECRET` (generate a secure random string)
   - `NODE_ENV=production`

4. Set the start command to: `npm run build && npm start`
5. Deploy

## Environment Variables Required

- **DATABASE_URL** — PostgreSQL connection URI
- **GOOGLE_CLIENT_ID** — Google OAuth client ID from Google Cloud Console
- **GOOGLE_CLIENT_SECRET** — Google OAuth client secret
- **GOOGLE_CALLBACK_URL** — OAuth redirect URL (must match Google Cloud Console)
- **SESSION_SECRET** — Random string for session encryption (required for production)
- **NODE_ENV** — Set to `production` for deployed apps

## Pages

- `/login` — Google OAuth login
- `/overview` — main financial summary
- `/personal` — personal income and expense entries
- `/goals` — savings goal tracking
- `/business` — business management and transactions
- `/combined` — combined personal and business totals
- `/settings` — currency and alert preferences

