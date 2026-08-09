import type { ToolDefinition, ICanvasAPI, PointerPayload } from '../core/types';
import { TEMPLATES, instantiateTemplate } from './templates';
import { UserTemplateManager } from './UserTemplateManager';

export class TemplateTool implements ToolDefinition {
  private templateKey: string;
  constructor(templateKey: string) {
    this.templateKey = templateKey;
  }

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    let template = TEMPLATES[this.templateKey];
    if (!template) {
      const userTemplates = UserTemplateManager.getTemplates();
      // Remove 'template-' prefix if it exists (it comes from the tool key)
      const userKey = this.templateKey.startsWith('template-') ? this.templateKey.replace('template-', '') : this.templateKey;
      template = userTemplates[userKey];
    }
    
    if (!template) return;
    const shapes = instantiateTemplate(template, payload.world);
    shapes.forEach(s => api.addShape(s));
    api.setState({ selectedIds: shapes.map(s => s.id) });
    api.commitState();
    api.setTool('select', true);
  }
}
