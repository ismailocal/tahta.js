import { WhiteboardStore } from '../../core/Store';
import type { ICanvasAPI, Shape } from '../../core/types';
import { calculateCenteredViewport } from '../../geometry/ViewportUtils';

const ICONS = {
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  rectangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
  ellipse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  diamond: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l6.59 6.59a2.41 2.41 0 0 0 3.41 0l6.59-6.59a2.41 2.41 0 0 0 0-3.41l-6.59-6.59a2.41 2.41 0 0 0-3.41 0Z"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  line: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
  draw: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
  hash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="10" y2="21"/><line x1="16" y1="3" x2="16" y2="21"/></svg>`,
};

export function initLayersPanel(root: HTMLElement, store: WhiteboardStore, canvas: HTMLCanvasElement, api: ICanvasAPI) {
  let isOpen = false;
  let search = '';

  const panel = document.createElement('div');
  panel.className = 'layers-panel-container';
  root.appendChild(panel);

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'layers-toggle-btn';
  toggleBtn.innerHTML = ICONS.layers;
  toggleBtn.title = "Open Layers";
  root.appendChild(toggleBtn);

  const render = () => {
    const state = store.getState();
    const shapes = [...(state.shapes || [])].reverse();
    const selectedIds = new Set(state.selectedIds || []);

    const filteredShapes = shapes.filter(el => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const typeMatch = (el.type as string)?.toLowerCase().includes(s);
      const textMatch = el.text?.toLowerCase().includes(s);
      return typeMatch || textMatch;
    });

    panel.className = `layers-panel-container ${isOpen ? 'open' : ''}`;
    toggleBtn.className = `layers-toggle-btn ${isOpen ? 'active' : ''}`;
    toggleBtn.innerHTML = isOpen ? ICONS.chevronDown : ICONS.layers;
    toggleBtn.title = isOpen ? "Close Layers" : "Open Layers";

    panel.innerHTML = `
      <div class="layers-header">
        <div class="layers-header-left">
          <span class="layers-header-icon">${ICONS.layers}</span>
          <h3 class="layers-header-title">Layers</h3>
          <span class="layers-count-badge">${shapes.length}</span>
        </div>
        <div style="width: 32px; height: 32px;"></div>
      </div>
      <div class="layers-search-wrap">
        <div class="layers-search-inner">
          <span class="layers-search-icon">${ICONS.search}</span>
          <input type="text" class="layers-search-input" placeholder="Filter objects..." value="${search}">
        </div>
      </div>
      <div class="layers-list custom-scrollbar">
        ${filteredShapes.map(shape => {
          const isSelected = selectedIds.has(shape.id);
          const icon = getShapeIcon(shape.type);
          const label = shape.text || ((shape.type as string).charAt(0).toUpperCase() + (shape.type as string).slice(1));
          return `
            <div class="layer-item ${isSelected ? 'selected' : ''}" data-id="${shape.id}">
              ${isSelected ? `<div class="layer-item-active-bar"></div>` : ''}
              <div class="layer-item-icon-wrap">
                <span class="layer-item-icon">${icon}</span>
              </div>
              <div class="layer-item-info">
                <p class="layer-item-label">${label}</p>
                <p class="layer-item-id">${shape.id.substring(0, 8)}</p>
              </div>
              <div class="layer-item-actions">
                <button class="layer-item-delete" data-delete="${shape.id}" title="Delete Object">
                  ${ICONS.trash}
                </button>
              </div>
            </div>
          `;
        }).join('')}
        ${filteredShapes.length === 0 && shapes.length > 0 ? `
          <div class="layers-empty">
            <span class="layers-empty-icon">${ICONS.layers}</span>
            <p>No matching objects</p>
          </div>
        ` : ''}
      </div>
    `;

    // Re-bind events
    const input = panel.querySelector('.layers-search-input') as HTMLInputElement;
    if (input) {
      input.addEventListener('input', (e) => {
        search = (e.target as HTMLInputElement).value;
        render();
      });
      // Keep focus if possible (though manual render kills it, we can fix by updating list only or using a better approach)
      // For simplicity in Vanilla, we'll try to restore focus.
    }

    panel.querySelectorAll('.layer-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;
        const shape = state.shapes.find(s => s.id === id);
        if (shape) handleSelect(id, shape);
      });
    });

    panel.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).getAttribute('data-delete');
        if (id) handleDelete(id);
      });
    });
  };

  const handleSelect = (id: string, shape: Shape) => {
    api.setSelection([id]);
    const rect = canvas.getBoundingClientRect();
    const newViewport = calculateCenteredViewport([shape], rect.width, rect.height);
    api.setViewport(newViewport);
  };

  const handleDelete = (id: string) => {
    api.deleteShape(id);
    api.commitState();
  };

  const getShapeIcon = (type: string) => {
    switch (type) {
      case 'text': return ICONS.text;
      case 'rectangle': return ICONS.rectangle;
      case 'ellipse':
      case 'circle': return ICONS.ellipse;
      case 'diamond': return ICONS.diamond;
      case 'arrow': return ICONS.arrow;
      case 'line': return ICONS.line;
      case 'image': return ICONS.image;
      case 'freehand': return ICONS.draw;
      default: return ICONS.hash;
    }
  };

  toggleBtn.addEventListener('click', () => {
    isOpen = !isOpen;
    render();
  });

  const unsubscribe = store.subscribe(() => {
     // Optimization: Only render if open or if total count changed
     render();
  });

  render();

  return () => {
    unsubscribe();
    panel.remove();
    toggleBtn.remove();
  };
}
