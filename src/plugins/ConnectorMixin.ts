import type { Shape, PointerPayload, Point, ICanvasAPI } from '../core/types';
import { getTopShapeAtPoint } from '../geometry/Geometry';
import { PluginRegistry } from './PluginRegistry';
import { UI_CONSTANTS } from '../core/constants';

/**
 * Shared connector binding logic for ArrowPlugin and LinePlugin.
 * Extracted to reduce code duplication between connector plugins.
 */
export class ConnectorMixin {
  /**
   * Find the nearest port across all non-connector shapes within snap radius.
   */
  static findNearestPort(
    cursor: { x: number; y: number },
    allShapes: Shape[],
    excludeIds: string[] = []
  ): { shape: Shape; portId: string; x: number; y: number } | null {
    let best: { shape: Shape; portId: string; x: number; y: number } | null = null;
    let bestDist = UI_CONSTANTS.PORT_SNAP_RADIUS;
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

  /**
   * Get the binding point for a shape, optionally using a specific port ID.
   */
  static getBindingPoint(shape: Shape, portId?: string): { x: number; y: number } {
    if (portId && PluginRegistry.hasPlugin(shape.type)) {
      const plugin = PluginRegistry.getPlugin(shape.type);
      if (plugin.getConnectionPoints) {
        const port = plugin.getConnectionPoints(shape).find(p => p.id === portId);
        if (port) return { x: port.x, y: port.y };
      }
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
    allShapes: Shape[],
    activeShapeId: string,
    api: any
  ): Partial<Shape> {
    let snap = (!payload.ctrlKey && !payload.metaKey)
      ? ConnectorMixin.findNearestPort(payload.world, allShapes, [activeShapeId])
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
    } else if (!payload.ctrlKey && !payload.metaKey) {
      const hit = getTopShapeAtPoint(allShapes, payload.world, api.getSpatialIndex());
      if (hit && hit.id !== activeShapeId && !PluginRegistry.getPlugin(hit.type).isConnector && !!PluginRegistry.getPlugin(hit.type).getConnectionPoints) {
        if (hit.id !== state.hoveredShapeId) api.setState({ hoveredShapeId: hit.id });
        const center = ConnectorMixin.getBindingPoint(hit);
        if (handle === 'start') {
          patch.startBinding = { elementId: hit.id };
          const p2wx = shape.x + (shape.points?.[1]?.x || 0);
          const p2wy = shape.y + (shape.points?.[1]?.y || 0);
          patch.x = center.x; patch.y = center.y;
          patch.points = [{ x: 0, y: 0 }, { x: p2wx - center.x, y: p2wy - center.y }];
        } else if (handle === 'end') {
          patch.endBinding = { elementId: hit.id };
          patch.points = [{ x: 0, y: 0 }, { x: center.x - shape.x, y: center.y - shape.y }];
        }
      } else {
        if (state.hoveredShapeId) api.setState({ hoveredShapeId: null });
        if (handle === 'start') patch.startBinding = undefined;
        if (handle === 'end') patch.endBinding = undefined;
      }
    } else {
      if (state.hoveredShapeId) api.setState({ hoveredShapeId: null });
      if (handle === 'start') patch.startBinding = undefined;
      if (handle === 'end') patch.endBinding = undefined;
    }
    return patch;
  }

  /**
   * Update connector when a bound shape changes position.
   */
  static onBoundShapeChange(shape: Shape, allShapes: Shape[], changedShapeIds: string[]): Partial<Shape> | null {
    const startId = shape.startBinding?.elementId;
    const endId = shape.endBinding?.elementId;
    if (!startId && !endId) return null;

    if ((startId && changedShapeIds.includes(startId)) || (endId && changedShapeIds.includes(endId))) {
      let p1 = { x: shape.x, y: shape.y };
      let p2 = { x: shape.x + (shape.points?.[1]?.x || 0), y: shape.y + (shape.points?.[1]?.y || 0) };

      if (startId) {
        const sShape = allShapes.find(s => s.id === startId);
        if (sShape) p1 = ConnectorMixin.getBindingPoint(sShape, shape.startBinding!.portId);
      }
      if (endId) {
        const eShape = allShapes.find(s => s.id === endId);
        if (eShape) p2 = ConnectorMixin.getBindingPoint(eShape, shape.endBinding!.portId);
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
  static onDrawInit(payload: PointerPayload, allShapes: Shape[], api: ICanvasAPI): Partial<Shape> {
    let snap = ConnectorMixin.findNearestPort(payload.world, allShapes);
    let startBinding: any = snap ? { elementId: snap.shape.id, portId: snap.portId } : undefined;
    let x = snap ? snap.x : payload.world.x;
    let y = snap ? snap.y : payload.world.y;

    if (!snap) {
      // Fallback: if clicking inside a shape, bind to its center (only shapes with ports)
      const hit = getTopShapeAtPoint(allShapes, payload.world, api.getSpatialIndex());
      if (hit && !PluginRegistry.getPlugin(hit.type).isConnector && !!PluginRegistry.getPlugin(hit.type).getConnectionPoints) {
        startBinding = { elementId: hit.id };
        const center = ConnectorMixin.getBindingPoint(hit);
        x = center.x; y = center.y;
      }
    }

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
  static onDrawUpdate(shape: Shape, payload: PointerPayload, _dragStart: Point, allShapes: Shape[], api: any): Partial<Shape> {
    let dx = payload.world.x - shape.x;
    let dy = payload.world.y - shape.y;
    if (payload.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    const patch: Partial<Shape> = { points: [{ x: 0, y: 0 }, { x: dx, y: dy }], endBinding: undefined };
    const state = api.getState();

    let snap = (!payload.ctrlKey && !payload.metaKey)
      ? ConnectorMixin.findNearestPort(payload.world, allShapes, [shape.id])
      : null;

    if (snap) {
      if (state.hoveredShapeId !== snap.shape.id) api.setState({ hoveredShapeId: snap.shape.id });
      patch.endBinding = { elementId: snap.shape.id, portId: snap.portId };
      patch.points = [{ x: 0, y: 0 }, { x: snap.x - shape.x, y: snap.y - shape.y }];
    } else if (!payload.ctrlKey && !payload.metaKey) {
      const hit = getTopShapeAtPoint(allShapes, payload.world, api.getSpatialIndex());
      if (hit && hit.id !== shape.id && !PluginRegistry.getPlugin(hit.type).isConnector && !!PluginRegistry.getPlugin(hit.type).getConnectionPoints) {
        if (state.hoveredShapeId !== hit.id) api.setState({ hoveredShapeId: hit.id });
        patch.endBinding = { elementId: hit.id };
        const center = ConnectorMixin.getBindingPoint(hit);
        patch.points = [{ x: 0, y: 0 }, { x: center.x - shape.x, y: center.y - shape.y }];
      } else {
        if (state.hoveredShapeId) api.setState({ hoveredShapeId: null });
      }
    }
    return patch;
  }
}
