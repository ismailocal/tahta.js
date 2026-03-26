import type { Point } from './types';

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(point, a);
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));
  return distance(point, { x: a.x + tClamped * dx, y: a.y + tClamped * dy });
}

export function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const num = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
  const den = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (den === 0) return null;
  const uA = num / den;
  const numB = (p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x);
  const uB = numB / den;
  
  if (uA >= 0 && uB >= 0 && uB <= 1) {
    return { x: p1.x + uA * (p2.x - p1.x), y: p1.y + uA * (p2.y - p1.y) };
  }
  return null;
}

export function getRayBoxIntersection(p1: Point, p2: Point, rect: { x: number, y: number, w: number, h: number }): Point {
  const tl = { x: rect.x, y: rect.y };
  const tr = { x: rect.x + rect.w, y: rect.y };
  const bl = { x: rect.x, y: rect.y + rect.h };
  const br = { x: rect.x + rect.w, y: rect.y + rect.h };
  
  const pts = [
    lineIntersection(p1, p2, tl, tr),
    lineIntersection(p1, p2, tr, br),
    lineIntersection(p1, p2, br, bl),
    lineIntersection(p1, p2, bl, tl)
  ].filter((p): p is Point => p !== null);

  if (pts.length === 0) return p2; // Fallback
  
  let closest = pts[0];
  let minD = distance(closest, p1);
  for(let i=1; i<pts.length; i++) {
    const d = distance(pts[i], p1);
    if (d < minD) { minD = d; closest = pts[i]; }
  }
  return closest;
}

export function getRayEllipseIntersection(p1: Point, p2: Point, cx: number, cy: number, rx: number, ry: number): Point {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) return p2;

  const x1 = p1.x - cx;
  const y1 = p1.y - cy;
  
  const a = (dx*dx) / (rx*rx) + (dy*dy) / (ry*ry);
  const b = 2 * ((x1*dx) / (rx*rx) + (y1*dy) / (ry*ry));
  const c = (x1*x1) / (rx*rx) + (y1*y1) / (ry*ry) - 1;
  const det = b*b - 4*a*c;
  if (det < 0) return p2;
  
  const t1 = (-b + Math.sqrt(det)) / (2*a);
  const t2 = (-b - Math.sqrt(det)) / (2*a);
  
  const validT = [t1, t2].filter(t => t >= 0);
  if (validT.length === 0) return p2;
  
  const t = Math.min(...validT); // Closest to p1
  return { x: p1.x + t * dx, y: p1.y + t * dy };
}
