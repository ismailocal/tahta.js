import type { ICanvasAPI, Shape } from '../core/types';
export { renderPropertiesPanelHTML } from './PropertiesHTML';

export function initPropertiesPanel(container: HTMLElement, api: ICanvasAPI) {
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-prop]');
    if (btn) {
      const prop = btn.getAttribute('data-prop')!;
      const val = btn.getAttribute('data-val')!;
      
      const state = api.getState();
      const selectedIds = state.selectedIds;
      if (selectedIds.length > 0) {
        if (prop === 'action') {
          if (val === 'delete') {
            selectedIds.forEach((id: string) => api.deleteShape(id));
            api.setSelection([]);
            api.commitState();
          } else if (val === 'duplicate') {
            const newIds: string[] = [];
            selectedIds.forEach((id: string) => {
              const oldShape = state.shapes.find((s: Shape) => s.id === id);
              if (oldShape) {
                const newShape = { ...oldShape, id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9), x: oldShape.x + 10, y: oldShape.y + 10 };
                api.addShape(newShape);
                newIds.push(newShape.id);
              }
            });
            api.setSelection(newIds);
            api.commitState();
          } else if (val === 'group') {
            const groupId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            selectedIds.forEach((id: string) => api.updateShape(id, { groupId }));
            api.commitState();
          } else if (val === 'ungroup') {
            selectedIds.forEach((id: string) => api.updateShape(id, { groupId: undefined }));
            api.commitState();
          } else if (val === 'toggle-lock') {
            const allLocked = selectedIds.every((id: string) => state.shapes.find((s: Shape) => s.id === id)?.locked);
            selectedIds.forEach((id: string) => api.updateShape(id, { locked: !allLocked }));
            api.commitState();
          }
          return;
        }

        if (prop === 'layer') {
          selectedIds.forEach((id: string) => api.reorderShape(id, val as any));
          return;
        }

        let parsedVal: any = val;
        if (prop === 'strokeWidth' || prop === 'roughness') {
          parsedVal = parseFloat(val);
        } else if (prop === 'locked') {
          parsedVal = val === 'true';
        }
        selectedIds.forEach((id: string) => api.updateShape(id, { [prop]: parsedVal }));
        api.commitState();
      }
    }
  });

  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.matches('[data-prop="opacity"]')) {
      const state = api.getState();
      const selectedIds = state.selectedIds;
      if (selectedIds.length > 0) {
        selectedIds.forEach((id: string) => api.updateShape(id, { opacity: parseInt(target.value) / 100 }));
      }
    }
  });

  container.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.matches('[data-prop="opacity"]')) {
      api.commitState();
    }
  });
}
