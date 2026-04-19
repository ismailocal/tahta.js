import { WhiteboardStore } from '../../core/Store';
import { TOOLBAR_ITEMS } from '../../core/constants';
import { hexToRgba, createId } from '../../core/Utils';
import { initPropertiesPanel, renderPropertiesPanelHTML } from './PropertiesPanel';
import { initTextEditor } from './TextEditor';
import { initLayersPanel } from './LayersPanel';
import { imageCache } from '../../plugins/ImagePlugin';
import type { ICanvasAPI } from '../../core/types';

function calculateZoomToCenter(canvas: HTMLCanvasElement, currentZoom: number, newZoom: number, viewport: { x: number; y: number; zoom: number }) {
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  // World coordinates of center before zoom
  const worldCenterX = (centerX - viewport.x) / currentZoom;
  const worldCenterY = (centerY - viewport.y) / currentZoom;

  // New scroll position to keep center at same world coordinates
  const newX = centerX - worldCenterX * newZoom;
  const newY = centerY - worldCenterY * newZoom;

  return { x: newX, y: newY, zoom: newZoom };
}

export function createUI(root: HTMLElement, store: WhiteboardStore, canvas: HTMLCanvasElement, api: ICanvasAPI) {
  root.innerHTML = `
    <div class="tahta-shell">
      <div class="board-shell">
        <div class="toolbar-wrap">
          <div class="toolbar" data-toolbar></div>
        </div>
        <section class="board-area">
          <div class="properties-panel" data-properties></div>
          <div class="zoom-controls" data-zoom-controls>
            <button class="zoom-btn" data-zoom-fit title="Focus Content">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M3 17v2a2 2 0 0 1 2 2h2"/></svg>
            </button>
            <div class="zoom-separator"></div>
            <button class="zoom-btn" data-zoom-out title="Zoom Out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <span class="zoom-value" data-zoom-value title="Reset Zoom">100%</span>
            <button class="zoom-btn" data-zoom-in title="Zoom In">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
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
  const zoomControls = root.querySelector('[data-zoom-controls]') as HTMLElement;
  const zoomValue = root.querySelector('[data-zoom-value]') as HTMLElement;

  const ZOOM_STEP = 0.1;
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 5;

  const renderZoomValue = (state: any) => {
    const zoom = state.viewport?.zoom || 1;
    const zoomPercent = Math.round(zoom * 100);
    if (zoomValue) {
      zoomValue.textContent = `${zoomPercent}%`;
    }

    // Update button disabled states
    const zoomInBtn = root.querySelector('[data-zoom-in]') as HTMLButtonElement;
    const zoomOutBtn = root.querySelector('[data-zoom-out]') as HTMLButtonElement;
    if (zoomInBtn) zoomInBtn.disabled = zoom >= MAX_ZOOM;
    if (zoomOutBtn) zoomOutBtn.disabled = zoom <= MIN_ZOOM;
  };

  // Zoom control event handlers
  zoomControls?.querySelector('[data-zoom-fit]')?.addEventListener('click', () => {
    api.scrollToContent?.();
  });

  zoomControls?.querySelector('[data-zoom-in]')?.addEventListener('click', () => {
    const state = store.getState();
    const currentZoom = state.viewport?.zoom || 1;
    const newZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
    const viewport = state.viewport || { x: 0, y: 0, zoom: 1 };

    const canvasEl = document.querySelector('.board-canvas') as HTMLCanvasElement;
    if (canvasEl) {
      const newViewport = calculateZoomToCenter(canvasEl, currentZoom, newZoom, viewport);
      store.setViewport(newViewport);
    } else {
      store.setViewport({ ...viewport, zoom: newZoom });
    }
  });

  zoomControls?.querySelector('[data-zoom-out]')?.addEventListener('click', () => {
    const state = store.getState();
    const currentZoom = state.viewport?.zoom || 1;
    const newZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
    const viewport = state.viewport || { x: 0, y: 0, zoom: 1 };

    const canvasEl = document.querySelector('.board-canvas') as HTMLCanvasElement;
    if (canvasEl) {
      const newViewport = calculateZoomToCenter(canvasEl, currentZoom, newZoom, viewport);
      store.setViewport(newViewport);
    } else {
      store.setViewport({ ...viewport, zoom: newZoom });
    }
  });

  zoomValue?.addEventListener('click', () => {
    const state = store.getState();
    const viewport = state.viewport || { x: 0, y: 0, zoom: 1 };

    const canvasEl = document.querySelector('.board-canvas') as HTMLCanvasElement;
    if (canvasEl) {
      const newViewport = calculateZoomToCenter(canvasEl, viewport.zoom || 1, 1, viewport);
      store.setViewport(newViewport);
    } else {
      store.setViewport({ ...viewport, zoom: 1 });
    }
  });

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

    const isDrawingTool = [
      'rectangle', 'ellipse', 'diamond', 'triangle', 'sticky-note',
      'arrow', 'freehand', 'text', 'db-table', 'db-view', 'db-enum',
      'hexagon', 'star', 'parallelogram', 'cylinder', 'cloud', 'callout'
    ].includes(state.activeTool);

    if (selectedShapes.length === 0 && !isDrawingTool) {
      properties.classList.add('hidden');
      properties.innerHTML = '';
      return;
    }

    properties.classList.remove('hidden');
    properties.innerHTML = renderPropertiesPanelHTML(api);

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

  initPropertiesPanel(properties, api);
  const disposeLayers = initLayersPanel(root, store, canvas, api);

  root.querySelector('.tahta-shell')?.addEventListener('click', (event: Event) => {
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
            const id = createId();

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
    if (tool) {
      // Clear space panning state when manually selecting a tool to prevent hand tool override
      store.setState({ isSpacePanning: false, isPanning: false });
      store.setTool(tool);
      return;
    }
  });


  const renderCursor = (state: any) => {
    let cursor = 'default';
    if (state.isSpacePanning || state.activeTool === 'hand') {
      cursor = state.isPanning ? 'grabbing' : 'grab';
    } else if (state.activeTool === 'text') {
      cursor = 'text';
    } else if (['rectangle', 'ellipse',
                'arrow',
                'freehand',
                'eraser', 'diamond', 'db-table', 'db-view', 'db-enum',
                'triangle', 'hexagon', 'star', 'parallelogram',
                'cylinder', 'cloud', 'callout', 'sticky-note'].includes(state.activeTool)) {
      cursor = 'crosshair';
    } else if (state.activeTool === 'comment') {
      cursor = 'url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2ZjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNy45IDIwQTkgOSAwIDEgMCA0IDE2LjFMMiAyMloiLz48L3N2Zz4=) 2 18, pointer';
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
      renderZoomValue(state);

      // Sync theme class to tahta-shell
      const shell = root.querySelector('.tahta-shell');
      if (shell) {
        if (state.theme === 'dark') {
          shell.classList.add('dark');
        } else {
          shell.classList.remove('dark');
        }
      }
    });
  });

  renderToolbar(store.getState());
  renderProperties(store.getState());
  renderCursor(store.getState());
  renderZoomValue(store.getState());
  
  const initialShell = root.querySelector('.tahta-shell');
  if (initialShell) {
    if (store.getState().theme === 'dark') {
      initialShell.classList.add('dark');
    } else {
      initialShell.classList.remove('dark');
    }
  }

  return () => {
    unsubUI();
    disposeLayers();
    document.removeEventListener('click', onDocumentClick);
  };
}
