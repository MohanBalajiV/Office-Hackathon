# User Story → Tests

A small full-stack developer tool that converts Jira user stories into test cases using an LLM-backed backend. The repository contains two workspaces:

- `backend` — Express + TypeScript API that communicates with Jira and an LLM to generate test cases.

Express (aka Express.js) is a minimal web framework for Node.js. It makes it easy to build HTTP APIs and web apps by giving you simple primitives for routing, middleware, and request/response handling—without a lot of boilerplate

- `frontend` — Vite + React + TypeScript app with a simple UI for connecting to Jira, selecting stories, and generating tests.

This README covers local setup, environment variables, development workflow, and troubleshooting tips (including the common Vite proxy / backend port mismatch error).

## Quick start

Prerequisites

- Node.js 18+ (or a recent LTS)
- npm

Install dependencies for both workspaces from the repository root:

```powershell
# From the project root
npm install
```

Start both frontend and backend in development mode (one command):

```powershell
npm run dev
```

- Frontend dev server (Vite) runs on http://localhost:5173 by default.
- Backend dev server runs on the port set in `backend/.env` or the root `.env` (default: `8080`). The backend prints the actual host/port at startup.

## Project layout

- frontend/
  - `src/` — React app and components (Jira connector, dropdown, details card)
  - `vite.config.ts` — Vite dev server and proxy configuration
  - `package.json` — frontend scripts and deps

- backend/
  - `src/` — Express server, routes, and Jira/LLM services
  - `package.json` — backend scripts and deps
  - `.env` — backend environment variables (optional)

## Environment variables (backend)

Create a `.env` at the repository root or inside `backend/` to configure the backend. Supported variables:

- `PORT` (default: `8080`) — port the backend listens on.
- `HOST` (default: `127.0.0.1`) — network interface to bind.
- `CORS_ORIGIN` (default: `http://localhost:5173`) — allowed origin for CORS when running frontend locally.
- `SESSION_SECRET` — secret used by `express-session` (replace in production).

Example `.env`:

```text
PORT=8080
HOST=127.0.0.1
CORS_ORIGIN=http://localhost:5173
SESSION_SECRET=dev-secret
```

## Vite proxy and common connectivity issue

The frontend dev server (Vite) proxies requests that start with `/api` to the backend. The proxy target is configured in `frontend/vite.config.ts`.

Common error: when you see something like:

```
[vite] http proxy error: /api/jira/connect [1] AggregateError [ECONNREFUSED]
```

This means Vite attempted to forward the request to the configured backend address but could not establish a TCP connection. Typical causes:

- The backend is not running.
- The backend is running on a different port than the proxy target (port mismatch).
- Another process is occupying the configured backend port (EADDRINUSE).

How to fix:

1. Confirm the backend process is running and note the printed host/port from `backend/src/server.ts` startup logs. Example log: "Backend listening on http://127.0.0.1:8080".
2. Open `frontend/vite.config.ts` and ensure the proxy `target` matches that host/port. Commonly it's `http://127.0.0.1:8080`.
3. If the port in use conflicts, either stop the process using the port or change `PORT` in your `.env` and restart the backend.

On Windows you can inspect port usage via PowerShell:

```powershell
# find which process listens on 8080
netstat -ano | Select-String ":8080"
# then lookup the PID
tasklist /FI "PID eq <pid>"
```

## How the Jira integration works (dev notes)

- The frontend collects Jira connection details from the user (Jira base URL, email/account, API token). It POSTs those credentials to `/api/jira/connect` which stores them in the current session (dev uses in-memory sessions).
- Subsequent calls to `/api/jira/stories` and `/api/jira/story/:key` use the session-stored credentials to query Jira Cloud REST APIs.
- The backend contains a small ADF → HTML conversion routine to render Jira issue descriptions and acceptance criteria.

Security note: session storage is in-memory for development only. For production use a persistent session store and use HTTPS (set cookie.secure to true and provide a strong `SESSION_SECRET`).

## API endpoints (backend)

- GET /api/health — simple health check
- POST /api/jira/connect — body: { baseUrl, email, apiToken } — stores creds in session and validates connection
- GET /api/jira/stories?q=<jql> — search for stories using Jira JQL (optional q param)
- GET /api/jira/story/:key — fetch issue details and convert to HTML
- POST /api/generate-tests — accepts a request payload to generate tests via the LLM pipeline

Dev-only endpoints

- GET /api/jira/_store — returns the current session's stored Jira credentials (useful for debugging; do not enable in production)

## Running just the backend or frontend

From the root you can run either workspace individually using npm's workspace flags:

```powershell
# run only backend
npm run dev --workspace=backend
# run only frontend
npm run dev --workspace=frontend
```

## Type checking and builds

- Typecheck workspaces:

```powershell
npm run typecheck
```

- Build frontend and backend for production:

```powershell
# build backend
( cd backend; npm run build )
# build frontend
( cd frontend; npm run build )
```

## Troubleshooting tips

- If you get `EADDRINUSE` when starting the backend on `8080`, either change the `PORT` in `.env` or stop the process using that port. See the Vite proxy section above for commands to inspect running processes on Windows.
- If CORS errors appear, confirm `CORS_ORIGIN` matches the frontend origin printed by Vite (usually `http://localhost:5173`).
- If session cookies are not sent by the browser, ensure `axios` requests include credentials (the frontend is already configured with `withCredentials: true`) and that the backend's CORS config allows credentials.

## Next steps / improvements

- Replace in-memory session store with a production-ready store (Redis, SQL-backed sessions).
- Add more robust ADF → HTML conversion or use an established renderer package for Jira ADF.
- Add end-to-end tests that mock Jira and LLM calls.

## Contributing

PRs welcome. Please open issues for feature requests or bugs.

## License

This project is provided as-is for demonstration purposes.
