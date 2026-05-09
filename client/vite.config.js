import { defineConfig, loadEnv } from 'vite'
<<<<<<< HEAD
import react from '@vitejs/plugin-react'
=======
import react from '@vitejs/plugin-react-swc'
import path from 'path'
>>>>>>> origin/feature/seller

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
<<<<<<< HEAD
    server: {
      port: 3000,
=======
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
      force: true,
    },
    server: {
      port: 3000,
      strictPort: true,
>>>>>>> origin/feature/seller
      host: true,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
