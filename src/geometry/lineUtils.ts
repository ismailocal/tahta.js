import type { Shape, Point, ArrowheadStyle, PointerPayload, ICanvasAPI } from '../core/types';
import { getRayEllipseIntersection } from './GeometryUtils';
import { PluginRegistry } from '../plugins/PluginRegistry';
import { getThemeAdjustedStroke } from '../core/Utils';

export { getThemeAdjustedStroke };
export { getArrowheadDrawable, drawArrowhead } from './ArrowheadUtils';
export { getElbowPath } from './ElbowRouter';

/**
 * Builds the RoughJS options object for a shape, shared across all shape plugins.
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

/** Returns an SVG path data string for a rounded path. */
export function getRoundedPathData(points: Point[], radius: number): string {
  const n = points.length;
  if (n < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < n - 1; i++) {
    const prev = points[i - 1], curr = points[i], next = points[i + 1];
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y), d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const t1 = Math.min(radius / d1, 0.5), t2 = Math.min(radius / d2, 0.5);
    const p1 = { x: curr.x + (prev.x - curr.x) * t1, y: curr.y + (prev.y - curr.y) * t1 };
    const p2 = { x: curr.x + (next.x - curr.x) * t2, y: curr.y + (next.y - curr.y) * t2 };
    path += ` L ${p1.x} ${p1.y} Q ${curr.x} ${curr.y} ${p2.x} ${p2.y}`;
  }
  path += ` L ${points[n - 1].x} ${points[n - 1].y}`;
  return path;
}

/** Draws an open path with quadratic-curve rounding at each interior bend point. */
export function drawRoundedPath(ctx: CanvasRenderingContext2D, points: Point[], radius: number) {
  const n = points.length;
  if (n < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < n - 1; i++) {
    const prev = points[i - 1], curr = points[i], next = points[i + 1];
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y), d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const t1 = Math.min(radius / d1, 0.5), t2 = Math.min(radius / d2, 0.5);
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
    ctx.beginPath(); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y); ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

/** Initializing a drawing action for a generic connector or line. */
export function onDrawInit(payload: PointerPayload, _shapes: Shape[], api: ICanvasAPI): Partial<Shape> {
  return { x: payload.world.x, y: payload.world.y, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: '#64748b', strokeWidth: 1.8 };
}

/** Calculates the endpoints for an arrow, resolving named port positions if bound. */
export function getArrowClippedEndpoints(shape: Shape, allShapes: Shape[]): { p1: Point, p2: Point } {
  const p0 = shape.points?.[0] || { x: 0, y: 0 };
  const pn = shape.points?.[shape.points!.length - 1] || { x: 0, y: 0 };
  let p1 = { x: shape.x + p0.x, y: shape.y + p0.y }, p2 = { x: shape.x + pn.x, y: shape.y + pn.y };

  [ { b: shape.startBinding, set: (p: Point) => { p1 = p; } }, { b: shape.endBinding, set: (p: Point) => { p2 = p; } } ].forEach(config => {
    if (config.b?.portId) {
      const bShape = allShapes.find(s => s.id === config.b!.elementId);
      if (bShape && PluginRegistry.hasPlugin(bShape.type)) {
        const port = PluginRegistry.getPlugin(bShape.type).getConnectionPoints?.(bShape)?.find(p => p.id === config.b!.portId);
        if (port) config.set({ x: port.x, y: port.y });
      }
    }
  });
  return { p1, p2 };
}

/** Find the point at 50% length along a path. */
export function getPathMidpoint(path: Point[]): Point {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];
  
  let totalLength = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalLength += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
  }
  
  const targetLength = totalLength / 2;
  let currentLength = 0;
  
  for (let i = 0; i < path.length - 1; i++) {
    const segmentLength = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    if (currentLength + segmentLength >= targetLength) {
      const t = (targetLength - currentLength) / segmentLength;
      return {
        x: path[i].x + t * (path[i + 1].x - path[i].x),
        y: path[i].y + t * (path[i + 1].y - path[i].y)
      };
    }
    currentLength += segmentLength;
  }
  
  return path[path.length - 1];
}
