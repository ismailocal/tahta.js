import type { Shape, Point, ArrowheadStyle } from './types';
import { getRayEllipseIntersection } from './GeometryUtils';

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
      const cx = bShape.x + (bShape.width||0) / 2;
      const cy = bShape.y + (bShape.height||0) / 2;
      const rx = Math.abs(bShape.width||0) / 2;
      const ry = Math.abs(bShape.height||0) / 2;
      p1 = getClosestPort(cx, cy, rx, ry, p2, bShape.type);
    }
  }

  if (shape.endBinding) {
    const bShape = allShapes.find(s => s.id === shape.endBinding!.elementId);
    if (bShape) {
      const cx = bShape.x + (bShape.width||0) / 2;
      const cy = bShape.y + (bShape.height||0) / 2;
      const rx = Math.abs(bShape.width||0) / 2;
      const ry = Math.abs(bShape.height||0) / 2;
      p2 = getClosestPort(cx, cy, rx, ry, p1, bShape.type);
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

export function getElbowPath(p1: Point, p2: Point, b1?: Shape, b2?: Shape, allShapes?: Shape[], getBounds?: (s: Shape) => { x: number, y: number, width: number, height: number }): Point[] {
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  const fallback = dx > dy 
    ? [p1, { x: (p1.x + p2.x) / 2, y: p1.y }, { x: (p1.x + p2.x) / 2, y: p2.y }, p2]
    : [p1, { x: p1.x, y: (p1.y + p2.y) / 2 }, { x: p2.x, y: (p1.y + p2.y) / 2 }, p2];

  if (!allShapes || allShapes.length === 0 || !getBounds) return fallback;

  const ignoreIds = new Set<string>();
  if (b1) ignoreIds.add(b1.id);
  if (b2) ignoreIds.add(b2.id);

  const obstacles = allShapes
    .filter(s => s.type !== 'line' && s.type !== 'arrow' && s.type !== 'freehand' && !ignoreIds.has(s.id))
    .map(s => {
      const b = getBounds(s);
      const pad = 15;
      return { 
        trueMinX: b.x, trueMinY: b.y, trueMaxX: b.x + b.width, trueMaxY: b.y + b.height,
        minX: b.x - pad, minY: b.y - pad, maxX: b.x + b.width + pad, maxY: b.y + b.height + pad 
      };
    });

  if (obstacles.length === 0) return fallback;

  const xs = new Set<number>([p1.x, p2.x]);
  const ys = new Set<number>([p1.y, p2.y]);
  obstacles.forEach(o => { xs.add(o.minX); xs.add(o.maxX); ys.add(o.minY); ys.add(o.maxY); });
  if (b1) { const b = getBounds(b1); xs.add(b.x - 20); xs.add(b.x + b.width + 20); ys.add(b.y - 20); ys.add(b.y + b.height + 20); }
  if (b2) { const b = getBounds(b2); xs.add(b.x - 20); xs.add(b.x + b.width + 20); ys.add(b.y - 20); ys.add(b.y + b.height + 20); }

  const xArr = Array.from(xs).sort((a, b) => a - b);
  const yArr = Array.from(ys).sort((a, b) => a - b);
  const xMap = new Map(xArr.map((v, i) => [v, i]));
  const yMap = new Map(yArr.map((v, i) => [v, i]));

  const startNode = { x: xMap.get(p1.x)!, y: yMap.get(p1.y)! };
  const endNode = { x: xMap.get(p2.x)!, y: yMap.get(p2.y)! };

  const isInside = (x: number, y: number) => {
    if (x === p1.x && y === p1.y) return false;
    if (x === p2.x && y === p2.y) return false;
    return obstacles.some(o => x > o.trueMinX && x < o.trueMaxX && y > o.trueMinY && y < o.trueMaxY);
  };

  const gridWalkable = Array.from({ length: xArr.length }, (_, i) => 
    Array.from({ length: yArr.length }, (_, j) => !isInside(xArr[i], yArr[j]))
  );

  const openSet = new Set<string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, { x: number, y: number }>();

  const startKey = `${startNode.x},${startNode.y}`;
  openSet.add(startKey);
  gScore.set(startKey, 0);

  const h = (nx: number, ny: number) => Math.abs(xArr[nx] - xArr[endNode.x]) + Math.abs(yArr[ny] - yArr[endNode.y]);
  fScore.set(startKey, h(startNode.x, startNode.y));

  const MOVES = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const getDir = (from: string | undefined, nx: number, ny: number) => {
    if (!from) return null;
    const [px, py] = from.split(',').map(Number);
    if (nx > px) return 'R'; if (nx < px) return 'L';
    if (ny > py) return 'D'; if (ny < py) return 'U';
    return null;
  };

  let maxIterations = 2000;
  while (openSet.size > 0 && maxIterations-- > 0) {
    let currKey = ''; let minVal = Infinity;
    for (const key of openSet) {
      if ((fScore.get(key) || Infinity) < minVal) { minVal = fScore.get(key)!; currKey = key; }
    }

    if (currKey === `${endNode.x},${endNode.y}`) {
      const path: Point[] = [];
      let current: string | undefined = currKey;
      while (current) {
        const [cx, cy] = current.split(',').map(Number);
        path.unshift({ x: xArr[cx], y: yArr[cy] });
        const p = cameFrom.get(current);
        current = p ? `${p.x},${p.y}` : undefined;
      }
      const cleaned: Point[] = [path[0]];
      for (let i = 1; i < path.length - 1; i++) {
        if ((cleaned[cleaned.length-1].x === path[i].x && path[i].x === path[i+1].x) || (cleaned[cleaned.length-1].y === path[i].y && path[i].y === path[i+1].y)) continue;
        cleaned.push(path[i]);
      }
      cleaned.push(path[path.length - 1]);
      return cleaned;
    }

    openSet.delete(currKey);
    const [cx, cy] = currKey.split(',').map(Number);
    const prevKey = cameFrom.has(currKey) ? `${cameFrom.get(currKey)!.x},${cameFrom.get(currKey)!.y}` : undefined;
    const currentDir = getDir(prevKey, cx, cy);

    for (const [dx, dy] of MOVES) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= xArr.length || ny >= yArr.length || !gridWalkable[nx][ny]) continue;
      const midX = (xArr[cx] + xArr[nx]) / 2, midY = (yArr[cy] + yArr[ny]) / 2;
      if (obstacles.some(o => midX > o.trueMinX && midX < o.trueMaxX && midY > o.trueMinY && midY < o.trueMaxY)) continue;

      const nKey = `${nx},${ny}`;
      const turnPenalty = (currentDir && currentDir !== getDir(currKey, nx, ny)) ? 20 : 0;
      const padPenalty = obstacles.some(o => midX > o.minX && midX < o.maxX && midY > o.minY && midY < o.maxY) ? 500 : 0;
      const tentativeG = (gScore.get(currKey) || 0) + Math.abs(xArr[nx] - xArr[cx]) + Math.abs(yArr[ny] - yArr[cy]) + turnPenalty + padPenalty;

      if (!openSet.has(nKey) || tentativeG < (gScore.get(nKey) || Infinity)) {
        cameFrom.set(nKey, { x: cx, y: cy });
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + h(nx, ny));
        openSet.add(nKey);
      }
    }
  }
  return fallback;
}

