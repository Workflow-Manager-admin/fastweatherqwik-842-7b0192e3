# Weather Frontend Proxy and API Host Configuration

## Vite Proxy Setup (Development)

During local development, all `/api/weather` API requests from the frontend (port 3000) are proxied to the backend FastAPI server (`/weather` endpoint, typically port 3001). This proxy is configured in `vite.config.ts`:

- Set the environment variable `WEATHER_BACKEND_URL` to the backend URL if running outside of local Docker Compose or remote dev.
- Example: `WEATHER_BACKEND_URL=https://vscode-internal-703124-beta.beta01.cloud.kavia.ai:3001`

## Production/Deployment

- Ensure that either the deployment platform or your environment injects the variable `WEATHER_BACKEND_URL`.
- All `/api/weather` calls from the Qwik frontend will route through the backend if deployed behind a reverse proxy or on Kavia.

## Typical Usage

- **Local:** Backend at `localhost:3001`, frontend at `localhost:3000`.
- **Cloud/Kavia:** Use the full backend URL as provided in deployment.
