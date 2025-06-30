export default {
  server: {
    proxy: {
      // Proxies /api/weather to backend for local dev, adjust port if needed
      '/api/weather': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/weather/, '/weather'),
      }
    }
  }
}
