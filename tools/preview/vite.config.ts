import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dev-only preview / web demo: serves the extension's public/ and fakes `wxt/browser`.
export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  publicDir: resolve(__dirname, '../../public'),
  resolve: { alias: { 'wxt/browser': resolve(__dirname, 'fake-browser.ts') } },
  // The demo is a normal web page (no extension host permission), so suggestions go through a proxy.
  define: { 'import.meta.env.VITE_SUGGEST_BASE': JSON.stringify('/gsuggest') },
  server: {
    proxy: { '/gsuggest': { target: 'https://suggestqueries.google.com', changeOrigin: true, rewrite: (p) => p.replace(/^\/gsuggest/, '') } },
  },
  build: {
    outDir: resolve(__dirname, '../../dist-demo'),
    emptyOutDir: true,
    rollupOptions: { input: {
        demo: resolve(__dirname, 'demo.html'),
        newtab: resolve(__dirname, 'newtab.html'),
        bloodbank: resolve(__dirname, 'bloodbank.html'),
        index: resolve(__dirname, 'index.html'),
      } },
  },
});
