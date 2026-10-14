import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Base path: '/' for dev, Vercel, & custom domain, '/gcc-connect/' for GitHub Pages
  base: process.env.VITE_BASE_PATH || '/',

  resolve: {
    alias: {
      '@gcc-connect/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },

  server: {
    port: 3000,
    // Proxy all /api calls to local backend during development
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    // Generate source maps only in non-production builds
    sourcemap: process.env.NODE_ENV !== 'production',
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
          qrcode: ['qrcode'],
        },
      },
    },
    // Fail if bundle exceeds these thresholds
    chunkSizeWarningLimit: 800,
  },

  // Ensure .env files are loaded but secrets never exposed
  // Only VITE_* prefixed vars are injected into the browser bundle
  envPrefix: 'VITE_',
});
