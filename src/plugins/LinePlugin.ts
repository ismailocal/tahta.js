import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point, ICanvasAPI } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { pointToSegmentDistance, getTopShapeAtPoint, pointToQuadraticBezierDistance } from '../geometry/Geometry';
import { getPathMidpoint, renderEndpointHandles, buildRoughOptions, getElbowPath, drawRoundedPath, getRoundedPathData } from '../geometry/lineUtils';
import { PluginRegistry } from './PluginRegistry';
import { UI_CONSTANTS } from '../core/constants';
import { ConnectorMixin } from './ConnectorMixin';

// Re-export for backward compatibility
export const findNearestPort = ConnectorMixin.findNearestPort;
export const getBindingPoint = ConnectorMixin.getBindingPoint;

/** Control point for a quadratic bezier curved line — offset perpendicular to the midpoint. */
function getCurvedControlPoint(p1: Point, p2: Point): Point {
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const offset = len * 0.35;
  return { x: mx - (dy / len) * offset, y: my + (dx / len) * offset };
}

/** Use elbow routing only when explicitly selected. */
function useSmartRouting(shape: Shape): boolean {
  return shape.edgeStyle === 'elbow';
}

export class LinePlugin implements IShapePlugin {
  type = 'line';
  isConnector = true;
  canBind = true;
  defaultStyle: Partial<Shape> = { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, edgeStyle: 'straight', opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'edgeStyle', 'roughness', 'layer', 'action'];
  
