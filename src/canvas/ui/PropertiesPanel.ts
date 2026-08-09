import type { ICanvasAPI, Shape } from '../../core/types';
import { createId } from '../../core/Utils';
import { cacheStyle } from '../../core/constants';
import { UserTemplateManager } from '../../tools/UserTemplateManager';
import { selectionToTemplate } from '../../tools/templates';
export { renderPropertiesPanelHTML } from './PropertiesHTML';

function handleActionClick(val: string, selectedIds: string[], api: ICanvasAPI) {
  if (val === 'delete') {
    selectedIds.forEach((id: string) => api.deleteShape(id));
    api.setSelection([]);
    api.commitState();
  } else if (val === 'duplicate') {
    const newIds: string[] = [];
    const state = api.getState();
    selectedIds.forEach((id: string) => {
      const oldShape = state.shapes.find((s: Shape) => s.id === id);
      if (oldShape) {
        const newShape = { ...oldShape, id: createId(), x: oldShape.x + 10, y: oldShape.y + 10 };
        api.addShape(newShape);
        newIds.push(newShape.id);
      }
    });
    api.setSelection(newIds);
    api.commitState();
  } else if (val === 'group') {
    const groupId = createId();
    selectedIds.forEach((id: string) => api.updateShape(id, { groupId }));
    api.commitState();
  } else if (val === 'ungroup') {
    selectedIds.forEach((id: string) => api.updateShape(id, { groupId: undefined }));
    api.commitState();
  } else if (val === 'toggle-lock') {
    const state = api.getState();
    const allLocked = selectedIds.every((id: string) => state.shapes.find((s: Shape) => s.id === id)?.locked);
    selectedIds.forEach((id: string) => api.updateShape(id, { locked: !allLocked }));
    api.commitState();
  } else if (val === 'create-template') {
    const state = api.getState();
    const selectedShapes = state.shapes.filter((s: Shape) => selectedIds.includes(s.id));
    if (selectedShapes.length === 0) return;

    const name = prompt('Template Name:', 'My Custom Template');
    if (name) {
      const template = selectionToTemplate(name, selectedShapes);
      UserTemplateManager.addTemplate(name, template);
      // We might need to refresh the UI to show the new template in the library
      api.forceNotify();
      alert('Template saved to library!');
    }
  }
}

function handleLayerClick(val: string, selectedIds: string[], api: ICanvasAPI) {
  selectedIds.forEach((id: string) => api.reorderShape(id, val as any));
}

function handleMultiPropClick(prop: string, val: string, selectedIds: string[], api: ICanvasAPI) {
  const propKeys = prop.split('|');
  const propVals = val.split('|');
  const patch: Record<string, any> = {};
  propKeys.forEach((k, i) => { patch[k] = propVals[i]; });
  
  const state = api.getState();
  
  // Eğer seçili şekil yoksa ama aktif bir çizim aracı varsa, style'ı cache'le
  const isDrawingTool = [
    'rectangle', 'ellipse', 'diamond', 'triangle', 'sticky-note',
    'arrow', 'freehand', 'text', 'db-table', 'db-view', 'db-enum',
    'hexagon', 'star', 'parallelogram', 'cylinder', 'cloud', 'callout'
  ].includes(state.activeTool);
  
  if (selectedIds.length === 0 && isDrawingTool) {
    // Style'ı cache'le
    cacheStyle(state.activeTool, patch);
    // Panelin re-render edilmesi için force notify
    api.forceNotify();
    return;
  }
  
  selectedIds.forEach((id: string) => api.updateShape(id, patch));
  api.commitState();
}

