import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
      '/user': 'http://127.0.0.1:8000',
      '/employee': 'http://127.0.0.1:8000',
      '/overtime': 'http://127.0.0.1:8000',
      '/hrai': 'http://127.0.0.1:8000',
      '/schedule': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
    },
  },
});
