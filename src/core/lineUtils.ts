import type { Shape, Point, ArrowheadStyle, PointerPayload, ICanvasAPI } from './types';
import { getRayEllipseIntersection } from './GeometryUtils';
import { PluginRegistry } from '../plugins/PluginRegistry';
import { getThemeAdjustedStroke } from './Utils';
export { getThemeAdjustedStroke };

/**
 * Builds the RoughJS options object for a shape, shared across all shape plugins.
 * Includes fill/fillStyle (undefined for connector shapes, which is safely ignored by RoughJS).
 */
export function buildRoughOptions(shape: Shape, theme: 'light' | 'dark'): Record<string, unknown> {
  const options: Record<string, unknown> = {
    stroke: getThemeAdjustedStroke(shape.stroke, theme),
    fill: shape.fill && shape.fill !== 'transparent' ? shape.fill : undefined,
    strokeWidth: shape.strokeWidth || 1.8,
    roughness: shape.roughness ?? 1,
    fillStyle: shape.fillStyle || 'none',
    fillWeight: 1,
    hachureGap: 4,
    seed: shape.seed ?? 1,
  };
  if (shape.strokeStyle === 'dashed') options.strokeLineDash = [8, 8];
  else if (shape.strokeStyle === 'dotted') options.strokeLineDash = [2, 6];
  return options;
}

/** Draws an open path with quadratic-curve rounding at each interior bend point. */
export function drawRoundedPath(ctx: CanvasRenderingContext2D, points: Point[], radius: number) {
  const n = points.length;
  if (n < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < n - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const t1 = Math.min(radius / d1, 0.5);
    const t2 = Math.min(radius / d2, 0.5);
    ctx.lineTo(curr.x + (prev.x - curr.x) * t1, curr.y + (prev.y - curr.y) * t1);
    ctx.quadraticCurveTo(curr.x, curr.y, curr.x + (next.x - curr.x) * t2, curr.y + (next.y - curr.y) * t2);
  }
  ctx.lineTo(points[n - 1].x, points[n - 1].y);
}