function handlePropClick(prop: string, val: string, selectedIds: string[], api: ICanvasAPI) {
  let parsedVal: any = val;
  if (prop === 'strokeWidth' || prop === 'roughness' || prop === 'opacity' || prop === 'cornerRadius' || prop === 'fontSize') {
    parsedVal = parseFloat(val);
  } else if (prop === 'locked') {
    parsedVal = val === 'true';
  }
  
  const state = api.getState();
  
  // Eğer seçili şekil yoksa ama aktif bir çizim aracı varsa, style'ı cache'le
  const isDrawingTool = [
    'rectangle', 'ellipse', 'diamond', 'triangle', 'sticky-note',
    'arrow', 'freehand', 'text', 'db-table', 'db-view', 'db-enum',
    'hexagon', 'star', 'parallelogram', 'cylinder', 'cloud', 'callout'
  ].includes(state.activeTool);
  
  if (selectedIds.length === 0 && isDrawingTool) {
    // Style'ı cache'le
    cacheStyle(state.activeTool, { [prop]: parsedVal });
    // Panelin re-render edilmesi için force notify
    api.forceNotify();
    return;
  }
  
  if (prop === 'canvasBackground') {
    api.setState({ canvasBackground: val });
    api.commitState();
    return;
  }
  
  selectedIds.forEach((id: string) => api.updateShape(id, { [prop]: parsedVal }));
  api.commitState();
}

function handleOpacityInput(target: HTMLInputElement, api: ICanvasAPI) {
  const state = api.getState();
  const selectedIds = state.selectedIds;
  
  // Eğer seçili şekil yoksa ama aktif bir çizim aracı varsa, style'ı cache'le
  const isDrawingTool = [
    'rectangle', 'ellipse', 'diamond', 'triangle', 'sticky-note',
    'arrow', 'freehand', 'text', 'db-table', 'db-view', 'db-enum',
    'hexagon', 'star', 'parallelogram', 'cylinder', 'cloud', 'callout'
  ].includes(state.activeTool);
  
  if (selectedIds.length === 0 && isDrawingTool) {
    // Style'ı cache'le (opacity değişikliği)
    cacheStyle(state.activeTool, { opacity: parseInt(target.value) / 100 });
    // Panelin re-render edilmesi için force notify
    api.forceNotify();
    return;
  }
  
  if (selectedIds.length > 0) {
    selectedIds.forEach((id: string) => api.updateShape(id, { opacity: parseInt(target.value) / 100 }));
  }
}

function handleOpacityChange(api: ICanvasAPI) {
  const state = api.getState();
  const selectedIds = state.selectedIds;
  
  // Eğer seçili şekil yoksa ama aktif bir çizim aracı varsa, commit yapma
  const isDrawingTool = [
    'rectangle', 'ellipse', 'diamond', 'triangle', 'sticky-note',
    'arrow', 'freehand', 'text', 'db-table', 'db-view', 'db-enum',
    'hexagon', 'star', 'parallelogram', 'cylinder', 'cloud', 'callout'
  ].includes(state.activeTool);
  
  if (selectedIds.length === 0 && isDrawingTool) {
    return;
  }
  
  api.commitState();
}

export function initPropertiesPanel(container: HTMLElement, api: ICanvasAPI) {
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-prop]');
    if (btn) {
      const prop = btn.getAttribute('data-prop')!;
      const val = btn.getAttribute('data-val')!;
      
      const state = api.getState();
      const selectedIds = state.selectedIds;
      
      if (prop === 'action') {
        if (selectedIds.length > 0) {
          handleActionClick(val, selectedIds, api);
        }
        return;
      }

      if (prop === 'layer') {
        if (selectedIds.length > 0) {
          handleLayerClick(val, selectedIds, api);
        }
        return;
      }

      // Support multi-prop: "propA|propB" with "valA|valB"
      if (prop.includes('|')) {
        handleMultiPropClick(prop, val, selectedIds, api);
        return;
      }

      handlePropClick(prop, val, selectedIds, api);
    }
  });

  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.matches('[data-prop="opacity"]')) {
      handleOpacityInput(target, api);
    }
  });

  container.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.matches('[data-prop="opacity"]')) {
      handleOpacityChange(api);
    }
  });
}
