import type { ICanvasAPI, ToolDefinition, Shape } from '../core/types';

export function setupKeyboard(
  api: ICanvasAPI,
  tools: Record<string, ToolDefinition>,
  setActiveOverrideTool: (tool: string | null) => void
): (() => void)[] {
  const onKeyDown = (e: KeyboardEvent) => {
    const active = api.getState().activeTool;
    if (e.code === 'Space' && !api.getState().isSpacePanning) {
      api.setState({ isSpacePanning: true });
      setActiveOverrideTool('hand');
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          api.redo();
        } else {
          api.undo();
        }
        return;
      }
      if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        api.redo();
        return;
      }
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        const state = api.getState();
        if (state.selectedIds.length > 0) {
          const shapes = state.selectedIds.map(id => state.shapes.find(s => s.id === id)).filter(Boolean) as Shape[];
          const allLocked = shapes.every(s => s.locked);
          shapes.forEach(s => api.updateShape(s.id, { locked: !allLocked }));
          api.commitState();
        }
        return;
      }
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const state = api.getState();
        api.setSelection(state.shapes.map(s => s.id));
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const state = api.getState();
        const selectedIds = state.selectedIds;
        if (selectedIds.length > 1) {
          const groupId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
          selectedIds.forEach(id => api.updateShape(id, { groupId }));
          api.commitState();
        } else if (selectedIds.length > 0) {
          // Ungroup if single grouped shape set is selected
          const shapes = selectedIds.map(id => state.shapes.find(s => s.id === id)).filter(Boolean) as Shape[];
          const groupIds = new Set(shapes.map(s => s.groupId).filter(Boolean));
          if (groupIds.size > 0) {
            const allInGroup = state.shapes.filter(s => groupIds.has(s.groupId));
            allInGroup.forEach(s => api.updateShape(s.id, { groupId: undefined }));
            api.commitState();
          }
        }
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        api.setViewport({ x: 0, y: 0, zoom: 1 });
        return;
      }
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        const vp = api.getState().viewport;
        api.setViewport({ ...vp, zoom: Math.min(5, vp.zoom * 1.2) });
        return;
      }
      if (e.key === '-') {
        e.preventDefault();
        const vp = api.getState().viewport;
        api.setViewport({ ...vp, zoom: Math.max(0.1, vp.zoom / 1.2) });
        return;
      }
    }

    if (e.key === 'Escape') {
      const state = api.getState();
      if (state.drawingShapeId) {
        api.deleteShape(state.drawingShapeId);
        api.setState({ drawingShapeId: null });
      }
      api.setSelection([]);
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && active === 'select') {
      const tool = tools.select;
      if (tool?.onKeyDown) tool.onKeyDown(e, api);
    }

    const activeElement = document.activeElement;
    const isInputFocused = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
    
    if (!isInputFocused && !e.ctrlKey && !e.metaKey) {
      if (e.key === 'v') api.setTool('select');
      if (e.key === 'h') api.setTool('hand');
      if (e.key === 'r') api.setTool('rectangle');
      if (e.key === 'e') api.setTool('ellipse');
      if (e.key === 'd') api.setTool('diamond');
      if (e.key === 'l') api.setTool('line');
      if (e.key === 'a') api.setTool('arrow');
      if (e.key === 'p') api.setTool('freehand');
      if (e.key === 'x') api.setTool('eraser');
      if (e.key === 't') api.setTool('text');
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      api.setState({ isSpacePanning: false, isPanning: false });
      setActiveOverrideTool(null);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return [
    () => window.removeEventListener('keydown', onKeyDown),
    () => window.removeEventListener('keyup', onKeyUp),
  ];
}
