import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { noRemoteDraco } from '../build/noRemoteDraco';

const root = resolve(__dirname, '..');

export default defineConfig({
  root: 'demo',
  base: './', // relative: works at /<repo>/ and at /
  publicDir: '../public', // copies public/models to demo/dist/models
  plugins: [react(), noRemoteDraco],
  resolve: { alias: { 'wxt/browser': resolve(root, 'lib/fakeBrowser.ts') } },
  server: { fs: { allow: [root] } },
  build: { outDir: 'dist', emptyOutDir: true },
});
