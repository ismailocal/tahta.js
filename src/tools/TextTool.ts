import type { ICanvasAPI, PointerPayload, ToolDefinition, Shape } from '../core/types';
import { STYLE_PRESETS } from '../core/constants';
import { createId } from '../core/Utils';

export class TextTool implements ToolDefinition {
  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    const preset = STYLE_PRESETS.text;
    const shape: Shape = {
      id: createId(),
      type: 'text',
      x: payload.world.x,
      y: payload.world.y,
      text: '', // Start empty
      fontSize: preset.fontSize,
      fontFamily: "'Architects Daughter', cursive",
      stroke: preset.stroke,
      opacity: preset.opacity,
    };
    
    api.addShape(shape);
    api.setTool('select');
    api.setState({ editingShapeId: shape.id, selectedIds: [] }); // Switch back to select tool so they can click elsewhere
  }
}