export function drawArrowhead(rc: any, ctx: CanvasRenderingContext2D, point: Point, angle: number, style: ArrowheadStyle, options: any) {
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
    rc.ellipse(cx, cy, size, size, { ...options, fill: '#1e1e24', fillStyle: 'solid' });
  } else if (style === 'diamond') {
    const cx = point.x - (size/2) * Math.cos(angle), cy = point.y - (size/2) * Math.sin(angle), hw = size / 2.5;
    const p1 = point, p2 = { x: cx - hw * Math.sin(angle), y: cy + hw * Math.cos(angle) }, p3 = { x: point.x - size * Math.cos(angle), y: point.y - size * Math.sin(angle) }, p4 = { x: cx + hw * Math.sin(angle), y: cy - hw * Math.cos(angle) };
    rc.polygon([[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y], [p4.x, p4.y]], { ...options, fill: '#1e1e24', fillStyle: 'solid' });
  } else if (style === 'bar') {
    const hw = size / 2;
    const p1 = { x: point.x - hw * Math.sin(angle), y: point.y + hw * Math.cos(angle) }, p2 = { x: point.x + hw * Math.sin(angle), y: point.y - hw * Math.cos(angle) };
    rc.line(p1.x, p1.y, p2.x, p2.y, options);
  }
}
