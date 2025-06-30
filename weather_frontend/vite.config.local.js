/**
 * Vite local development config for proxying API requests.
 * Ensures /api/weather requests are proxied to the backend FastAPI server,
 * compatible with remote/cloud docker-based deployment environments.
 *
 * Usage:
 *   - Start backend (typically FastAPI) at port 3001 (http://localhost:3001).
 *   - Start frontend (Qwik/Vite) at port 3000 (http://localhost:3000).
 *   - All requests from frontend to /api/weather will be proxied to the backend /weather endpoint e.g.,
 *        http://localhost:3000/api/weather?q=London  -->  http://localhost:3001/weather?q=London
 *
 * Environment Variable:
 *   Set WEATHER_BACKEND_URL to override the backend target (useful for cloud/dev container/k8s setups).
 *   Example: WEATHER_BACKEND_URL=https://your-cloud-backend:3001
 *
 * Rewriting:
 *   Only the `/api/weather` path is rewritten to `/weather` before proxying.
 *   Expected backend endpoints: `/weather`, `/weather/current`, `/weather/forecast`, etc.
 *
 * For deployment:
 *   Ensure the frontend deployment sets WEATHER_BACKEND_URL correctly or arrange for the reverse proxy
 *   (e.g., nginx, platform router, Kavia AI setup) to forward /api/weather to your weather backend.
 */

export default {
  server: {
    proxy: {
      '/api/weather': {
        // Proxy target backend. Falls back to local dev FastAPI.
        target: process.env.WEATHER_BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
        /**
         * Rewrite /api/weather to /weather to match backend route:
         * - /api/weather -> /weather
         * - /api/weather/current -> /weather/current
         * - /api/weather/forecast -> /weather/forecast
         */
        rewrite: path => path.replace(/^\/api\/weather/, '/weather'),
        // secure: false, // Uncomment if backend uses self-signed HTTPS (development only)
      },
    },
  },
};
