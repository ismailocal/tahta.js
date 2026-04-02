import { WhiteboardStore } from '../../core/Store';
import { TOOLBAR_ITEMS } from '../../core/constants';
import { hexToRgba } from '../../core/Utils';
import { initPropertiesPanel, renderPropertiesPanelHTML } from './PropertiesPanel';
import { initTextEditor } from './TextEditor';
import { imageCache } from '../../plugins/ImagePlugin';
import type { ICanvasAPI } from '../../core/types';

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

  const renderToolbar = (state: any) => {
    toolbar.innerHTML = TOOLBAR_ITEMS.map((tool) => {
      if (tool.isSeparator) return `<div class="toolbar-separator"></div>`;

      let disabled = false;
      if (tool.key === 'undo') disabled = !store.canUndo;
      if (tool.key === 'redo') disabled = !store.canRedo;

      if (tool.isDropdown && tool.children) {
        const activeChild = tool.children.find(c => c.key === state.activeTool);
        const displayIcon = (activeChild || tool.children[0]).icon;
        const displayLabel = activeChild ? activeChild.label : tool.label;
        const groupActive = !!activeChild;
        // The parent button sets the currently active child tool (or first child)
        const parentToolKey = (activeChild || tool.children[0]).key;
        return `
          <div class="tool-dropdown-wrap" data-dropdown="${tool.key}">
            <button class="tool-button ${groupActive ? 'active' : ''}" data-tool="${parentToolKey}" title="${displayLabel}" aria-label="${displayLabel}">
              <span class="tool-icon">${displayIcon}</span>
              <span class="tool-dropdown-arrow">▾</span>
            </button>
            <div class="tool-dropdown-menu" id="dropdown-${tool.key}">
              ${tool.children.map(child => `
                <button class="tool-dropdown-item ${state.activeTool === child.key ? 'active' : ''}" data-tool="${child.key}" title="${child.label}" aria-label="${child.label}">
                  <span class="tool-icon">${child.icon}</span>
                  <span>${child.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      return `
        <button class="tool-button ${state.activeTool === tool.key ? 'active' : ''}" data-tool="${tool.key}" title="${tool.label} (${tool.shortcut})" ${disabled ? 'disabled' : ''} aria-label="${tool.label}">
          <span class="tool-icon">${tool.icon}</span>
        </button>
      `;
    }).join('');

    // Hover-based dropdown open/close
    toolbar.querySelectorAll<HTMLElement>('.tool-dropdown-wrap').forEach(wrap => {
      const menu = wrap.querySelector<HTMLElement>('.tool-dropdown-menu');
      if (!menu) return;
      let closeTimer: ReturnType<typeof setTimeout> | null = null;

      wrap.addEventListener('mouseenter', () => {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        closeAllDropdowns();
        menu.classList.add('open');
      });
      wrap.addEventListener('mouseleave', () => {
        closeTimer = setTimeout(() => menu.classList.remove('open'), 120);
      });
      menu.addEventListener('mouseenter', () => {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      });
      menu.addEventListener('mouseleave', () => {
        closeTimer = setTimeout(() => menu.classList.remove('open'), 120);
      });
    });
  };

  function closeAllDropdowns() {
    toolbar.querySelectorAll<HTMLElement>('.tool-dropdown-menu').forEach(m => m.classList.remove('open'));
  }

  const onDocumentClick = () => closeAllDropdowns();
  document.addEventListener('click', onDocumentClick);

  const renderProperties = (state: any) => {
    const selectedShapes = state.selectedIds
      .map((id: string) => state.shapes.find((s: any) => s.id === id))
      .filter((s: any) => !!s);

    if (selectedShapes.length === 0) {
      properties.classList.add('hidden');
      properties.innerHTML = '';
      return;
    }
    
    properties.classList.remove('hidden');
    properties.innerHTML = renderPropertiesPanelHTML(api);

    // Dynamic positioning above selection
    const bounds = getSelectionBounds(selectedShapes);
    const zoom = state.viewport.zoom;
    const vx = state.viewport.x;
    const vy = state.viewport.y;

    const screenTop = (bounds.minY * zoom) + vy;
    const screenLeft = (bounds.minX * zoom) + vx;
    const screenRight = (bounds.maxX * zoom) + vx;
    const screenCenterX = (screenLeft + screenRight) / 2;

    // Position panel
    properties.style.top = `${screenTop - 54}px`; // 44px height + 10px gap
    properties.style.left = `${screenCenterX}px`;
    properties.style.right = 'auto'; // Reset right: 16px from CSS
    properties.style.transform = 'translateX(-50%)';

    // Hover-based dropdown for property panel
    properties.querySelectorAll<HTMLElement>('.pp-dropdown-wrap').forEach(wrap => {
      const menu = wrap.querySelector<HTMLElement>('.pp-dropdown-menu');
      if (!menu) return;
      let closeTimer: ReturnType<typeof setTimeout> | null = null;
      wrap.addEventListener('mouseenter', () => {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        properties.querySelectorAll('.pp-dropdown-menu').forEach(m => m.classList.remove('open'));
        menu.classList.add('open');
      });
      wrap.addEventListener('mouseleave', () => {
        closeTimer = setTimeout(() => menu.classList.remove('open'), 150);
      });
    });
  };

  function getSelectionBounds(shapes: any[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapes.forEach(s => {
      if (s.points && Array.isArray(s.points)) {
        s.points.forEach((p: any) => {
          const px = s.x + (p.x !== undefined ? p.x : p[0]);
          const py = s.y + (p.y !== undefined ? p.y : p[1]);
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        });
      } else {
        const w = s.width || 0;
        const h = s.height || 0;
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + w);
        maxY = Math.max(maxY, s.y + h);
      }
    });
    return { minX, minY, maxX, maxY };
  }

  initPropertiesPanel(properties, api);

  root.querySelector('.app-shell')?.addEventListener('click', (event: Event) => {
    const target = event.target as HTMLElement;
    // Close dropdowns if clicked
    if (target.closest('.tool-dropdown-item') || target.closest('.pp-ibtn') || target.closest('.pp-swatch')) {
      closeAllDropdowns();
      properties.querySelectorAll('.pp-dropdown-menu').forEach(m => m.classList.remove('open'));
    }
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
    } else if (['rectangle', 'ellipse', 'line', 'line-dashed', 'line-dotted',
                'arrow', 'arrow-double', 'arrow-elbow', 'arrow-curved', 'arrow-filled',
                'freehand', 'freehand-highlighter', 'freehand-thick',
                'eraser', 'diamond', 'db-table', 'db-view', 'db-enum'].includes(state.activeTool)) {
      cursor = 'crosshair';
    } else {
      cursor = 'default';
    }
    
    if (canvas.style.cursor !== cursor) {
      canvas.style.cursor = cursor;
    }
  };

  const unsubUI = store.subscribe((state) => {
    requestAnimationFrame(() => {
      renderToolbar(state);
      renderProperties(state);
      renderCursor(state);
    });
  });

  renderToolbar(store.getState());
  renderProperties(store.getState());
  renderCursor(store.getState());

  return () => {
    unsubUI();
    document.removeEventListener('click', onDocumentClick);
  };
}
