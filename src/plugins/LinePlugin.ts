import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { pointToSegmentDistance, getTopShapeAtPoint } from '../core/Geometry';
import { getArrowClippedEndpoints, getElbowPath, drawArrowhead } from '../core/lineUtils';

function drawHandle(ctx: CanvasRenderingContext2D, hx: number, hy: number) {
  const hw = 4;
  ctx.fillRect(hx - hw, hy - hw, hw * 2, hw * 2);
  ctx.strokeRect(hx - hw, hy - hw, hw * 2, hw * 2);
}

export class LinePlugin implements IShapePlugin {
  type = 'line';

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, allShapes: Shape[]) {
    const pts = shape.points || [];
    if (pts.length < 2) return;

    const options: any = {
      stroke: shape.stroke || '#f8fafc',
      strokeWidth: shape.strokeWidth || 1,
      roughness: shape.roughness ?? 0,
      seed: shape.seed ?? 1,
    };
    if (shape.strokeStyle === 'dashed') options.strokeLineDash = [8, 8];
    else if (shape.strokeStyle === 'dotted') options.strokeLineDash = [2, 6];

    const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);

    if (shape.edgeStyle === 'elbow') {
      const b1 = shape.startBinding ? allShapes.find(s => s.id === shape.startBinding!.elementId) : undefined;
      const b2 = shape.endBinding ? allShapes.find(s => s.id === shape.endBinding!.elementId) : undefined;
      const path = getElbowPath(p1, p2, b1, b2, allShapes, s => {
        if (s.id === shape.id) return this.getBounds(s);
        const xs = (s.points || []).map(p => s.x + p.x);
        const ys = (s.points || []).map(p => s.y + p.y);
        if (xs.length > 0) {
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
          return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }
        return { x: s.x, y: s.y, width: s.width || 0, height: s.height || 0 };
      });
      rc.linearPath(path.map(p => [p.x, p.y]), options);

      const lastP1 = path[path.length - 2];
      const lastP2 = path[path.length - 1];
      const angle = Math.atan2(lastP2.y - lastP1.y, lastP2.x - lastP1.x);
      if (shape.endArrowhead && shape.endArrowhead !== 'none') {
        drawArrowhead(rc, ctx, lastP2, angle, shape.endArrowhead, options);
      }
      if (shape.startArrowhead && shape.startArrowhead !== 'none') {
        const firstP1 = path[1];
        const firstP0 = path[0];
        const startAngle = Math.atan2(firstP0.y - firstP1.y, firstP0.x - firstP1.x);
        drawArrowhead(rc, ctx, firstP0, startAngle, shape.startArrowhead, options);
      }
    } else {
      rc.line(p1.x, p1.y, p2.x, p2.y, options);

      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      if (shape.endArrowhead && shape.endArrowhead !== 'none') {
        drawArrowhead(rc, ctx, p2, angle, shape.endArrowhead, options);
      }

      if (shape.startArrowhead && shape.startArrowhead !== 'none') {
        const startAngle = Math.atan2(p1.y - p2.y, p1.x - p2.x);
        drawArrowhead(rc, ctx, p1, startAngle, shape.startArrowhead, options);
      }
    }
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape, allShapes: Shape[]) {
    const pts = shape.points || [];
    if (pts.length < 2) return;
    const isLocked = shape.locked;
    const bounds = this.getBounds(shape);

    if (isLocked) {
      const { p1 } = getArrowClippedEndpoints(shape, allShapes);
      drawLockIcon(ctx, p1.x, p1.y);
      return;
    }

    ctx.setLineDash([]);
    ctx.fillStyle = '#1e1e24';
    ctx.strokeStyle = shape.stroke || '#8b5cf6';
    const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);
    drawHandle(ctx, p1.x, p1.y);
    drawHandle(ctx, p2.x, p2.y);
  }

  getBounds(shape: Shape) {
    const pts = shape.points || [];
    if (pts.length === 0) return { x: shape.x, y: shape.y, width: 0, height: 0 };

    // For bounds, we should ideally consider the elbows, but doing simple bounds between start and end is generally enough for selection bounds 
    // unless the elbow goes way out. Simple bounds:
    const xs = pts.map(p => shape.x + p.x);
    const ys = pts.map(p => shape.y + p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }

  getHandleAtPoint(shape: Shape, point: Point, allShapes: Shape[]): string | null {
    const pts = shape.points || [];
    if (pts.length > 1) {
      const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);
      const d = 15;
      if (Math.abs(point.x - p1.x) <= d && Math.abs(point.y - p1.y) <= d) return 'start';
      if (Math.abs(point.x - p2.x) <= d && Math.abs(point.y - p2.y) <= d) return 'end';
    }
    return null;
  }

  isPointInside(point: Point, shape: Shape, allShapes: Shape[] = []): boolean {
    const pts = shape.points || [];
    if (pts.length < 2) return false;

    const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);

    if (shape.edgeStyle === 'elbow') {
      const b1 = shape.startBinding ? allShapes.find(s => s.id === shape.startBinding!.elementId) : undefined;
      const b2 = shape.endBinding ? allShapes.find(s => s.id === shape.endBinding!.elementId) : undefined;
      const path = getElbowPath(p1, p2, b1, b2);
      for (let i = 0; i < path.length - 1; i++) {
        if (pointToSegmentDistance(point, path[i], path[i + 1]) <= Math.max(8, (shape.strokeWidth || 2) + 4)) return true;
      }
      return false;
    }

    return pointToSegmentDistance(point, p1, p2) <= Math.max(8, (shape.strokeWidth || 2) + 4);
  }

  onDrawInit(payload: PointerPayload, allShapes: Shape[], _api: any): Partial<Shape> {
    const hitShape = getTopShapeAtPoint(
      allShapes.filter(s => s.type !== 'arrow' && s.type !== 'line' && s.type !== 'freehand'),
      payload.world
    );
    return {
      x: payload.world.x,
      y: payload.world.y,
      points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      startBinding: hitShape ? { elementId: hitShape.id } : undefined
    };
  }

  onDrawUpdate(shape: Shape, payload: PointerPayload, _dragStart: Point, allShapes: Shape[], api: any): Partial<Shape> {
    let dx = payload.world.x - shape.x;
    let dy = payload.world.y - shape.y;
    if (payload.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    const patch: Partial<Shape> = { points: [{ x: 0, y: 0 }, { x: dx, y: dy }], endBinding: undefined };

    const hitShape = getTopShapeAtPoint(
      allShapes.filter(s => s.type !== 'arrow' && s.type !== 'line' && s.type !== 'freehand'),
      payload.world
    );
    const state = api.getState();
    if (hitShape && shape?.startBinding?.elementId !== hitShape.id && (!payload.ctrlKey && !payload.metaKey)) {
      if (state.hoveredShapeId !== hitShape.id) api.setState({ hoveredShapeId: hitShape.id });
      patch.endBinding = { elementId: hitShape.id };
    } else {
      if (state.hoveredShapeId) api.setState({ hoveredShapeId: null });
    }
    return patch;
  }

  onDragHandle(shape: Shape, handle: string, payload: PointerPayload, _dragStart: Point): Partial<Shape> {
    if (handle === 'start') {
      const p2WorldX = shape.x + shape.points![1].x;
      const p2WorldY = shape.y + shape.points![1].y;
      return {
        x: payload.world.x,
        y: payload.world.y,
        points: [{ x: 0, y: 0 }, { x: p2WorldX - payload.world.x, y: p2WorldY - payload.world.y }],
        startBinding: undefined
      };
    } else if (handle === 'end') {
      return {
        points: [{ x: 0, y: 0 }, { x: payload.world.x - shape.x, y: payload.world.y - shape.y }],
        endBinding: undefined
      };
    }
    return {};
  }

  onDragBindHandle(shape: Shape, handle: string, payload: PointerPayload, allShapes: Shape[], activeShapeId: string, api: any): Partial<Shape> {
    const hit = getTopShapeAtPoint(allShapes.filter(s => s.id !== activeShapeId), payload.world);
    const isSelf = hit?.id === activeShapeId;
    const hoveredValid = hit && !isSelf && ['rectangle', 'ellipse', 'text'].includes(hit.type);

    const patch: Partial<Shape> = {};
    const state = api.getState();
    if (hoveredValid && (!payload.ctrlKey && !payload.metaKey)) {
      if (hit.id !== state.hoveredShapeId) api.setState({ hoveredShapeId: hit.id });
      if (handle === 'start') {
        if (shape.endBinding?.elementId !== hit.id) patch.startBinding = { elementId: hit.id };
        else patch.startBinding = undefined;
      } else if (handle === 'end') {
        if (shape.startBinding?.elementId !== hit.id) patch.endBinding = { elementId: hit.id };
        else patch.endBinding = undefined;
      }
    } else {
      if (state.hoveredShapeId) api.setState({ hoveredShapeId: null });
      if (handle === 'start') patch.startBinding = undefined;
      if (handle === 'end') patch.endBinding = undefined;
    }
    return patch;
  }

  onBoundShapeChange(shape: Shape, allShapes: Shape[], changedShapeIds: string[]): Partial<Shape> | null {
    const startId = shape.startBinding?.elementId;
    const endId = shape.endBinding?.elementId;
    if (!startId && !endId) return null;

    if ((startId && changedShapeIds.includes(startId)) || (endId && changedShapeIds.includes(endId))) {
      let p1 = { x: shape.x, y: shape.y };
      let p2 = { x: shape.x + (shape.points?.[1]?.x || 0), y: shape.y + (shape.points?.[1]?.y || 0) };

      if (startId) {
        const sShape = allShapes.find(s => s.id === startId);
        if (sShape) p1 = { x: sShape.x + (sShape.width || 0) / 2, y: sShape.y + (sShape.height || 0) / 2 };
      }
      if (endId) {
        const eShape = allShapes.find(s => s.id === endId);
        if (eShape) p2 = { x: eShape.x + (eShape.width || 0) / 2, y: eShape.y + (eShape.height || 0) / 2 };
      }

      return {
        x: p1.x, y: p1.y,
        points: [{ x: 0, y: 0 }, { x: p2.x - p1.x, y: p2.y - p1.y }]
      };
    }
    return null;
  }
}
