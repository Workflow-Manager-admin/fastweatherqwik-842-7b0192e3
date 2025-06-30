# Weather Frontend: Proxy & API Host Configuration

This document describes how the Qwik weather dashboard frontend (`weather_frontend/`) communicates with the backend API server via path rewrites and proxy for both local development and deployment scenarios.

---

## Vite Proxy Setup (Local Development)

- **Proxying:** All requests to `/api/weather*` (on port 3000, frontend) are proxied & rewritten to `/weather*` on your backend (typically running at port 3001, FastAPI).
  - Example: `/api/weather/current` → `http://localhost:3001/weather/current`
- **Configuration Files:** See `vite.config.ts` (core) and `vite.config.local.js` for explicit dev-local override.
- **Environment Variable:** Use the `WEATHER_BACKEND_URL` environment variable to specify the backend API base, e.g.
    ```
    WEATHER_BACKEND_URL=https://your-cloud-backend:3001
    ```
  If not set, defaults to `http://localhost:3001`.
- **Rewriting:** Only the `/api/weather` prefix is rewritten (not additional path segments), preserving routes like `/weather/current`, `/weather/forecast`, etc., according to backend API design.

**Usage flow:**
1. Start backend (FastAPI) at port 3001 – should expose `/weather/current`, `/weather/forecast`, etc.
2. Start frontend (Qwik/Vite) at port 3000.
3. Your code should always issue frontend fetches to `/api/weather*` — this will work in dev and cloud deploy.

---

## Production/Deployment

- `WEATHER_BACKEND_URL` should be set in your deployment environment if backend and frontend are on different hosts.
- Your reverse proxy (nginx, Kavia AI router, or cloud load balancer) should forward `/api/weather*` on the frontend to your backend `/weather*` endpoints.
- For platforms such as Kavia or Docker Compose, set `WEATHER_BACKEND_URL` to the public backend URL or leverage internal service networking.
- For SSR, the frontend always fetches `/api/weather*` — the proxy or environment variable ensures correct request routing.

---

## Typical Usage

- **Local:** 
  - Backend: `localhost:3001/weather/*`
  - Frontend: `localhost:3000/api/weather/*` (rewritten & proxied)
- **Cloud/Kavia:** 
  - Set `WEATHER_BACKEND_URL` in env to full backend URL/host as provided by deploy.
  - Frontend uses `/api/weather/*` with correct proxying.

---

## Troubleshooting

- **404 on `/api/weather`?** 
  - Check backend is running and exposes `/weather` endpoints.
  - Ensure `WEATHER_BACKEND_URL` is set correctly in your environment.
  - Review Vite proxy config and logs for rewrite errors.
  - On Kavia or other cloud, confirm that reverse proxy is set to route `/api/weather*` to the `weather_backend` URL.

