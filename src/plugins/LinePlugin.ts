import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point, ICanvasAPI } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { pointToSegmentDistance, getTopShapeAtPoint } from '../geometry/Geometry';
import { getPathMidpoint, renderEndpointHandles, buildRoughOptions } from '../geometry/lineUtils';
import { PluginRegistry } from './PluginRegistry';
import { UI_CONSTANTS } from '../core/constants';
import { ConnectorMixin } from './ConnectorMixin';

// Re-export for backward compatibility
export const findNearestPort = ConnectorMixin.findNearestPort;
export const getBindingPoint = ConnectorMixin.getBindingPoint;

export class LinePlugin implements IShapePlugin {
  type = 'line';
  isConnector = true;
  canBind = true;
  defaultStyle: Partial<Shape> = { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'roughness', 'layer', 'action'];
  
  getTextAnchor(shape: Shape): Point | null {
    const pts = shape.points || [];
    if (pts.length < 2) return null;
    const wpts = this.worldPoints(shape);
    return getPathMidpoint(wpts);
  }
  private worldPoints(shape: Shape): Point[] {
    return (shape.points || []).map(p => ({ x: shape.x + p.x, y: shape.y + p.y }));
  }

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const wpts = this.worldPoints(shape);
    if (wpts.length < 2) return;

    const options = buildRoughOptions(shape, theme);

    if (wpts.length === 2) {
      rc.line(wpts[0].x, wpts[0].y, wpts[1].x, wpts[1].y, options);
    } else {
      rc.linearPath(wpts.map(p => [p.x, p.y] as [number, number]), options);
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
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
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

  isPointInside(point: Point, shape: Shape): boolean {
    const wpts = this.worldPoints(shape);
    if (wpts.length < 2) return false;
    const threshold = Math.max(UI_CONSTANTS.SEGMENT_HIT_THRESHOLD, (shape.strokeWidth || 2) + 4);
    for (let i = 0; i < wpts.length - 1; i++) {
      if (pointToSegmentDistance(point, wpts[i], wpts[i + 1]) <= threshold) return true;
    }
    return false;
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
