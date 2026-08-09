import { mountCanvas } from './index';
import './styles.css';

// Preload handwriting font
document.fonts.load("20px 'Architects Daughter', cursive");

function init() {
  const rootElement = document.getElementById('app');
  if (!rootElement) return;

  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  canvas.style.display = 'block';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  
  // High DPI support handling (usually handled in Renderer/renderScene, but canvas size must be set)
  // mountCanvas handles the listeners and store
  rootElement.appendChild(canvas);

  const { destroy } = mountCanvas(rootElement, canvas);

  // Optional: Handle HMR cleanup if needed
  if ((import.meta as any).hot) {
    (import.meta as any).hot.dispose(() => {
      destroy();
    });
  }
}

// Ensure fonts are ready and DOM is loaded
window.addEventListener('DOMContentLoaded', init);
