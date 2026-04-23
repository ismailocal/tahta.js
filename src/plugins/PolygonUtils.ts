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

/** Converts polygon points to a closed SVG path string with rounded corners. */
export function toRoundedSvgPath(pts: Point[], r: number): string {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const d1 = Math.hypot(prev.x - curr.x, prev.y - curr.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const t1 = d1 > 0 ? Math.min(r / d1, 0.45) : 0;
    const t2 = d2 > 0 ? Math.min(r / d2, 0.45) : 0;
    const p1x = curr.x + (prev.x - curr.x) * t1;
    const p1y = curr.y + (prev.y - curr.y) * t1;
    const p2x = curr.x + (next.x - curr.x) * t2;
    const p2y = curr.y + (next.y - curr.y) * t2;
    d += i === 0 ? `M ${p1x} ${p1y}` : ` L ${p1x} ${p1y}`;
    d += ` Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
  }
  return d + ' Z';
}

/**
 * Shared hit-test for polygon-bounded shapes.
 * Always tests both interior and edge proximity regardless of fill.
 */
export function polygonHitTest(point: Point, polygon: Point[], strokeWidth: number, fill?: string): boolean {
  const t = Math.max(8, (strokeWidth || 1) + 7);
  const nearEdge = isPointNearEdge(point.x, point.y, polygon, t);
  const isTransparent = !fill || fill === 'transparent' || fill === 'none';

  // First check if point is inside the polygon
  const inside = isPointInPolygon(point.x, point.y, polygon);
  if (inside) {
    return true;
  }

  // If not inside, check edge proximity for transparent fills
  if (isTransparent) {
    return nearEdge;
  }

  return false;
}

/**
 * Centralized hit test helper for all shape types.
 * Checks if point is inside the shape's bounds first, then handles transparent fills.
 */
export function genericHitTest(
  point: Point,
  bounds: { x: number; y: number; width: number; height: number },
  isInsideBounds: (point: Point) => boolean,
  strokeWidth: number,
  fill?: string
): boolean {
  const t = Math.max(8, (strokeWidth || 1) + 7);

  // Quick outer bounds check
  if (point.x < bounds.x - t || point.x > bounds.x + bounds.width + t ||
      point.y < bounds.y - t || point.y > bounds.y + bounds.height + t) {
    return false;
  }

  // Check if point is inside the shape using the specific geometry check
  if (isInsideBounds(point)) {
    return true;
  }

  // If not inside, check edge proximity for transparent fills
  const isTransparent = !fill || fill === 'transparent' || fill === 'none';
  if (isTransparent) {
    // For transparent shapes, check if point is near the edge
    // This is a simplified check - specific plugins may override for precise edge detection
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const dx = Math.abs(point.x - cx) - bounds.width / 2;
    const dy = Math.abs(point.y - cy) - bounds.height / 2;

    if (dx <= 0 && dy <= 0) {
      // Point is inside the bounding box; distance to nearest edge must be <= t
      return Math.min(Math.abs(dx), Math.abs(dy)) <= t;
    }
    // Point is outside the bounding box; distance to nearest corner/edge must be <= t
    return Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) <= t;
  }

  return false;
}
