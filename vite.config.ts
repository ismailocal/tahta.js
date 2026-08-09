import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  build: {
    assetsInlineLimit: 0,
    outDir: 'dist',
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        core: resolve(__dirname, 'src/core/index.ts'),
        dom: resolve(__dirname, 'src/dom/index.ts'),
        react: resolve(__dirname, 'src/react/index.ts'),
        dsl: resolve(__dirname, 'src/dsl/index.ts'),
      },
      formats: ['es'],
      cssFileName: 'styles',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
