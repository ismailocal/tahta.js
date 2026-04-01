import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point, ICanvasAPI } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { pointToSegmentDistance, getTopShapeAtPoint } from '../core/Geometry';
import { getArrowClippedEndpoints, getElbowPath, getPathMidpoint, drawArrowhead, renderEndpointHandles, drawRoundedPath, buildRoughOptions } from '../core/lineUtils';
import { PluginRegistry } from './PluginRegistry';

const PORT_SNAP_RADIUS = 40;

/** Find the nearest port across all non-connector shapes within PORT_SNAP_RADIUS. */
export function findNearestPort(
  cursor: { x: number; y: number },
  allShapes: Shape[],
  excludeIds: string[] = []
): { shape: Shape; portId: string; x: number; y: number } | null {
  let best: { shape: Shape; portId: string; x: number; y: number } | null = null;
  let bestDist = PORT_SNAP_RADIUS;
  for (const s of allShapes) {
    if (excludeIds.includes(s.id)) continue;
    if (!PluginRegistry.hasPlugin(s.type)) continue;
    const plugin = PluginRegistry.getPlugin(s.type);
    if (plugin.isConnector || !plugin.getConnectionPoints) continue;
    for (const port of plugin.getConnectionPoints(s)) {
      const d = Math.hypot(cursor.x - port.x, cursor.y - port.y);
      if (d < bestDist) { bestDist = d; best = { shape: s, portId: port.id, x: port.x, y: port.y }; }
    }
  }
  return best;
}

/** Use smart elbow routing when BOTH ends are bound, or edgeStyle is explicitly 'elbow'. */
function useSmartRouting(shape: Shape): boolean {
  return shape.edgeStyle === 'elbow' || (!!(shape.startBinding && shape.endBinding) && shape.edgeStyle !== 'curved');
}

/** Control point for a quadratic bezier curved arrow — offset perpendicular to the midpoint. */
function getCurvedControlPoint(p1: Point, p2: Point): Point {
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const offset = len * 0.35;
  return { x: mx - (dy / len) * offset, y: my + (dx / len) * offset };
}


export function getBindingPoint(shape: Shape, portId?: string): { x: number; y: number } {
  if (portId && PluginRegistry.hasPlugin(shape.type)) {
    const plugin = PluginRegistry.getPlugin(shape.type);
    if (plugin.getConnectionPoints) {
      const port = plugin.getConnectionPoints(shape).find(p => p.id === portId);
      if (port) return { x: port.x, y: port.y };
    }
  }
  return { x: shape.x + (shape.width || 0) / 2, y: shape.y + (shape.height || 0) / 2 };
}

export class ArrowPlugin implements IShapePlugin {
  type = 'arrow';
  isConnector = true;
  canBind = true;
  defaultStyle: Partial<Shape> = { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, edgeStyle: 'straight', startArrowhead: 'none', endArrowhead: 'arrow', opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'opacity', 'edgeStyle', 'endArrowhead', 'layer', 'action'];

