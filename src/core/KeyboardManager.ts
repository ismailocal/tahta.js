import type { ICanvasAPI, ToolDefinition, Shape } from './types';

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
