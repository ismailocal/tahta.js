import { WhiteboardStore } from '../core/Store';
import { TOOLBAR_ITEMS } from '../core/constants';
import { hexToRgba } from '../core/Utils';
import { initPropertiesPanel, renderPropertiesPanelHTML } from './PropertiesPanel';
import { initTextEditor } from './TextEditor';
import { imageCache } from '../plugins/ImagePlugin';
import type { ICanvasAPI } from '../core/types';

export function createUI(root: HTMLElement, store: WhiteboardStore, canvas: HTMLCanvasElement, api: ICanvasAPI) {
  root.innerHTML = `
    <div class="app-shell">
      <div class="board-shell">
        <div class="toolbar-wrap">
          <div style="display: flex; gap: 8px;">
             <div class="toolbar" data-toolbar></div>
          </div>
        </div>
        <section class="board-area">
          <div class="properties-panel hidden" data-properties></div>
        </section>
      </div>
    </div>
  `;

  const boardArea = root.querySelector('.board-area') as HTMLElement;
  boardArea.appendChild(canvas);
  canvas.className = 'board-canvas';

  initTextEditor(boardArea, store);

  const toolbar = root.querySelector('[data-toolbar]') as HTMLElement;
  const properties = root.querySelector('[data-properties]') as HTMLElement;

  const DB_KEYS = new Set(['db-table', 'db-view', 'db-enum']);

  const renderToolbar = (state: any) => {
    const dbActive = DB_KEYS.has(state.activeTool);
    toolbar.innerHTML = TOOLBAR_ITEMS.map((tool) => {
      if (tool.isSeparator) return `<div class="toolbar-separator"></div>`;

      let disabled = false;
      if (tool.key === 'undo') disabled = !store.canUndo;
      if (tool.key === 'redo') disabled = !store.canRedo;

      if (tool.isDropdown && tool.children) {
        return `
          <div class="tool-dropdown-wrap" data-dropdown="${tool.key}">
            <button class="tool-button ${dbActive ? 'active' : ''}" data-dropdown-toggle="${tool.key}" title="${tool.label} (${tool.shortcut})">
              <span class="tool-icon">${tool.icon}</span>
              <span class="tool-dropdown-arrow">▾</span>
            </button>
            <div class="tool-dropdown-menu" id="dropdown-${tool.key}" style="display:none;">
              ${tool.children.map(child => `
                <button class="tool-dropdown-item ${state.activeTool === child.key ? 'active' : ''}" data-tool="${child.key}" title="${child.label}">
                  <span class="tool-icon">${child.icon}</span>
                  <span>${child.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      return `
        <button class="tool-button ${state.activeTool === tool.key ? 'active' : ''}" data-tool="${tool.key}" title="${tool.label} (${tool.shortcut})" ${disabled ? 'disabled' : ''}>
          <span class="tool-icon">${tool.icon}</span>
        </button>
      `;
    }).join('');

    // Attach dropdown toggle listeners after render
    toolbar.querySelectorAll<HTMLButtonElement>('[data-dropdown-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.getAttribute('data-dropdown-toggle')!;
        const menu = document.getElementById(`dropdown-${key}`);
        if (!menu) return;
        const isOpen = menu.style.display !== 'none';
        closeAllDropdowns();
        if (!isOpen) menu.style.display = 'flex';
      });
    });
  };

  function closeAllDropdowns() {
    toolbar.querySelectorAll<HTMLElement>('.tool-dropdown-menu').forEach(m => m.style.display = 'none');
  }

  document.addEventListener('click', () => closeAllDropdowns());

  const selectedShape = () => {
    const state = store.getState();
    return state.shapes.find((shape) => shape.id === state.selectedIds[0]) || null;
  };

  const renderProperties = () => {
    const shape = selectedShape();
    if (!shape) {
      properties.classList.add('hidden');
      properties.innerHTML = '';
      return;
    }
    properties.classList.remove('hidden');
    properties.innerHTML = renderPropertiesPanelHTML(api);
  };

  initPropertiesPanel(properties, api);

  root.querySelector('.app-shell')?.addEventListener('click', (event: Event) => {
    const target = event.target as HTMLElement;
    // Close dropdown if clicked inside dropdown item
    if (target.closest('.tool-dropdown-item')) closeAllDropdowns();
    const btn = target.closest('[data-tool]') as HTMLButtonElement | null;
    if (btn?.disabled) return;

    const tool = btn?.getAttribute('data-tool');
    if (tool === 'undo') { store.undo(); return; }
    if (tool === 'redo') { store.redo(); return; }
    if (tool === 'export') {
      const state = store.getState();
      const data = JSON.stringify(state, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tuval-canvas-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (tool === 'image') {
      event.preventDefault();
      event.stopImmediatePropagation();

      let input = document.getElementById('hidden-image-input') as HTMLInputElement;
      if (!input) {
        input = document.createElement('input');
        input.id = 'hidden-image-input';
        input.type = 'file';
        input.accept = 'image/*';
        input.style.position = 'absolute';
        input.style.width = '0';
        input.style.height = '0';
        input.style.opacity = '0';
        document.body.appendChild(input);
      }

      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (re) => {
          const imageSrc = re.target?.result as string;
          if (!imageSrc) return;
          const img = new Image();
          img.src = imageSrc;
          img.onload = () => {
            const state = store.getState();
            const rect = canvas.getBoundingClientRect();
            const screen = { x: rect.width / 2, y: rect.height / 2 };
            const worldX = (screen.x - state.viewport.x) / state.viewport.zoom;
            const worldY = (screen.y - state.viewport.y) / state.viewport.zoom;

            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const maxDim = 800;
            if (w > maxDim || h > maxDim) {
              const ratio = Math.min(maxDim / w, maxDim / h);
              w *= ratio; h *= ratio;
            }
            const id = Math.random().toString(36).slice(2, 10);

            imageCache.set(imageSrc, img);

            store.setState({
              shapes: [...state.shapes, {
                id, type: 'image', x: worldX - w / 2, y: worldY - h / 2, width: w, height: h, imageSrc, stroke: 'transparent',
                strokeWidth: 2, roughness: 1, opacity: 1
              } as any],
              selectedIds: [id]
            });
            store.commitState();

            input.value = '';
          };
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    if (tool) store.setTool(tool);
  });


  const renderCursor = (state: any) => {
    let cursor = 'default';
    if (state.isSpacePanning || state.activeTool === 'hand') {
      cursor = state.isPanning ? 'grabbing' : 'grab';
    } else if (state.activeTool === 'text') {
      cursor = 'text';
    } else if (['rectangle', 'ellipse', 'line', 'arrow', 'freehand', 'eraser', 'diamond', 'db-table', 'db-view', 'db-enum'].includes(state.activeTool)) {
      cursor = 'crosshair';
    } else {
      cursor = 'default';
    }
    
    if (canvas.style.cursor !== cursor) {
      canvas.style.cursor = cursor;
    }
  };

  store.subscribe((state) => {
    requestAnimationFrame(() => {
      renderToolbar(state);
      renderProperties();
      renderCursor(state);
    });
  });

  renderToolbar(store.getState());
  renderProperties();
  renderCursor(store.getState());
}
