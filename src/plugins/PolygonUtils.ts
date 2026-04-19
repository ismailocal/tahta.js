import type { Point } from '../core/types';

/**
 * Shared geometry helpers for polygon-based shape plugins.
 * All functions are pure and stateless.
 */

/** Ray-casting point-in-polygon test. Works for any simple (non-self-intersecting) polygon. */
export function isPointInPolygon(px: number, py: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { x: xi, y: yi } = polygon[i];
    const { x: xj, y: yj } = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Minimum squared distance from point to line segment — avoids sqrt for comparisons. */
function pointSegmentDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
}

/** True if point is within `threshold` pixels of any polygon edge. */
export function isPointNearEdge(px: number, py: number, polygon: Point[], threshold: number): boolean {
  const tSq = threshold * threshold;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (pointSegmentDistSq(px, py, a.x, a.y, b.x, b.y) <= tSq) return true;
  }
  return false;
}

/** Converts polygon points to a closed SVG path string usable by RoughJS rc.path(). */
export function toSvgPath(pts: Point[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
}

/**
 * Shared hit-test for polygon-bounded shapes.
 * Always tests both interior and edge proximity regardless of fill.
 */
export function polygonHitTest(point: Point, polygon: Point[], strokeWidth: number, fill?: string): boolean {
  const t = Math.max(8, (strokeWidth || 1) + 7);
  const nearEdge = isPointNearEdge(point.x, point.y, polygon, t);
  const isTransparent = !fill || fill === 'transparent' || fill === 'none';
  if (!isTransparent) {
    return nearEdge || isPointInPolygon(point.x, point.y, polygon);
  }
  return nearEdge;
}
