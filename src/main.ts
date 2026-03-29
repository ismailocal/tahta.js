import { mountCanvas } from './index';

// Preload handwriting font so canvas ctx.font renders correctly from the start
document.fonts.load("20px 'Architects Daughter'");

const root = document.getElementById('app');
if (root) {
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  root.appendChild(canvas);

  const { destroy } = mountCanvas(root, canvas);

  // Clean up on hot reload if needed
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      destroy();
    });
  }
}