  getTextAnchor(shape: Shape, allShapes: Shape[] = []): Point | null {
    const pts = shape.points || [];
    if (pts.length < 2) return null;
    const wpts = this.worldPoints(shape);

    // For multi-point lines, use the midpoint of all segments
    if (wpts.length > 2) {
      return getPathMidpoint(wpts);
    }

    const p1 = wpts[0];
    const p2 = wpts[1];

    // Calculate midpoint based on edgeStyle
    if (useSmartRouting(shape)) {
      const b1 = shape.startBinding ? allShapes.find(s => s.id === shape.startBinding!.elementId) : undefined;
      const b2 = shape.endBinding ? allShapes.find(s => s.id === shape.endBinding!.elementId) : undefined;
      const path = getElbowPath(p1, p2, b1, b2);
      return getPathMidpoint(path);
    } else if (shape.edgeStyle === 'curved') {
      const cp = getCurvedControlPoint(p1, p2);
      // Bezier midpoint at t=0.5: 0.25*p1 + 0.5*cp + 0.25*p2
      return { x: 0.25 * p1.x + 0.5 * cp.x + 0.25 * p2.x, y: 0.25 * p1.y + 0.5 * cp.y + 0.25 * p2.y };
    }

    // straight (default)
    return getPathMidpoint(wpts);
  }
  private worldPoints(shape: Shape): Point[] {
    return (shape.points || []).map(p => ({ x: shape.x + p.x, y: shape.y + p.y }));
  }

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, allShapes: Shape[], theme: 'light' | 'dark') {
    const wpts = this.worldPoints(shape);
    if (wpts.length < 2) return;

    const options = buildRoughOptions(shape, theme);

    // For multi-point lines, always use linearPath (no elbow/curved for segments > 2)
    if (wpts.length > 2) {
      rc.linearPath(wpts.map(p => [p.x, p.y] as [number, number]), options);
      return;
    }

    const p1 = wpts[0];
    const p2 = wpts[1];

    // Handle edgeStyle for 2-point lines
    if (useSmartRouting(shape)) {
      const b1 = shape.startBinding ? allShapes.find(s => s.id === shape.startBinding!.elementId) : undefined;
      const b2 = shape.endBinding ? allShapes.find(s => s.id === shape.endBinding!.elementId) : undefined;
      const path = getElbowPath(p1, p2, b1, b2);
      ctx.save();
      ctx.strokeStyle = options.stroke as string;
      ctx.lineWidth = (options.strokeWidth as number) || 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (shape.strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
      else if (shape.strokeStyle === 'dotted') ctx.setLineDash([2, 6]);
      else ctx.setLineDash([]);
      drawRoundedPath(ctx, path, 10);
      ctx.stroke();
      ctx.restore();
    } else if (shape.edgeStyle === 'curved') {
      const cp = getCurvedControlPoint(p1, p2);
      ctx.save();
      ctx.strokeStyle = options.stroke as string;
      ctx.lineWidth = (options.strokeWidth as number) || 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (shape.strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
      else if (shape.strokeStyle === 'dotted') ctx.setLineDash([2, 6]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    } else {
      // straight (default)
      rc.line(p1.x, p1.y, p2.x, p2.y, options);
    }
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape, _allShapes: Shape[], theme: 'light' | 'dark') {
    const wpts = this.worldPoints(shape);
    if (wpts.length < 2) return;
    if (shape.locked) drawLockIcon(ctx, wpts[0].x, wpts[0].y);
    renderEndpointHandles(ctx, wpts[0], wpts[wpts.length - 1], shape.stroke, theme);
  }

  getBounds(shape: Shape) {
    const pts = shape.points || [];
    if (pts.length === 0) return { x: shape.x, y: shape.y, width: 0, height: 0 };
    
    const xs = pts.map(p => shape.x + p.x);
    const ys = pts.map(p => shape.y + p.y);

    if (shape.edgeStyle === 'curved' && pts.length >= 2) {
      const p1 = { x: xs[0], y: ys[0] };
      const p2 = { x: xs[1], y: ys[1] };
      const cp = getCurvedControlPoint(p1, p2);
      xs.push(cp.x);
      ys.push(cp.y);
    }

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 20;

    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(1, maxX - minX) + pad * 2,
      height: Math.max(1, maxY - minY) + pad * 2,
    };
  }

  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const wpts = this.worldPoints(shape);
    if (wpts.length < 2) return null;
    const d = UI_CONSTANTS.HANDLE_HIT_DISTANCE * 2;
    if (Math.abs(point.x - wpts[0].x) <= d && Math.abs(point.y - wpts[0].y) <= d) return 'start';
    const last = wpts[wpts.length - 1];
    if (Math.abs(point.x - last.x) <= d && Math.abs(point.y - last.y) <= d) return 'end';
    return null;
  }

  isPointInside(point: Point, shape: Shape, allShapes: Shape[] = []): boolean {
    const wpts = this.worldPoints(shape);
    if (wpts.length < 2) return false;
    const threshold = Math.max(UI_CONSTANTS.SEGMENT_HIT_THRESHOLD, (shape.strokeWidth || 2) + 4);

    // For multi-point lines, check all segments
    if (wpts.length > 2) {
      for (let i = 0; i < wpts.length - 1; i++) {
        if (pointToSegmentDistance(point, wpts[i], wpts[i + 1]) <= threshold) return true;
      }
      return false;
    }

    const p1 = wpts[0];
    const p2 = wpts[1];

    // Handle edgeStyle for 2-point lines
    if (useSmartRouting(shape)) {
      const b1 = shape.startBinding ? allShapes.find(s => s.id === shape.startBinding!.elementId) : undefined;
      const b2 = shape.endBinding ? allShapes.find(s => s.id === shape.endBinding!.elementId) : undefined;
      const path = getElbowPath(p1, p2, b1, b2);
      for (let i = 0; i < path.length - 1; i++) {
        if (pointToSegmentDistance(point, path[i], path[i + 1]) <= threshold) return true;
      }
      return false;
    }

    // Handle curved lines using quadratic bezier hit testing
    if (shape.edgeStyle === 'curved') {
      const cp = getCurvedControlPoint(p1, p2);
      return pointToQuadraticBezierDistance(point, p1, cp, p2) <= threshold;
    }

    // For straight lines, use simple segment distance
    return pointToSegmentDistance(point, p1, p2) <= threshold;
  }

  onDrawInit = ConnectorMixin.onDrawInit;
  onDrawUpdate = ConnectorMixin.onDrawUpdate;
  onDragBindHandle = ConnectorMixin.onDragBindHandle;
  onBoundShapeChange = ConnectorMixin.onBoundShapeChange;

  onDragHandle(shape: Shape, handle: string, payload: PointerPayload): Partial<Shape> {
    const pts = [...(shape.points || [])];
    if (handle === 'start') {
      const dx = shape.x - payload.world.x;
      const dy = shape.y - payload.world.y;
      const newPts = pts.map((p, i) => i === 0 ? { x: 0, y: 0 } : { x: p.x + dx, y: p.y + dy });
      return { x: payload.world.x, y: payload.world.y, points: newPts, startBinding: undefined };
    } else if (handle === 'end') {
      pts[pts.length - 1] = { x: payload.world.x - shape.x, y: payload.world.y - shape.y };
      return { points: pts, endBinding: undefined };
    }
    return {};
  }
}
