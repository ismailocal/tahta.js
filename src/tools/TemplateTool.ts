import type { ToolDefinition, ICanvasAPI, PointerPayload } from '../core/types';
import { TEMPLATES, instantiateTemplate } from './templates';

export class TemplateTool implements ToolDefinition {
  constructor(private templateKey: string) {}

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    const template = TEMPLATES[this.templateKey];
    if (!template) return;
    const shapes = instantiateTemplate(template, payload.world);
    shapes.forEach(s => api.addShape(s));
    api.setState({ selectedIds: shapes.map(s => s.id) });
    api.commitState();
    api.setTool('select', true);
  }
}
