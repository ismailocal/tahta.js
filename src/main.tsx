import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Preload handwriting font so canvas ctx.font renders correctly from the start
document.fonts.load("20px 'Architects Daughter'");

const rootElement = document.getElementById('app');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

