import type { ICanvasAPI, PointerPayload, ToolDefinition, ShapeType, Shape } from '../core/types';
import { STYLE_PRESETS } from '../core/constants';
import { createId, updateDependentShapes } from '../core/Utils';
import { PluginRegistry } from '../plugins/index';

export class ShapeTool implements ToolDefinition {
  private drawStartWorld: { x: number; y: number } | null = null;
  private currentShapeId: string | null = null;
  private type: ShapeType;

  constructor(type: ShapeType) {
    this.type = type;
  }

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    this.drawStartWorld = payload.world;
    const preset = STYLE_PRESETS[this.type];
    const common: Partial<Shape> = {
      id: createId(),
      x: payload.world.x,
      y: payload.world.y,
      seed: Math.floor(Math.random() * 2 ** 31),
      stroke: preset?.stroke,
      fill: preset?.fill,
      strokeWidth: preset?.strokeWidth,
      opacity: preset?.opacity
    };

    let shape: Shape = { ...common, type: this.type } as Shape;
    
    if (PluginRegistry.hasPlugin(this.type)) {
      const plugin = PluginRegistry.getPlugin(this.type);
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
    if (!this.drawStartWorld || !this.currentShapeId) return;

    if (PluginRegistry.hasPlugin(this.type)) {
      const plugin = PluginRegistry.getPlugin(this.type);
      if (plugin.onDrawUpdate) {
        const state = api.getState();
        const shape = state.shapes.find(s => s.id === this.currentShapeId);
        if (shape) {
          const patch = plugin.onDrawUpdate(shape, payload, this.drawStartWorld, state.shapes, api);
          
          api.updateShape(this.currentShapeId, patch);

          const updatedShape = api.getState().shapes.find(s => s.id === this.currentShapeId);
          const bindShapeIds = [updatedShape?.startBinding?.elementId, updatedShape?.endBinding?.elementId].filter(Boolean) as string[];
          if (bindShapeIds.length > 0) {
            updateDependentShapes(api.getState(), api, bindShapeIds);
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

      if (this.type !== 'freehand' && this.type !== 'text' && distance < 2) {
        api.deleteShape(this.currentShapeId);
        api.setSelection([]);
      } else {
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
