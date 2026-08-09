import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // GitHub Pages'te çalışması için göreceli yollar kullanıyoruz
  build: {
    outDir: 'dist',
  }
});