/** Draws small diamond-shaped handle indicators at line/arrow endpoints. */
export function renderEndpointHandles(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, stroke?: string, theme: 'light' | 'dark' = 'dark') {
  const color = getThemeAdjustedStroke(stroke, theme);
  const r = 5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = theme === 'light' ? '#ffffff' : '#1e1e24';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  [p1, p2].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(p.x,     p.y - r);
    ctx.lineTo(p.x + r, p.y);
    ctx.lineTo(p.x,     p.y + r);
    ctx.lineTo(p.x - r, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

export function onDrawInit(payload: PointerPayload, _shapes: Shape[], api: ICanvasAPI): Partial<Shape> {
  return {
    x: payload.world.x,
    y: payload.world.y,
    points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    stroke: '#64748b',
    strokeWidth: 1.8
  };
}

export function getArrowClippedEndpoints(shape: Shape, allShapes: Shape[]): { p1: Point, p2: Point } {
  const p0 = shape.points?.[0] || { x: 0, y: 0 };
  const pn = shape.points?.[shape.points!.length - 1] || { x: 0, y: 0 };
  let p1 = { x: shape.x + p0.x, y: shape.y + p0.y };
  let p2 = { x: shape.x + pn.x, y: shape.y + pn.y };

  function getClosestPort(cx: number, cy: number, rx: number, ry: number, target: Point, type: string) {
    if (type === 'ellipse') {
      return getRayEllipseIntersection({ x: cx, y: cy }, target, cx, cy, rx + 4, ry + 4);
    }
    const ports = [
      { x: cx, y: cy - ry - 4 }, // Top
      { x: cx + rx + 4, y: cy }, // Right
      { x: cx, y: cy + ry + 4 }, // Bottom
      { x: cx - rx - 4, y: cy }  // Left
    ];
    let closest = ports[0];
    let minDist = Infinity;
    for (const p of ports) {
      const d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d < minDist) { minDist = d; closest = p; }
    }
    return closest;
  }

  if (shape.startBinding) {
    const bShape = allShapes.find(s => s.id === shape.startBinding!.elementId);
    if (bShape) {
      const portId = shape.startBinding!.portId;
      if (portId && PluginRegistry.hasPlugin(bShape.type)) {
        const plugin = PluginRegistry.getPlugin(bShape.type);
        const port = plugin.getConnectionPoints?.(bShape)?.find(p => p.id === portId);
        if (port) { p1 = { x: port.x, y: port.y }; }
      } else {
        const cx = bShape.x + (bShape.width||0) / 2;
        const cy = bShape.y + (bShape.height||0) / 2;
        const rx = Math.abs(bShape.width||0) / 2;
        const ry = Math.abs(bShape.height||0) / 2;
        p1 = getClosestPort(cx, cy, rx, ry, p2, bShape.type);
      }
    }
  }

  if (shape.endBinding) {
    const bShape = allShapes.find(s => s.id === shape.endBinding!.elementId);
    if (bShape) {
      const portId = shape.endBinding!.portId;
      if (portId && PluginRegistry.hasPlugin(bShape.type)) {
        const plugin = PluginRegistry.getPlugin(bShape.type);
        const port = plugin.getConnectionPoints?.(bShape)?.find(p => p.id === portId);
        if (port) { p2 = { x: port.x, y: port.y }; }
      } else {
        const cx = bShape.x + (bShape.width||0) / 2;
        const cy = bShape.y + (bShape.height||0) / 2;
        const rx = Math.abs(bShape.width||0) / 2;
        const ry = Math.abs(bShape.height||0) / 2;
        p2 = getClosestPort(cx, cy, rx, ry, p1, bShape.type);
      }
    }
  }

  return { p1, p2 };
}

export function getPathMidpoint(path: Point[]): Point {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];
  
  let totalLen = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalLen += Math.hypot(path[i+1].x - path[i].x, path[i+1].y - path[i].y);
  }
  
  let targetLen = totalLen / 2;
  let currLen = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = Math.hypot(path[i+1].x - path[i].x, path[i+1].y - path[i].y);
    if (currLen + d >= targetLen) {
      const remaining = targetLen - currLen;
      const ratio = remaining / d;
      return {
        x: path[i].x + (path[i+1].x - path[i].x) * ratio,
        y: path[i].y + (path[i+1].y - path[i].y) * ratio
      };
    }
    currLen += d;
  }
  return path[path.length - 1];
}

export function clearElbowCache() { /* no-op */ }
export function setSkipObstacles(_val: boolean) { /* no-op */ }

function getShapeBoundsLocal(shape: Shape) {
  if (PluginRegistry.hasPlugin(shape.type)) return PluginRegistry.getPlugin(shape.type).getBounds(shape);
  return { x: shape.x, y: shape.y, width: shape.width || 0, height: shape.height || 0 };
}

/** Returns the outward normal direction at point p on the boundary of shape. */
function getExitDir(p: Point, shape: Shape): { x: number; y: number } {
  const b = getShapeBoundsLocal(shape);
  const dL = Math.abs(p.x - b.x);
  const dR = Math.abs(p.x - (b.x + b.width));
  const dT = Math.abs(p.y - b.y);
  const dB = Math.abs(p.y - (b.y + b.height));
  const min = Math.min(dL, dR, dT, dB);
  if (min === dL) return { x: -1, y: 0 };
  if (min === dR) return { x: 1, y: 0 };
  if (min === dT) return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

const CLEARANCE = 20;

// Direction indices: 0=right, 1=down, 2=left, 3=up
const DIRS = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }];

function dirIndex(d: { x: number; y: number }): number {
  if (d.x > 0) return 0;
  if (d.y > 0) return 1;
  if (d.x < 0) return 2;
  return 3;
}

function inflate(b: { x: number; y: number; width: number; height: number }, pad: number) {
  return { left: b.x - pad, right: b.x + b.width + pad, top: b.y - pad, bottom: b.y + b.height + pad };
}

function midpointBlocked(
  ax: number, ay: number, bx: number, by: number,
  boxes: Array<{ left: number; right: number; top: number; bottom: number }>
): boolean {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  return boxes.some(bb => mx > bb.left && mx < bb.right && my > bb.top && my < bb.bottom);
}

