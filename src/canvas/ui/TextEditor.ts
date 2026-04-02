import { WhiteboardStore } from '../../core/Store';
import { getShapeBounds, getArrowClippedEndpoints } from '../../geometry/Geometry';
import { getElbowPath, getPathMidpoint } from '../../geometry/lineUtils';

export function initTextEditor(container: HTMLElement, store: WhiteboardStore) {
  const overlay = document.createElement('div');
  overlay.className = 'text-editor-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.overflow = 'hidden';
  container.appendChild(overlay);

  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.style.position = 'absolute';
  editor.style.pointerEvents = 'auto';
  editor.style.background = 'transparent';
  editor.style.border = 'none';
  editor.style.outline = 'none';
  editor.style.whiteSpace = 'pre';
  editor.style.wordWrap = 'normal';
  editor.style.padding = '0';
  editor.style.margin = '0';
  editor.style.lineHeight = '1.2';
  editor.style.fontFamily = "'Architects Daughter', cursive";
  editor.style.boxSizing = 'content-box';
  editor.style.textAlign = 'left';
  editor.style.transform = 'none';
  editor.style.minWidth = '2px';
  editor.style.minHeight = '1em';

  editor.style.display = 'none';
  overlay.appendChild(editor);

  let currentEditingId: string | null = null;
  let unsubscribe: (() => void) | null = null;

  const syncTextarea = () => {
    const state = store.getState();
    const editingId = state.editingShapeId;

    if (editingId !== currentEditingId) {
      currentEditingId = editingId || null;
      if (!currentEditingId) {
        editor.style.display = 'none';
        editor.blur();
        return;
      }

      const shape = state.shapes.find(s => s.id === currentEditingId);
      if (shape) {
        editor.innerText = shape.text || '';
        editor.style.display = 'block';
        editor.style.color = shape.stroke || '#f8fafc';

        setTimeout(() => {
          editor.focus();
          const range = document.createRange();
          const sel = window.getSelection();
          if (sel && editor.childNodes.length > 0) {
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }, 0);
      } else {
        store.setState({ editingShapeId: null });
      }
    }

    if (currentEditingId) {
      const shape = state.shapes.find(s => s.id === currentEditingId);
      if (shape) {
        const zoom = state.viewport.zoom;
        const fontSz = (shape.fontSize || 20) * zoom;
        editor.style.fontSize = `${fontSz}px`;
        editor.style.fontFamily = shape.fontFamily || "'Architects Daughter', cursive";

        const canvasEl = document.querySelector('.board-canvas');
        let offsetX = 0;
        let offsetY = 0;
        if (canvasEl) {
          const cRect = canvasEl.getBoundingClientRect();
          const oRect = overlay.getBoundingClientRect();
          offsetX = cRect.left - oRect.left;
          offsetY = cRect.top - oRect.top;
        }

        if (shape.type === 'text') {
          editor.style.left = `${offsetX + state.viewport.x + shape.x * zoom}px`;
          editor.style.top = `${offsetY + state.viewport.y + shape.y * zoom}px`;
          editor.style.marginTop = `-${fontSz * 0.16}px`;
          editor.style.textAlign = 'left';
          editor.style.transform = 'none';
        } else {
          let cx = 0;
          let cy = 0;
          if (shape.type === 'arrow' || shape.type === 'line') {
            const { p1, p2 } = getArrowClippedEndpoints(shape, state.shapes);
            if (shape.edgeStyle === 'elbow') {
              const b1 = shape.startBinding ? state.shapes.find(s => s.id === shape.startBinding!.elementId) : undefined;
              const b2 = shape.endBinding ? state.shapes.find(s => s.id === shape.endBinding!.elementId) : undefined;
              const path = getElbowPath(p1, p2);
              const mid = getPathMidpoint(path);
              cx = mid.x;
              cy = mid.y;
            } else {
              cx = (p1.x + p2.x) / 2;
              cy = (p1.y + p2.y) / 2;
            }
          } else {
            const bounds = getShapeBounds(shape);
            cx = bounds.x + bounds.width / 2;
            cy = bounds.y + bounds.height / 2;
          }
          
          editor.style.left = `${offsetX + state.viewport.x + cx * zoom}px`;
          editor.style.top = `${offsetY + state.viewport.y + cy * zoom}px`;
          editor.style.marginTop = `0`;
          editor.style.textAlign = 'center';
          editor.style.transform = 'translate(-50%, -50%)';
        }
      }
    }
  };

  const handleInput = () => {
    if (currentEditingId) {
      const state = store.getState();
      const shape = state.shapes.find(s => s.id === currentEditingId);
      if (shape) {
        store.updateShape(currentEditingId, { text: editor.innerText });
      }
      syncTextarea();
    }
  };

  const handleBlur = () => {
    if (currentEditingId) {
      const state = store.getState();
      const shape = state.shapes.find(s => s.id === currentEditingId);
      if (shape && shape.type === 'text' && (!shape.text || shape.text.trim() === '')) {
        store.deleteShape(currentEditingId);
      } else if (shape) {
        store.commitState();
      }
      store.setState({ editingShapeId: null, selectedIds: shape ? [shape.id] : [] });
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      editor.blur();
    }
    e.stopPropagation();
  };

  editor.addEventListener('input', handleInput);
  editor.addEventListener('blur', handleBlur);
  editor.addEventListener('keydown', handleKeyDown);

  unsubscribe = store.subscribe(syncTextarea);

  return () => {
    if (unsubscribe) unsubscribe();
    editor.removeEventListener('input', handleInput);
    editor.removeEventListener('blur', handleBlur);
    editor.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
  };
}
