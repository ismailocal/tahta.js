import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point, ICanvasAPI } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { pointToSegmentDistance } from '../geometry/Geometry';
import { getPathMidpoint, renderEndpointHandles, buildRoughOptions } from '../geometry/lineUtils';
import { findNearestPort, getBindingPoint } from './ArrowPlugin';

export class LinePlugin implements IShapePlugin {
  type = 'line';
  isConnector = true;
  canBind = true;
  defaultStyle: Partial<Shape> = { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'roughness', 'layer', 'action'];

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
    const d = 20;
    if (Math.abs(point.x - wpts[0].x) <= d && Math.abs(point.y - wpts[0].y) <= d) return 'start';
    const last = wpts[wpts.length - 1];
    if (Math.abs(point.x - last.x) <= d && Math.abs(point.y - last.y) <= d) return 'end';
    return null;
  }

  isPointInside(point: Point, shape: Shape): boolean {
    const wpts = this.worldPoints(shape);
    if (wpts.length < 2) return false;
    const threshold = Math.max(8, (shape.strokeWidth || 2) + 4);
    for (let i = 0; i < wpts.length - 1; i++) {
      if (pointToSegmentDistance(point, wpts[i], wpts[i + 1]) <= threshold) return true;
    }
    return false;
  }

  onDrawInit(payload: PointerPayload, _shapes: Shape[], _api: ICanvasAPI): Partial<Shape> {
    return {
      x: payload.world.x,
      y: payload.world.y,
      points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      stroke: '#64748b',
      strokeWidth: 1.8
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
    const state = api.getState();

    const snap = (!payload.ctrlKey && !payload.metaKey)
      ? findNearestPort(payload.world, allShapes, [shape.id])
      : null;

    if (snap) {
      if (state.hoveredShapeId !== snap.shape.id) api.setState({ hoveredShapeId: snap.shape.id });
      patch.endBinding = { elementId: snap.shape.id, portId: snap.portId };
      patch.points = [{ x: 0, y: 0 }, { x: snap.x - shape.x, y: snap.y - shape.y }];
    } else {
      if (state.hoveredShapeId) api.setState({ hoveredShapeId: null });
    }
    return patch;
  }

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

  onDragBindHandle(shape: Shape, handle: string, payload: PointerPayload, allShapes: Shape[], activeShapeId: string, api: any): Partial<Shape> {
    const snap = (!payload.ctrlKey && !payload.metaKey)
      ? findNearestPort(payload.world, allShapes, [activeShapeId])
      : null;

    const patch: Partial<Shape> = {};
    const state = api.getState();
    if (snap) {
      if (snap.shape.id !== state.hoveredShapeId) api.setState({ hoveredShapeId: snap.shape.id });
      if (handle === 'start') {
        patch.startBinding = { elementId: snap.shape.id, portId: snap.portId };
        const p2wx = shape.x + (shape.points?.[1]?.x || 0);
        const p2wy = shape.y + (shape.points?.[1]?.y || 0);
        patch.x = snap.x; patch.y = snap.y;
        patch.points = [{ x: 0, y: 0 }, { x: p2wx - snap.x, y: p2wy - snap.y }];
      } else if (handle === 'end') {
        patch.endBinding = { elementId: snap.shape.id, portId: snap.portId };
        patch.points = [{ x: 0, y: 0 }, { x: snap.x - shape.x, y: snap.y - shape.y }];
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
        if (sShape) p1 = getBindingPoint(sShape, shape.startBinding!.portId);
      }
      if (endId) {
        const eShape = allShapes.find(s => s.id === endId);
        if (eShape) p2 = getBindingPoint(eShape, shape.endBinding!.portId);
      }

      return {
        x: p1.x, y: p1.y,
        points: [{ x: 0, y: 0 }, { x: p2.x - p1.x, y: p2.y - p1.y }]
      };
    }
    return null;
  }
}
