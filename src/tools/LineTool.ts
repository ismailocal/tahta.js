import type { ICanvasAPI, PointerPayload, ToolDefinition } from '../core/types';
import { getStylePreset, getCachedStyle } from '../core/constants';
import { createId, randomSeed } from '../core/Utils';
import { getTopShapeAtPoint } from '../geometry/Geometry';
import { PluginRegistry } from '../plugins/PluginRegistry';

/**
 * LineTool — click-to-add-points polyline drawing.
 *
 * Interaction:
 *   - Click: add a vertex
 *   - Double-click: finish the line
 *   - Escape / Enter: finish the line
 *
 * Binding:
 *   - Starting on a shape binds the start endpoint (startBinding)
 *   - Ending on a shape binds the end endpoint (endBinding)
 *   - Bound endpoints follow their shape when it moves
 */
export class LineTool implements ToolDefinition {
  private currentShapeId: string | null = null;

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    if (!this.currentShapeId) {
      this._startLine(payload, api);
    } else {
      this._addPoint(payload, api);
    }
  }

  onPointerMove(payload: PointerPayload, api: ICanvasAPI) {
    if (!this.currentShapeId) return;
    const state = api.getState();
    const shape = state.shapes.find(s => s.id === this.currentShapeId);
    if (!shape) return;

    // Update the pending (last) point to follow the mouse
    const pts = shape.points || [];
    api.updateShape(this.currentShapeId, {
      points: [...pts.slice(0, -1), {
        x: payload.world.x - shape.x,
        y: payload.world.y - shape.y,
      }],
    }, true);

    // Hover highlight for potential binding targets
    const candidates = state.shapes.filter(s =>
      s.id !== this.currentShapeId &&
      PluginRegistry.hasPlugin(s.type) &&
      !PluginRegistry.getPlugin(s.type).isConnector &&
      !!PluginRegistry.getPlugin(s.type).getConnectionPoints
    );
    const hit = getTopShapeAtPoint(candidates, payload.world);
    api.setState({ hoveredShapeId: hit?.id ?? null });
  }

  onDoubleClick(_payload: PointerPayload, api: ICanvasAPI) {
    // pointerDown already ran for the second click and added a point.
    // Remove 1 extra (the pending preview created by that click).
    this._finish(api);
  }

  onKeyDown(event: KeyboardEvent, api: ICanvasAPI) {
    if (event.key === 'Escape' || event.key === 'Enter') {
      this._finish(api);
    }
  }

  private _startLine(payload: PointerPayload, api: ICanvasAPI) {
    const state = api.getState();
    const candidates = state.shapes.filter(s =>
      PluginRegistry.hasPlugin(s.type) &&
      !PluginRegistry.getPlugin(s.type).isConnector &&
      !!PluginRegistry.getPlugin(s.type).getConnectionPoints
    );
    const hitShape = getTopShapeAtPoint(candidates, payload.world);

    const preset = getCachedStyle('line');
    const shape = {
      ...preset,
      id: createId(),
      type: 'line',
      x: payload.world.x,
      y: payload.world.y,
      // points[0] = confirmed origin, points[1] = pending preview (follows mouse)
      points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      seed: randomSeed(),
      startBinding: hitShape ? {
        elementId: hitShape.id,
        offsetX: payload.world.x - hitShape.x,
        offsetY: payload.world.y - hitShape.y,
      } : undefined,
    };

    api.addShape(shape as any);
    api.setSelection([shape.id]);
    api.setState({ drawingShapeId: shape.id });
    this.currentShapeId = shape.id;
  }

  private _addPoint(payload: PointerPayload, api: ICanvasAPI) {
    const state = api.getState();
    const shape = state.shapes.find(s => s.id === this.currentShapeId);
    if (!shape) return;

    const pts = shape.points || [];
    const dx = payload.world.x - shape.x;
    const dy = payload.world.y - shape.y;

    // Confirm the pending point, add a new pending preview at the same position
    api.updateShape(this.currentShapeId!, {
      points: [...pts.slice(0, -1), { x: dx, y: dy }, { x: dx, y: dy }],
    });
  }

  private _finish(api: ICanvasAPI) {
    if (!this.currentShapeId) return;
    const state = api.getState();
    const shape = state.shapes.find(s => s.id === this.currentShapeId);

    if (shape) {
      const pts = shape.points || [];
      // Always remove the last point — it's the pending preview
      const finalPts = pts.slice(0, -1);

      if (finalPts.length < 2) {
        api.deleteShape(this.currentShapeId);
      } else {
        // Detect end binding at the last confirmed point
        const lastPt = finalPts[finalPts.length - 1];
        const worldPt = { x: shape.x + lastPt.x, y: shape.y + lastPt.y };
        const candidates = state.shapes.filter(s =>
          s.id !== this.currentShapeId &&
          PluginRegistry.hasPlugin(s.type) &&
          !PluginRegistry.getPlugin(s.type).isConnector &&
          !!PluginRegistry.getPlugin(s.type).getConnectionPoints
        );
        const hitShape = getTopShapeAtPoint(candidates, worldPt);

        api.updateShape(this.currentShapeId, {
          points: finalPts,
          endBinding: hitShape ? {
            elementId: hitShape.id,
            offsetX: worldPt.x - hitShape.x,
            offsetY: worldPt.y - hitShape.y,
          } : undefined,
        });
        api.commitState();
      }
    }

    api.setState({ drawingShapeId: null, hoveredShapeId: null });
    api.setTool('select');
    this.currentShapeId = null;
  }
}
