import type { Shape, Point } from '../core/types';
import { PluginRegistry } from '../plugins/PluginRegistry';

const CLEARANCE = 20;

interface InflatedBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface PathNode {
  i: number;
  j: number;
  dir: number;
  g: number;
  parent: PathNode | null;
}

/** Direction indices: 0=right, 1=down, 2=left, 3=up */
const DIRS = [
  { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }
];

function getShapeBoundsLocal(shape: Shape) {
  if (PluginRegistry.hasPlugin(shape.type)) return PluginRegistry.getPlugin(shape.type).getBounds(shape);
  return { x: shape.x, y: shape.y, width: shape.width || 0, height: shape.height || 0 };
}

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

function dirIndex(d: { x: number; y: number }): number {
  if (d.x > 0) return 0;
  if (d.y > 0) return 1;
  if (d.x < 0) return 2;
  return 3;
}

function inflate(b: { x: number; y: number; width: number; height: number }, pad: number): InflatedBox {
  return { left: b.x - pad, right: b.x + b.width + pad, top: b.y - pad, bottom: b.y + b.height + pad };
}

function midpointBlocked(ax: number, ay: number, bx: number, by: number, boxes: InflatedBox[]): boolean {
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
  const ed1 = b1 ? getExitDir(p1, b1) : (Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y) ? { x: p2.x > p1.x ? 1 : -1, y: 0 } : { x: 0, y: p2.y > p1.y ? 1 : -1 });
  const ed2 = b2 ? getExitDir(p2, b2) : { x: -ed1.x, y: -ed1.y };

  const d1 = { x: p1.x + ed1.x * CLEARANCE, y: p1.y + ed1.y * CLEARANCE };
  const d2 = { x: p2.x + ed2.x * CLEARANCE, y: p2.y + ed2.y * CLEARANCE };

  const raw1 = b1 ? getShapeBoundsLocal(b1) : null;
  const raw2 = b2 ? getShapeBoundsLocal(b2) : null;
  const boxes = [raw1 ? inflate(raw1, CLEARANCE * 0.4) : null, raw2 ? inflate(raw2, CLEARANCE * 0.4) : null].filter((b): b is InflatedBox => b !== null);

  const xSet = new Set([d1.x, d2.x]);
  const ySet = new Set([d1.y, d2.y]);
  [raw1, raw2].forEach(bb => { if (bb) { xSet.add(bb.x - CLEARANCE); xSet.add(bb.x + bb.width + CLEARANCE); ySet.add(bb.y - CLEARANCE); ySet.add(bb.y + bb.height + CLEARANCE); } });

  const xs = Array.from(xSet).sort((a, b) => a - b), ys = Array.from(ySet).sort((a, b) => a - b);
  const xi = new Map(xs.map((v, i) => [v, i])), yi = new Map(ys.map((v, i) => [v, i]));
  const startI = xi.get(d1.x)!, startJ = yi.get(d1.y)!, endI = xi.get(d2.x)!, endJ = yi.get(d2.y)!;

  const gScore = Array.from({ length: xs.length }, () => Array.from({ length: ys.length }, () => new Array(4).fill(1e9)));
  const h = (i: number, j: number) => Math.abs(xs[i] - d2.x) + Math.abs(ys[j] - d2.y);
  const BEND = Math.max((Math.abs(d1.x - d2.x) + Math.abs(d1.y - d2.y))**2, 1);

  const open: PathNode[] = [{ i: startI, j: startJ, dir: dirIndex(ed1), g: 0, parent: null }];
  gScore[startI][startJ][dirIndex(ed1)] = 0;

  let found: PathNode | null = null;
  while (open.length > 0) {
    const cur = open.shift()!;
    if (cur.g > gScore[cur.i][cur.j][cur.dir]) continue;
    if (cur.i === endI && cur.j === endJ) { found = cur; break; }
    for (let di = 0; di < 4; di++) {
      const { dx, dy } = DIRS[di];
      const ni = cur.i + dx, nj = cur.j + dy;
      if (ni < 0 || ni >= xs.length || nj < 0 || nj >= ys.length || di === (cur.dir + 2) % 4) continue;
      if (midpointBlocked(xs[cur.i], ys[cur.j], xs[ni], ys[nj], boxes)) continue;
      const ng = cur.g + Math.abs(xs[ni] - xs[cur.i]) + Math.abs(ys[nj] - ys[cur.j]) + (di !== cur.dir ? BEND : 0);
      if (ng < gScore[ni][nj][di]) {
        gScore[ni][nj][di] = ng;
        const s = { i: ni, j: nj, dir: di, g: ng, parent: cur };
        const f = ng + h(ni, nj);
        
        // Binary search insertion to maintain priority queue
        let lo = 0, hi = open.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (open[m].g + h(open[m].i, open[m].j) <= f) {
            lo = m + 1;
          } else {
            hi = m;
          }
        }
        open.splice(lo, 0, s);
      }
    }
  }

  if (!found) return [p1, d1, d2, p2];
  const res: Point[] = [];
  let curr: PathNode | null = found;
  while (curr) { res.push({ x: xs[curr.i], y: ys[curr.j] }); curr = curr.parent; }
  return collapseCollinear([p1, ...res.reverse(), p2]);
}
