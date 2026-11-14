import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  cacheDir: process.env.VITEST ? 'node_modules/.vite-tests' : 'node_modules/.vite-dev',
  test: { environment: 'node' },
  base: './',
});
