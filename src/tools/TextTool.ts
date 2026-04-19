import type { ICanvasAPI, PointerPayload, ToolDefinition, Shape } from '../core/types';
import { getStylePreset, getCachedStyle } from '../core/constants';
import { createId } from '../core/Utils';

export class TextTool implements ToolDefinition {
  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    const preset = getCachedStyle('text');
    const shape: Shape = {
      ...preset,
      id: createId(),
      type: 'text',
      x: payload.world.x,
      y: payload.world.y,
      text: '', // Start empty
      fontFamily: "'Architects Daughter', cursive",
    } as Shape;
    
    api.addShape(shape);
    api.setState({ editingShapeId: shape.id, selectedIds: [] });
  }
}
