import { WhiteboardStore } from '../../core/Store';
import { TOOLBAR_ITEMS, type ToolbarItem } from '../../core/constants';
import { hexToRgba, createId } from '../../core/Utils';
import { UserTemplateManager } from '../../tools/UserTemplateManager';
import { initPropertiesPanel, renderPropertiesPanelHTML } from './PropertiesPanel';
import { initTextEditor } from './TextEditor';
import { imageCache } from '../../plugins/ImagePlugin';
import { confirmModal } from './Modal';
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
            <button class="layers-toggle-btn" data-layers-toggle title="Open Layers">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              <span class="layers-badge" data-layers-badge></span>
            </button>
            <div class="zoom-separator"></div>
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
        const displayIcon = tool.icon || (activeChild || tool.children[0]).icon;
        const displayLabel = tool.label;
        const groupActive = !!activeChild;
        // The parent button sets the currently active child tool (or first child)
        const parentToolKey = (activeChild || tool.children[0]).key;
        return `
          <div class="tool-dropdown-wrap" data-dropdown="${tool.key}">
            <button class="tool-button ${groupActive ? 'active' : ''}" data-tool-group="${tool.key}" title="${displayLabel}" aria-label="${displayLabel}">
              <span class="tool-icon">${displayIcon}</span>
            </button>
            <div class="tool-dropdown-menu dropdown-grid-6" id="dropdown-${tool.key}">
              ${(() => {
                let children = [...tool.children];
                if (tool.key === 'library-group') {
                  const userTemplates = UserTemplateManager.getTemplates();
                  const userItems = Object.entries(userTemplates).map(([id, t]) => ({
                    key: `template-${id}`,
                    label: t.label,
                    isUserTemplate: true,
                    templateId: id,
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L16 10 H8 Z"/><rect x="4" y="14" width="6" height="6" rx="1"/><circle cx="17" cy="17" r="3"/></svg>`
                  }));
                  if (userItems.length > 0) {
                    children.push({ isHeader: true, label: 'User Templates' } as any);
                    children.push(...userItems);
                  }
                }
                return children.map(child => {
                  if ((child as any).isHeader) {
                    return `<div class="dropdown-header">${child.label}</div>`;
                  }
                  return `
                    <button class="tool-dropdown-item ${state.activeTool === child.key ? 'active' : ''}" data-tool="${child.key}" title="${child.label}" aria-label="${child.label}">
                      <span class="tool-icon">${child.icon}</span>
                      <span class="tool-item-label">${child.label}</span>
                      ${(child as any).isUserTemplate ? `
                      <div class="template-delete-btn" data-delete-template="${(child as any).templateId}" title="Delete Template">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </div>
                      ` : ''}
                    </button>
                  `;
                }).join('');
              })()}
            </div>
          </div>
        `;
      }

      return `
        <button class="tool-button ${state.activeTool === tool.key ? 'active' : ''}" data-tool="${tool.key}" title="${tool.label} (${tool.shortcut})" ${disabled ? 'disabled' : ''} aria-label="${tool.label}">
          <span class="tool-icon">${tool.icon}</span>
          ${tool.shortcut ? `<span class="tool-shortcut">${tool.shortcut}</span>` : ''}
        </button>
      `;
    }).join('');

    // Hover-based dropdown open/close
    toolbar.querySelectorAll<HTMLElement>('.tool-dropdown-wrap').forEach(wrap => {
      const menu = wrap.querySelector<HTMLElement>('.tool-dropdown-menu');
      if (!menu) return;
      // Dropdowns are now click-only as per user request
    });
  };

  function closeAllDropdowns() {
    toolbar.querySelectorAll<HTMLElement>('.tool-dropdown-menu').forEach(m => m.classList.remove('open'));
  }

  const onDocumentClick = () => closeAllDropdowns();
  document.addEventListener('click', onDocumentClick);

  let propertiesOpen = true;
  const propToggleBtn = document.createElement('button');
  propToggleBtn.className = 'properties-toggle-btn active';
  propToggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
  propToggleBtn.title = "Close Settings";
  root.appendChild(propToggleBtn);

  propToggleBtn.addEventListener('click', () => {
    propertiesOpen = !propertiesOpen;
    renderProperties(store.getState());
  });

  const renderProperties = (state: any) => {
    const selectedShapes = state.selectedIds
      .map((id: string) => state.shapes.find((s: any) => s.id === id))
      .filter((s: any) => !!s);

    // If all selected shapes are locked, don't show properties panel
    if (selectedShapes.length > 0 && selectedShapes.every((s: any) => s.locked)) {
      properties.classList.add('hidden');
      propToggleBtn.style.display = 'none';
      return;
    }

    const isDrawingTool = [
      'rectangle', 'ellipse', 'diamond', 'triangle', 'sticky-note',
      'arrow', 'freehand', 'text', 'db-table', 'db-view', 'db-enum',
      'hexagon', 'star', 'parallelogram', 'cylinder', 'cloud', 'callout'
    ].includes(state.activeTool);

    properties.classList.remove('hidden');
    properties.innerHTML = renderPropertiesPanelHTML(api);
    if (!properties.innerHTML.trim()) {
      properties.classList.add('hidden');
      propToggleBtn.style.display = 'none';
    } else {
      propToggleBtn.style.display = 'flex';
      properties.classList.toggle('closed', !propertiesOpen);
      
      const hasSelection = selectedShapes.length > 0;
      propToggleBtn.className = `properties-toggle-btn ${propertiesOpen ? 'active' : ''} ${hasSelection ? 'has-selection' : ''}`;
      
      const paletteIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125 0-.941.732-1.688 1.688-1.688h1.941c3.191 0 5.593-2.515 5.593-5.593C22 5.593 15.5 2 12 2z"/></svg>`;
      const chevronIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
      
      propToggleBtn.innerHTML = propertiesOpen ? chevronIcon : paletteIcon;
      propToggleBtn.title = propertiesOpen ? "Close Settings" : "Open Settings";
    }

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

  root.querySelector('.tahta-shell')?.addEventListener('click', (event: Event) => {
    const target = event.target as HTMLElement;
    // Close dropdowns if clicked on an item or color swatch
    if (target.closest('.tool-dropdown-item') || target.closest('.pp-ibtn') || target.closest('.pp-swatch')) {
      closeAllDropdowns();
      properties.querySelectorAll('.pp-dropdown-menu').forEach(m => m.classList.remove('open'));
    }

    const deleteBtn = target.closest('[data-delete-template]') as HTMLElement | null;
    if (deleteBtn) {
      event.stopPropagation();
      const templateId = deleteBtn.getAttribute('data-delete-template');
      if (templateId) {
        confirmModal({
          title: 'Delete Template',
          message: 'Are you sure you want to delete this template?',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          danger: true,
        }).then((confirmed) => {
          if (confirmed) {
            UserTemplateManager.deleteTemplate(templateId);
            api.forceNotify();
          }
        });
      }
      return;
    }

    const groupBtn = target.closest('[data-tool-group]') as HTMLButtonElement | null;
    if (groupBtn) {
      event.stopPropagation();
      const groupKey = groupBtn.getAttribute('data-tool-group');
      const menu = root.querySelector(`#dropdown-${groupKey}`);
      if (menu) {
        const isOpen = menu.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) menu.classList.add('open');
      }
      return;
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
    } else if (state.activeTool?.startsWith('template-')) {
      cursor = 'url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2ZjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMyBMMTYgMTAgSDggWiIvPjxyZWN0IHg9IjQiIHk9IjE0IiB3aWR0aD0iNiIgaGVpZ2h0PSI2IiByeD0iMSIvPjxjaXJjbGUgY3g9IjE3IiBjeT0iMTciIHI9IjMiLz48L3N2Zz4=) 12 12, crosshair';
    } else if (state.activeTool === 'comment') {
      cursor = 'url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2ZjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNy45IDIwQTkgOSAwIDEgMCA0IDE2LjFMMiAyMloiLz48L3N2Zz4=) 2 18, pointer';
    } else {
      cursor = 'default';
    }
    
    if (canvas.style.cursor !== cursor) {
      canvas.style.cursor = cursor;
    }
  };

  const layersBadge = root.querySelector('[data-layers-badge]') as HTMLElement | null;

  const updateLayersBadge = (state: any) => {
    if (!layersBadge) return;
    const count = state.shapes?.length ?? 0;
    if (count > 0) {
      layersBadge.textContent = String(count);
      layersBadge.style.display = '';
    } else {
      layersBadge.style.display = 'none';
    }
  };

  const unsubUI = store.subscribe((state) => {
    requestAnimationFrame(() => {
      renderToolbar(state);
      renderProperties(state);
      renderCursor(state);
      renderZoomValue(state);
      updateLayersBadge(state);

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
  updateLayersBadge(store.getState());
  
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
    document.removeEventListener('click', onDocumentClick);
  };
}
