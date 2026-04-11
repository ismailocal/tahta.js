import type { Shape, Point } from '../core/types';

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

const VIEWPORT_PADDING = 120;

export function calculateCenteredViewport(
  shapes: Shape[],
  width: number,
  height: number
): Viewport {
  if (!shapes.length || width <= 0) return { x: 0, y: 0, zoom: 1 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  shapes.forEach((s) => {
    const x = s.x || 0;
    const y = s.y || 0;
    const w = s.width || 0;
    const h = s.height || 0;
    if (s.points && s.points.length > 0) {
      s.points.forEach((p: Point) => {
        minX = Math.min(minX, x + p.x);
        minY = Math.min(minY, y + p.y);
        maxX = Math.max(maxX, x + p.x);
        maxY = Math.max(maxY, y + p.y);
      });
    } else {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
  });

  if (minX === Infinity) return { x: 0, y: 0, zoom: 1 };

  const contentW = (maxX - minX) + VIEWPORT_PADDING * 2;
  const contentH = (maxY - minY) + VIEWPORT_PADDING * 2;
  const fitZoom = Math.min(width / contentW, height / contentH);
  const zoom = Math.max(Math.min(fitZoom, 1.0), 0.2);

  return {
    x: (width / 2) - ((minX + maxX) / 2 * zoom),
    y: (height / 2) - ((minY + maxY) / 2 * zoom),
    zoom,
  };
}

export function animateViewport(
  setViewport: (vp: Viewport) => void,
  start: Viewport,
  end: Viewport,
  duration = 600
) {
  const startTime = performance.now();

  const animate = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);

    const current = {
      x: start.x + (end.x - start.x) * ease,
      y: start.y + (end.y - start.y) * ease,
      zoom: start.zoom + (end.zoom - start.zoom) * ease,
    };

    setViewport(current);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}
