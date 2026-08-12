import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        core: resolve(__dirname, 'src/core/index.ts'),
        dom: resolve(__dirname, 'src/dom/index.ts'),
      },
      formats: ['es'],
      cssFileName: 'styles',
    },
    rollupOptions: {
      external: ['yjs'],
      output: { entryFileNames: '[name].js' },
    },
  },
});
