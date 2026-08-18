import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load VITE_* from repo root .env and client/.env
  const envDir = path.resolve(__dirname, '..');
  const env = loadEnv(mode, envDir, '');
  const usePolling = env.VITE_USE_POLLING === 'true';
  // Docker compose sets VITE_PROXY_TARGET=http://server:5000 (process.env).
  // Local dev without Docker uses 127.0.0.1:5000.
  const apiProxyTarget =
    process.env.VITE_PROXY_TARGET || env.VITE_PROXY_TARGET || 'http://127.0.0.1:5000';
  return {
    envDir,
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        react: path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
      force: false,
    },
    server: {
      port: 3000,
      strictPort: true,
      host: true,
      watch: {
        usePolling,
        ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/src/assets/**'],
      },
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
