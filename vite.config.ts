import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const base = (process.env.BASE_PATH ?? '/lanparty').replace(/\/+$/, '');

export default defineConfig({
  root: 'web',
  base: `${base}/`,
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { [`${base}/api`]: 'http://localhost:3000' },
  },
});
