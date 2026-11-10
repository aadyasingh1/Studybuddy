import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// localhost counts as a "secure context", so microphone + clipboard APIs work in dev.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
});
