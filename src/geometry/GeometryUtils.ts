import type { Point } from '../core/types';

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(point, a);
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));
  return distance(point, { x: a.x + tClamped * dx, y: a.y + tClamped * dy });
}

export function pointToQuadraticBezierDistance(point: Point, p1: Point, cp: Point, p2: Point, steps: number = 20): number {
  let minDistance = Infinity;
  let prevPoint = p1;
  
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const currentPoint = {
      x: mt * mt * p1.x + 2 * mt * t * cp.x + t * t * p2.x,
      y: mt * mt * p1.y + 2 * mt * t * cp.y + t * t * p2.y
    };
    const dist = pointToSegmentDistance(point, prevPoint, currentPoint);
    if (dist < minDistance) {
      minDistance = dist;
    }
    prevPoint = currentPoint;
  }
  
  return minDistance;
}
