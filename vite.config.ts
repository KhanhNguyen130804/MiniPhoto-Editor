import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
  dependencies: { fabric: string };
};

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
    __RENDERER_VERSION__: JSON.stringify(manifest.dependencies.fabric),
  },
  build: {
    target: 'chrome80',
  },
});