function collapseCollinear(pts: Point[]): Point[] {
  if (pts.length <= 2) return pts;
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1], cur = pts[i], next = pts[i + 1];
    const collinear = (Math.abs(prev.x - cur.x) < 0.5 && Math.abs(cur.x - next.x) < 0.5) ||
                      (Math.abs(prev.y - cur.y) < 0.5 && Math.abs(cur.y - next.y) < 0.5);
    if (!collinear) out.push(cur);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function getElbowPath(p1: Point, p2: Point, b1?: Shape, b2?: Shape): Point[] {
  const ed1 = b1 ? getExitDir(p1, b1)
    : (Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y) ? { x: p2.x > p1.x ? 1 : -1, y: 0 } : { x: 0, y: p2.y > p1.y ? 1 : -1 });
  const ed2 = b2 ? getExitDir(p2, b2) : { x: -ed1.x, y: -ed1.y };

  // Dongle = exit stub outside each shape
  const d1 = { x: p1.x + ed1.x * CLEARANCE, y: p1.y + ed1.y * CLEARANCE };
  const d2 = { x: p2.x + ed2.x * CLEARANCE, y: p2.y + ed2.y * CLEARANCE };

  // Inflated bounding boxes used to block paths through shapes
  const raw1 = b1 ? getShapeBoundsLocal(b1) : null;
  const raw2 = b2 ? getShapeBoundsLocal(b2) : null;
  const box1 = raw1 ? inflate(raw1, CLEARANCE * 0.4) : null;
  const box2 = raw2 ? inflate(raw2, CLEARANCE * 0.4) : null;
  const boxes = [box1, box2].filter(Boolean) as Array<{ left: number; right: number; top: number; bottom: number }>;

  // Build sparse grid: collect "interesting" X and Y coordinates
  const xSet = new Set<number>();
  const ySet = new Set<number>();

  xSet.add(d1.x); ySet.add(d1.y);
  xSet.add(d2.x); ySet.add(d2.y);

  for (const bb of [raw1, raw2]) {
    if (!bb) continue;
    const pad = CLEARANCE;
    xSet.add(bb.x - pad); xSet.add(bb.x + bb.width + pad);
    ySet.add(bb.y - pad); ySet.add(bb.y + bb.height + pad);
  }

  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => a - b);
  const W = xs.length, H = ys.length;

  const xi = new Map(xs.map((v, i) => [v, i]));
  const yi = new Map(ys.map((v, i) => [v, i]));

  const startI = xi.get(d1.x)!, startJ = yi.get(d1.y)!;
  const endI   = xi.get(d2.x)!, endJ   = yi.get(d2.y)!;

  const startDir = dirIndex(ed1);

  // A* state: (gridI, gridJ, direction) → best gScore
  const INF = 1e9;
  // gScore[i][j][dir], parent encoded
  type State = { i: number; j: number; dir: number; g: number; parent: State | null };

  const gScore: number[][][] = Array.from({ length: W }, () =>
    Array.from({ length: H }, () => new Array(4).fill(INF))
  );

  // Manhattan distance heuristic
  const h = (i: number, j: number) => Math.abs(xs[i] - d2.x) + Math.abs(ys[j] - d2.y);

  // Turn penalty: proportional to total distance (same approach as Tahta)
  const totalDist = Math.abs(d1.x - d2.x) + Math.abs(d1.y - d2.y);
  const BEND = Math.max(totalDist * totalDist, 1);

  // Min-heap via simple sorted array (grid is tiny, ≤ ~10×10×4 = 400 states)
  const open: State[] = [];
  const pushOpen = (s: State) => {
    const f = s.g + h(s.i, s.j);
    let lo = 0, hi = open.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if ((open[m].g + h(open[m].i, open[m].j)) <= f) lo = m + 1; else hi = m; }
    open.splice(lo, 0, s);
  };

  const start: State = { i: startI, j: startJ, dir: startDir, g: 0, parent: null };
  gScore[startI][startJ][startDir] = 0;
  pushOpen(start);

  let found: State | null = null;

  while (open.length > 0) {
    const cur = open.shift()!;
    if (cur.g > gScore[cur.i][cur.j][cur.dir]) continue; // stale

    if (cur.i === endI && cur.j === endJ) { found = cur; break; }

    for (let di = 0; di < 4; di++) {
      const { dx, dy } = DIRS[di];
      const ni = cur.i + dx, nj = cur.j + dy;
      if (ni < 0 || ni >= W || nj < 0 || nj >= H) continue;
      if (di === ((cur.dir + 2) % 4)) continue; // no reversing

      // Block segment if midpoint falls inside any inflated shape box
      if (midpointBlocked(xs[cur.i], ys[cur.j], xs[ni], ys[nj], boxes)) continue;

      const segLen = Math.abs(xs[ni] - xs[cur.i]) + Math.abs(ys[nj] - ys[cur.j]);
      const turnCost = di !== cur.dir ? BEND : 0;
      const ng = cur.g + segLen + turnCost;

      if (ng < gScore[ni][nj][di]) {
        gScore[ni][nj][di] = ng;
        pushOpen({ i: ni, j: nj, dir: di, g: ng, parent: cur });
      }
    }
  }

  if (!found) return [p1, d1, d2, p2]; // fallback

  // Reconstruct path from A* result
  const mid: Point[] = [];
  let cur: State | null = found;
  while (cur) {
    mid.push({ x: xs[cur.i], y: ys[cur.j] });
    cur = cur.parent;
  }
  mid.reverse();

  return collapseCollinear([p1, ...mid, p2]);
}

