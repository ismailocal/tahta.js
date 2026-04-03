import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './', // GitHub Pages'te çalışması için göreceli yollar kullanıyoruz
  build: {
    outDir: 'dist',
  }
});

