/**
 * Vite local development config for proxying API requests.
 * Ensures /api/weather requests are proxied to the backend FastAPI server,
 * compatible with remote/cloud docker-based deployment environments.
 * 
 * If running frontend at :3000 and backend at :3001, this will proxy
 * http://localhost:3000/api/weather to http://localhost:3001/weather
 */

export default {
  server: {
    proxy: {
      '/api/weather': {
        // Use the actual backend host from infra if not running locally.
        // On Kavia/cloud, use the backend container's published endpoint.
        target: process.env.WEATHER_BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/weather/, '/weather'),
        // secure: false, // Uncomment if backend uses self-signed HTTPS
      },
    },
  },
};
