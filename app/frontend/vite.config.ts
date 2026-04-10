import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

const analyzeBundle = process.env.ANALYZE === 'true';
const withSourceMaps = process.env.SOURCEMAP === 'true';

export default defineConfig({
  plugins: [
    react(),
    ...(analyzeBundle
      ? [
          visualizer({
            filename: 'dist/stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: withSourceMaps,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('react') || id.includes('react-router')) {
            return 'react-vendor';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }
          if (id.includes('leaflet') || id.includes('react-leaflet')) {
            return 'map-vendor';
          }
          if (id.includes('recharts')) {
            return 'charts-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