  getTextAnchor(shape: Shape, allShapes: Shape[]): Point | null {
    const pts = shape.points || [];
    if (pts.length < 2) return null;
    const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);
    if (useSmartRouting(shape)) {
      const b1 = shape.startBinding ? allShapes.find(s => s.id === shape.startBinding!.elementId) : undefined;
      const b2 = shape.endBinding ? allShapes.find(s => s.id === shape.endBinding!.elementId) : undefined;
      const path = getElbowPath(p1, p2, b1, b2);
      return getPathMidpoint(path);
    }
    if (shape.edgeStyle === 'curved') {
      const cp = getCurvedControlPoint(p1, p2);
      // Bezier midpoint at t=0.5: 0.25*p1 + 0.5*cp + 0.25*p2
      return { x: 0.25 * p1.x + 0.5 * cp.x + 0.25 * p2.x, y: 0.25 * p1.y + 0.5 * cp.y + 0.25 * p2.y };
    }
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, allShapes: Shape[], theme: 'light' | 'dark') {
    const pts = shape.points || [];
    if (pts.length < 2) return;
    
    const options = buildRoughOptions(shape, theme);

    const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);

    if (useSmartRouting(shape)) {
      const b1 = shape.startBinding ? allShapes.find(s => s.id === shape.startBinding!.elementId) : undefined;
      const b2 = shape.endBinding ? allShapes.find(s => s.id === shape.endBinding!.elementId) : undefined;
      const path = getElbowPath(p1, p2, b1, b2);
      ctx.save();
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options.strokeWidth || 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (shape.strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
      else if (shape.strokeStyle === 'dotted') ctx.setLineDash([2, 6]);
      else ctx.setLineDash([]);
      drawRoundedPath(ctx, path, 10);
      ctx.stroke();
      ctx.restore();

      const lastP1 = path[path.length - 2];
      const lastP2 = path[path.length - 1];
      const angle = Math.atan2(lastP2.y - lastP1.y, lastP2.x - lastP1.x);
      if (shape.endArrowhead !== 'none') {
        drawArrowhead(rc, ctx, lastP2, angle, shape.endArrowhead || 'arrow', options, theme);
      }
      if (shape.startArrowhead && shape.startArrowhead !== 'none') {
        const firstP1 = path[1];
        const firstP0 = path[0];
        const startAngle = Math.atan2(firstP0.y - firstP1.y, firstP0.x - firstP1.x);
        drawArrowhead(rc, ctx, firstP0, startAngle, shape.startArrowhead, options, theme);
      }
    } else if (shape.edgeStyle === 'curved') {
      const cp = getCurvedControlPoint(p1, p2);
      ctx.save();
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options.strokeWidth || 1;
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

      if (shape.endArrowhead !== 'none') {
        const endAngle = Math.atan2(p2.y - cp.y, p2.x - cp.x);
        drawArrowhead(rc, ctx, p2, endAngle, shape.endArrowhead || 'arrow', options, theme);
      }
      if (shape.startArrowhead && shape.startArrowhead !== 'none') {
        const startAngle = Math.atan2(p1.y - cp.y, p1.x - cp.x);
        drawArrowhead(rc, ctx, p1, startAngle, shape.startArrowhead, options, theme);
      }
    } else {
      rc.line(p1.x, p1.y, p2.x, p2.y, options);

      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      if (shape.endArrowhead !== 'none') {
        drawArrowhead(rc, ctx, p2, angle, shape.endArrowhead || 'arrow', options, theme);
      }

      if (shape.startArrowhead && shape.startArrowhead !== 'none') {
        const startAngle = Math.atan2(p1.y - p2.y, p1.x - p2.x);
        drawArrowhead(rc, ctx, p1, startAngle, shape.startArrowhead, options, theme);
      }
    }
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape, allShapes: Shape[], theme: 'light' | 'dark') {
    const pts = shape.points || [];
    if (pts.length < 2) return;
    const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);
    if (shape.locked) drawLockIcon(ctx, p1.x, p1.y);
    renderEndpointHandles(ctx, p1, p2, shape.stroke, theme);
  }

  getBounds(shape: Shape) {
    const pts = shape.points || [];
    if (pts.length === 0) return { x: shape.x, y: shape.y, width: 0, height: 0 };

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
      const d = 20;
      if (Math.abs(point.x - p1.x) <= d && Math.abs(point.y - p1.y) <= d) return 'start';
      if (Math.abs(point.x - p2.x) <= d && Math.abs(point.y - p2.y) <= d) return 'end';
    }
    return null;
  }

  isPointInside(point: Point, shape: Shape, allShapes: Shape[] = []): boolean {
    const pts = shape.points || [];
    if (pts.length < 2) return false;

    // Use the *visually clipped* endpoints for hit testing
    const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);

    if (useSmartRouting(shape)) {
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

  onDrawInit(payload: PointerPayload, allShapes: Shape[], _api: ICanvasAPI): Partial<Shape> {
    const snap = findNearestPort(payload.world, allShapes);
    return {
      x: snap ? snap.x : payload.world.x,
      y: snap ? snap.y : payload.world.y,
      points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      stroke: '#64748b',
      strokeWidth: 1.8,
      startBinding: snap ? { elementId: snap.shape.id, portId: snap.portId } : undefined
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
