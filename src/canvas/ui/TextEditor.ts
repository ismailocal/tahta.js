import { WhiteboardStore } from '../../core/Store';
import { getShapeBounds } from '../../geometry/Geometry';
import { PluginRegistry } from '../../plugins/index';

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
        editor.style.setProperty('color', shape.textColor || shape.stroke || '#f8fafc', 'important');

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
        editor.style.setProperty('font-size', `${fontSz}px`, 'important');
        editor.style.setProperty('font-family', shape.fontFamily || "'Patrick Hand', cursive", 'important');
        editor.style.setProperty('color', shape.stroke || '#f8fafc', 'important');

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
          editor.style.textAlign = shape.textAlign || 'left';
          editor.style.transform = 'none';
        } else {
          let cx = 0;
          let cy = 0;

        if (PluginRegistry.hasPlugin(shape.type)) {
          const plugin = PluginRegistry.getPlugin(shape.type);
          const anchor = plugin.getTextAnchor ? plugin.getTextAnchor(shape, state.shapes) : null;
          if (anchor) {
            cx = anchor.x;
            cy = anchor.y;
            editor.style.left = `${offsetX + state.viewport.x + cx * zoom}px`;
            editor.style.top = `${offsetY + state.viewport.y + cy * zoom}px`;
            editor.style.marginTop = `0`;
            editor.style.textAlign = 'center';
            editor.style.transform = 'translate(-50%, -50%)';
          } else {
            const bounds = getShapeBounds(shape);
            const paddingX = (shape.textPaddingX ?? 8) * zoom;
            const paddingY = (shape.textPaddingY ?? 8) * zoom;
            const textAlign = shape.textAlign || 'center';
            const vertAlign = shape.textVerticalAlign || 'middle';

            const bx = offsetX + state.viewport.x + bounds.x * zoom;
            const by = offsetY + state.viewport.y + bounds.y * zoom;
            const bw = bounds.width * zoom;
            const bh = bounds.height * zoom;

            if (textAlign === 'left') {
              editor.style.left = `${bx + paddingX}px`;
              editor.style.transform = 'none';
            } else if (textAlign === 'right') {
              editor.style.left = `${bx + bw - paddingX}px`;
              editor.style.transform = 'translateX(-100%)';
            } else {
              editor.style.left = `${bx + bw / 2}px`;
              editor.style.transform = vertAlign === 'top' ? 'translateX(-50%)' : vertAlign === 'bottom' ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)';
            }

            if (vertAlign === 'top') {
              editor.style.top = `${by + paddingY}px`;
              if (textAlign !== 'center') editor.style.transform = 'none';
            } else if (vertAlign === 'bottom') {
              editor.style.top = `${by + bh - paddingY}px`;
              if (textAlign !== 'center') editor.style.transform = 'translateY(-100%)';
            } else {
              editor.style.top = `${by + bh / 2}px`;
              if (textAlign === 'left') editor.style.transform = 'translateY(-50%)';
              else if (textAlign === 'right') editor.style.transform = 'translate(-100%, -50%)';
            }

            editor.style.marginTop = `0`;
            editor.style.textAlign = textAlign;
          }
        } else {
          const bounds = getShapeBounds(shape);
          cx = bounds.x + bounds.width / 2;
          cy = bounds.y + bounds.height / 2;
          editor.style.left = `${offsetX + state.viewport.x + cx * zoom}px`;
          editor.style.top = `${offsetY + state.viewport.y + cy * zoom}px`;
          editor.style.marginTop = `0`;
          editor.style.textAlign = 'center';
          editor.style.transform = 'translate(-50%, -50%)';
        }
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
      let selectedId: string | null = currentEditingId;

      if (shape && shape.type === 'text' && (!shape.text || shape.text.trim() === '')) {
        store.deleteShape(currentEditingId);
        selectedId = null;
      }

      store.setState({
        editingShapeId: null,
        selectedIds: selectedId ? [selectedId] : [],
        activeTool: 'select'
      });

      if (shape && !selectedId) {
        // Shape silindi, commit gerek yok
      } else {
        store.commitState();
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      editor.blur();
    } else if (e.key === 'Enter' && !e.shiftKey) {
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
