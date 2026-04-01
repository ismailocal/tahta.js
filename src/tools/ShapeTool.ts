import type { ICanvasAPI, PointerPayload, ToolDefinition, ShapeType, Shape } from '../core/types';
import { getStylePreset } from '../core/constants';
import { createId, randomSeed } from '../core/Utils';
import { PluginRegistry } from '../plugins/index';
import { getTopShapeAtPoint } from '../core/Geometry';

export class ShapeTool implements ToolDefinition {
  private drawStartWorld: { x: number; y: number } | null = null;
  private currentShapeId: string | null = null;
  private toolKey: ShapeType;  // used for preset lookup (e.g. 'arrow-elbow')
  private shapeType: ShapeType; // actual plugin/shape type (e.g. 'arrow')

  /**
   * @param toolKey  Toolbar tool key — used to look up the style preset.
   * @param shapeType  Plugin/shape type to create. Defaults to toolKey.
   */
  constructor(toolKey: ShapeType, shapeType?: ShapeType) {
    this.toolKey = toolKey;
    this.shapeType = shapeType ?? toolKey;
  }

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    this.drawStartWorld = payload.world;
    const preset = getStylePreset(this.toolKey);
    const common: Partial<Shape> = {
      ...preset,
      id: createId(),
      x: payload.world.x,
      y: payload.world.y,
      seed: randomSeed(),
    };

    let shape: Shape = { ...common, type: this.shapeType } as Shape;
    
    if (PluginRegistry.hasPlugin(this.shapeType)) {
      const plugin = PluginRegistry.getPlugin(this.shapeType);
      if (plugin.onDrawInit) {
        shape = { ...shape, ...plugin.onDrawInit(payload, api.getState().shapes, api) } as Shape;
      }
    }

    this.currentShapeId = shape.id;
    api.addShape(shape);
    api.setSelection([shape.id]);
    api.setState({ drawingShapeId: shape.id });
  }

  onPointerMove(payload: PointerPayload, api: ICanvasAPI) {
    if (!this.drawStartWorld || !this.currentShapeId) {
      // Not drawing — update hover so ports show on shapes for connector tools
      const state = api.getState();
      const hovered = getTopShapeAtPoint(state.shapes, payload.world, api.getSpatialIndex());
      const hoveredId = hovered?.id ?? null;
      if (hoveredId !== state.hoveredShapeId) api.setState({ hoveredShapeId: hoveredId });
      return;
    }

    if (PluginRegistry.hasPlugin(this.shapeType)) {
      const plugin = PluginRegistry.getPlugin(this.shapeType);
      if (plugin.onDrawUpdate) {
        const state = api.getState();
        const shape = state.shapes.find(s => s.id === this.currentShapeId);
        if (shape) {
          const patch = plugin.onDrawUpdate(shape, payload, this.drawStartWorld, state.shapes, api);
          
          if (Object.keys(patch).length > 0) {
            api.updateShape(this.currentShapeId, patch);
          }
        }
      }
    }
  }

  onPointerUp(payload: PointerPayload, api: ICanvasAPI) {
    if (this.currentShapeId && this.drawStartWorld) {
      const dx = payload.world.x - this.drawStartWorld.x;
      const dy = payload.world.y - this.drawStartWorld.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (this.shapeType !== 'freehand' && this.shapeType !== 'text' && distance < 2) {
        api.deleteShape(this.currentShapeId);
        api.setSelection([]);
      } else {
        // Final update at exact release position so bindings are detected correctly
        if (PluginRegistry.hasPlugin(this.shapeType)) {
          const plugin = PluginRegistry.getPlugin(this.shapeType);
          if (plugin.onDrawUpdate) {
            const state = api.getState();
            const shape = state.shapes.find(s => s.id === this.currentShapeId);
            if (shape) {
              const patch = plugin.onDrawUpdate(shape, payload, this.drawStartWorld, state.shapes, api);
              api.updateShape(this.currentShapeId!, patch);
            }
          }
        }
        api.commitState();
      }
    }
    
    if (api.getState().hoveredShapeId) {
      api.setState({ hoveredShapeId: null });
    }

    this.drawStartWorld = null;
    this.currentShapeId = null;
    api.setState({ drawingShapeId: null });
  }
}