export function drawArrowhead(rc: any, ctx: CanvasRenderingContext2D, point: Point, angle: number, style: ArrowheadStyle, options: any, theme: 'light' | 'dark' = 'dark') {
  if (style === 'none') return;
  const size = Math.max(12, Math.min(30, (options.strokeWidth || 1) * 6 + 8));

  if (style === 'arrow') {
    const p1 = { x: point.x - size * Math.cos(angle - Math.PI / 6), y: point.y - size * Math.sin(angle - Math.PI / 6) };
    const p2 = { x: point.x - size * Math.cos(angle + Math.PI / 6), y: point.y - size * Math.sin(angle + Math.PI / 6) };
    rc.line(point.x, point.y, p1.x, p1.y, options);
    rc.line(point.x, point.y, p2.x, p2.y, options);
  } else if (style === 'triangle') {
    const p1 = { x: point.x - size * Math.cos(angle - Math.PI / 6), y: point.y - size * Math.sin(angle - Math.PI / 6) };
    const p2 = { x: point.x - size * Math.cos(angle + Math.PI / 6), y: point.y - size * Math.sin(angle + Math.PI / 6) };
    rc.polygon([[point.x, point.y], [p1.x, p1.y], [p2.x, p2.y]], { ...options, fill: options.stroke, fillStyle: 'solid' });
  } else if (style === 'circle') {
    const cx = point.x - (size/2) * Math.cos(angle), cy = point.y - (size/2) * Math.sin(angle);
    rc.ellipse(cx, cy, size, size, { ...options, fill: theme === 'light' ? '#ffffff' : '#1e1e24', fillStyle: 'solid' });
  } else if (style === 'diamond') {
    const cx = point.x - (size/2) * Math.cos(angle), cy = point.y - (size/2) * Math.sin(angle), hw = size / 2.5;
    const p1 = point, p2 = { x: cx - hw * Math.sin(angle), y: cy + hw * Math.cos(angle) }, p3 = { x: point.x - size * Math.cos(angle), y: point.y - size * Math.sin(angle) }, p4 = { x: cx + hw * Math.sin(angle), y: cy - hw * Math.cos(angle) };
    rc.polygon([[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y], [p4.x, p4.y]], { ...options, fill: theme === 'light' ? '#ffffff' : '#1e1e24', fillStyle: 'solid' });
  } else if (style === 'bar') {
    const hw = size / 2;
    const p1 = { x: point.x - hw * Math.sin(angle), y: point.y + hw * Math.cos(angle) }, p2 = { x: point.x + hw * Math.sin(angle), y: point.y - hw * Math.cos(angle) };
    rc.line(p1.x, p1.y, p2.x, p2.y, options);
  }
}
