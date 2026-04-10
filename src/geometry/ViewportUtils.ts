import type { Shape, Point } from '../core/types';
import { UI_CONSTANTS } from '../core/constants';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Calculates a viewport (x, y, zoom) that centers a given set of shapes within a container.
 * 
 * @param shapes - The shapes to center.
 * @param width - The width of the container (canvas).
 * @param height - The height of the container (canvas).
 * @returns {Viewport} The calculated viewport.
 */
export function calculateCenteredViewport(
  shapes: Shape[],
  width: number,
  height: number
): Viewport {
  if (!shapes || shapes.length === 0 || width <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

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

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const contentW = (maxX - minX) + UI_CONSTANTS.VIEWPORT_PADDING * 2;
  const contentH = (maxY - minY) + UI_CONSTANTS.VIEWPORT_PADDING * 2;

  const fitZoom = Math.min(width / contentW, height / contentH);
  // Clamp to interactive zoom limits
  const zoom = Math.max(Math.min(fitZoom, UI_CONSTANTS.FIT_ZOOM_MAX), UI_CONSTANTS.FIT_ZOOM_MIN);

  return {
    x: (width / 2) - (cx * zoom),
    y: (height / 2) - (cy * zoom),
    zoom,
  };
}
