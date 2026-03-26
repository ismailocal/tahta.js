import { mountCanvas } from './index';

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
