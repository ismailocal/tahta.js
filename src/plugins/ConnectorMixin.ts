import type { Shape, ShapeBinding, PointerPayload, Point, ICanvasAPI } from '../core/types';
import type { ShapeRegistry } from '../core/registry';
import { getShapePlugin } from './index';
import { findNearestConnectionPort } from '../geometry/ConnectionPorts';
import { getShapeById } from '../geometry/ShapeLookup';

/**
 * Shared connector binding logic for ArrowPlugin and LinePlugin.
 * Extracted to reduce code duplication between connector plugins.
 */
export class ConnectorMixin {
  /**
   * Get the binding point for a shape.
   * Priority: portId > normalX/normalY (proportional float) > shape center.
   */
  static getBindingPoint(shape: Shape, registry: ShapeRegistry, portId?: string, normalX?: number, normalY?: number): { x: number; y: number } {
    if (portId) {
      const plugin = getShapePlugin(registry, shape.type);
      if (plugin.getConnectionPoints) {
        const port = plugin.getConnectionPoints(shape).find(p => p.id === portId);
        if (port) return { x: port.x, y: port.y };
      }
    }
    if (normalX !== undefined && normalY !== undefined) {
      return {
        x: shape.x + (shape.width || 0) * normalX,
        y: shape.y + (shape.height || 0) * normalY,
      };
    }
    return { x: shape.x + (shape.width || 0) / 2, y: shape.y + (shape.height || 0) / 2 };
  }

  /**
   * Handle dragging a connector's binding handle to snap to ports.
   */
  static onDragBindHandle(
    shape: Shape,
    handle: string,
    payload: PointerPayload,
    _allShapes: Shape[],
    activeShapeId: string,
    api: ICanvasAPI
  ): Partial<Shape> {
    const snap = (!payload.ctrlKey && !payload.metaKey)
      ? findNearestConnectionPort(payload.world, api.getSpatialIndex(), api.registry, [activeShapeId])
      : null;

    const patch: Partial<Shape> = {};
    const state = api.getState();
    if (snap) {
      if (snap.shape.id !== state.hoveredShapeId || snap.shape.id !== state.hoveredPortShapeId || snap.portId !== state.hoveredPortId) {
        api.setState({ hoveredShapeId: snap.shape.id, hoveredPortShapeId: snap.shape.id, hoveredPortId: snap.portId });
      }
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
      if (state.hoveredShapeId || state.hoveredPortShapeId) api.setState({ hoveredShapeId: null, hoveredPortShapeId: null, hoveredPortId: null });
      if (handle === 'start') patch.startBinding = undefined;
      if (handle === 'end') patch.endBinding = undefined;
    }
    return patch;
  }

  /**
   * Update connector when a bound shape changes position.
   */
  static onBoundShapeChange(shape: Shape, allShapes: Shape[], changedShapeIds: string[], registry: ShapeRegistry): Partial<Shape> | null {
    const startId = shape.startBinding?.elementId;
    const endId = shape.endBinding?.elementId;
    if (!startId && !endId) return null;

    if ((startId && changedShapeIds.includes(startId)) || (endId && changedShapeIds.includes(endId))) {
      let p1 = { x: shape.x, y: shape.y };
      let p2 = { x: shape.x + (shape.points?.[1]?.x || 0), y: shape.y + (shape.points?.[1]?.y || 0) };

      if (startId) {
        const sShape = getShapeById(allShapes, startId);
        if (sShape) p1 = ConnectorMixin.getBindingPoint(sShape, registry, shape.startBinding!.portId, shape.startBinding!.normalX, shape.startBinding!.normalY);
      }
      if (endId) {
        const eShape = getShapeById(allShapes, endId);
        if (eShape) p2 = ConnectorMixin.getBindingPoint(eShape, registry, shape.endBinding!.portId, shape.endBinding!.normalX, shape.endBinding!.normalY);
      }

      return {
        x: p1.x, y: p1.y,
        points: [{ x: 0, y: 0 }, { x: p2.x - p1.x, y: p2.y - p1.y }]
      };
    }
    return null;
  }

  /**
   * Initialize connector drawing with optional port snapping.
   */
  static onDrawInit(payload: PointerPayload, _allShapes: Shape[], api: ICanvasAPI): Partial<Shape> {
    const snap = findNearestConnectionPort(payload.world, api.getSpatialIndex(), api.registry);
    const startBinding: ShapeBinding | undefined = snap ? { elementId: snap.shape.id, portId: snap.portId } : undefined;
    const x = snap ? snap.x : payload.world.x;
    const y = snap ? snap.y : payload.world.y;

    // No fallback: only bind to named ports, not arbitrary shape points

    return {
      x, y,
      points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      stroke: '#64748b',
      strokeWidth: 1.8,
      startBinding
    };
  }

  /**
   * Update connector during drawing with optional port snapping.
   */
  static onDrawUpdate(shape: Shape, payload: PointerPayload, _dragStart: Point, _allShapes: Shape[], api: ICanvasAPI): Partial<Shape> {
    void _dragStart;
    let dx = payload.world.x - shape.x;
    let dy = payload.world.y - shape.y;
    if (payload.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    const patch: Partial<Shape> = { points: [{ x: 0, y: 0 }, { x: dx, y: dy }], endBinding: undefined };
    const state = api.getState();

    const snap = (!payload.ctrlKey && !payload.metaKey)
      ? findNearestConnectionPort(payload.world, api.getSpatialIndex(), api.registry, [shape.id])
      : null;

    if (snap) {
      if (state.hoveredShapeId !== snap.shape.id || state.hoveredPortShapeId !== snap.shape.id || state.hoveredPortId !== snap.portId) {
        api.setState({ hoveredShapeId: snap.shape.id, hoveredPortShapeId: snap.shape.id, hoveredPortId: snap.portId });
      }
      patch.endBinding = { elementId: snap.shape.id, portId: snap.portId };
      patch.points = [{ x: 0, y: 0 }, { x: snap.x - shape.x, y: snap.y - shape.y }];
    } else {
      if (state.hoveredShapeId || state.hoveredPortShapeId) api.setState({ hoveredShapeId: null, hoveredPortShapeId: null, hoveredPortId: null });
    }
    return patch;
  }
}
