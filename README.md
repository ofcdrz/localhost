# GlassConnect — React + Node.js Dashboard

A modern glassmorphism workspace UI for managing contacts and consent-based communication. It includes a single-contact, consent-gated Exotel click-to-call integration. The notification composer remains preview-only.

## Features

- React + Vite frontend with responsive glass dashboard
- Express REST API
- Signup/login with bcrypt password hashing and JWT sessions
- Contact management and explicit consent status
- Notification preview flow that blocks contacts without consent
- Exotel India click-to-call for one opted-in contact at a time
- Calls your verified agent phone first, then bridges the selected contact
- Per-contact cooldown (10 minutes) and workspace limit (3 calls/hour)
- Call status callback endpoint and activity log entries
- Activity log, engagement chart, settings and help pages
- Demo contacts are seeded on first account registration

## Requirements

- Node.js 18 or newer
- npm

## Run locally

1. Extract the ZIP and open the project folder in a terminal.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your environment file:

   ```bash
   cp .env.example .env
   ```

   Set `JWT_SECRET` to a long, random value. On Windows PowerShell, use `Copy-Item .env.example .env`.

4. For real calls, complete Exotel account KYC, obtain an ExoPhone, and fill in the Exotel values in `.env`: `EXOTEL_ACCOUNT_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_CALLER_ID`, and `EXOTEL_AGENT_NUMBER`. Keep credentials server-side; never put them in React/Vite variables or commit `.env`. The `EXOTEL_AGENT_NUMBER` must be your own verified number.

5. Deploy the Node API over HTTPS and set `PUBLIC_API_URL` to its public base URL so Exotel can reach `/api/calls/status`.

4. Start the frontend and backend together:

   ```bash
   npm run dev
   ```

6. Open <http://localhost:5173>. Create an account to enter the dashboard. The API runs at <http://localhost:4000>.

## Production build

```bash
npm run build
npm start
```

Deploy the Vite `dist/` folder to a static host and the Express server to a Node host, then configure the frontend API base/proxy for your deployment. Exotel status callbacks require a publicly reachable HTTPS Node API.

## GitHub setup

```bash
git init
git add .
git commit -m "Initial GlassConnect dashboard"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

GitHub is ideal for storing the source. **GitHub Pages only hosts static frontend files; it does not run the Express backend.** For a working full-stack deployment, host the React build on a static host and deploy the Node API separately (for example, a Node application host). Configure CORS and the frontend API URL for your chosen host.

## Important production work

This starter uses in-memory demo data, so users and records reset when the server restarts. Before real use:

- Replace in-memory Maps with a persistent database (PostgreSQL or MongoDB).
- Use a strong secret in environment variables; never commit `.env`.
- Add rate limiting, validation, audit logging, account recovery and stronger session controls.
- Obtain and retain verifiable opt-in records; implement opt-out and suppression lists. The demo consent toggle is only a placeholder—replace it with a durable consent record (timestamp, source, purpose and proof) before production.
- The current in-memory users, contacts, call records, cooldowns and activity reset when the server restarts; use a database and distributed rate limiter for production.
- The call endpoint is intentionally single-recipient only. It applies a 10-minute per-contact cooldown and a 3-calls-per-hour workspace cap. Review local telecom rules and provider policies before deployment.
- If you later connect a legitimate messaging/voice provider, follow its acceptable-use rules and all applicable telecom/privacy laws.
- Add provider credentials only as server-side environment variables.

## API routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/contacts`
- `POST /api/contacts`
- `PATCH /api/contacts/:id/consent`
- `DELETE /api/contacts/:id`
- `POST /api/notifications/preview` — preview only, no real delivery
- `POST /api/calls` — initiates one Exotel click-to-call after opt-in and confirmation
- `POST /api/calls/status` — Exotel terminal status callback
- `GET /api/activity`
- `GET /api/health`
