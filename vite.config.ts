import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // Keep JS, artwork and fonts relative to the deployed project directory.
  base: './',
  server: { port: 5173, strictPort: true },
});
