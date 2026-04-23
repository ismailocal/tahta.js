import type { ICanvasAPI, Shape } from '../../core/types';
import { createId } from '../../core/Utils';
import { UserTemplateManager } from '../../tools/UserTemplateManager';
import { selectionToTemplate } from '../../tools/templates';
import { promptModal, alertModal } from './Modal';

const ICONS = {
  duplicate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="6" y="6" rx="2"/><path d="M6 10V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  unlock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  layerBack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M2 12l5-5"/><path d="M2 12l5 5"/></svg>`,
  layerForward: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12H2"/><path d="M22 12l-5-5"/><path d="M22 12l-5 5"/></svg>`,
  toBack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M2 12l5-5"/><path d="M2 12l5 5"/><path d="M22 4v16"/></svg>`,
  toFront: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M22 12l-5-5"/><path d="M22 12l-5 5"/><path d="M2 4v16"/></svg>`,
  createTemplate: `<svg viewBox="-1 -1 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L16 10 H8 Z"/><rect x="4" y="14" width="6" height="6" rx="1"/><circle cx="17" cy="17" r="3"/><path d="M21 3v6M18 6h6" stroke-width="2.5"/></svg>`,
};

interface ContextMenuOptions {
  x: number;
  y: number;
  selectedIds: string[];
  api: ICanvasAPI;
}

export class ContextMenu {
  private element: HTMLElement;
  private api: ICanvasAPI;
  private selectedIds: string[];

  constructor(options: ContextMenuOptions) {
    this.api = options.api;
    this.selectedIds = options.selectedIds;
    this.element = this.createMenu(options.x, options.y);
    this.attach();
  }

  private createMenu(x: number, y: number): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const state = this.api.getState();
    const selectedShapes = this.selectedIds
      .map((id: string) => state.shapes.find((s: Shape) => s.id === id))
      .filter((s): s is Shape => !!s);

    if (selectedShapes.length === 0) {
      return menu;
    }

    const isLocked = selectedShapes.some(s => s.locked);
    const shape = selectedShapes[0];

    // Actions section
    const actionsSection = document.createElement('div');
    actionsSection.className = 'context-menu-section';
    actionsSection.innerHTML = '<div class="context-menu-section-title">Actions</div>';

    const actionsList = document.createElement('div');
    actionsList.className = 'context-menu-items';

    // Duplicate
    const duplicateBtn = this.createMenuItem('duplicate', 'Duplicate', ICONS.duplicate, !isLocked);
    actionsList.appendChild(duplicateBtn);

    // Lock/Unlock
    const lockBtn = this.createMenuItem(
      isLocked ? 'unlock' : 'lock',
      isLocked ? 'Unlock' : 'Lock',
      isLocked ? ICONS.unlock : ICONS.lock,
      true
    );
    actionsList.appendChild(lockBtn);

    // Save as Template
    const templateBtn = this.createMenuItem('create-template', 'Save as Template', ICONS.createTemplate, !isLocked);
    actionsList.appendChild(templateBtn);

    // Delete
    const deleteBtn = this.createMenuItem('delete', 'Delete', ICONS.delete, !isLocked, true);
    actionsList.appendChild(deleteBtn);

    actionsSection.appendChild(actionsList);
    menu.appendChild(actionsSection);

    // Layers section
    const layersSection = document.createElement('div');
    layersSection.className = 'context-menu-section';
    layersSection.innerHTML = '<div class="context-menu-section-title">Layers</div>';

    const layersList = document.createElement('div');
    layersList.className = 'context-menu-items';

    // Move to back
    const toBackBtn = this.createMenuItem('to-back', 'Move to Back', ICONS.toBack, !isLocked);
    layersList.appendChild(toBackBtn);

    // Move backward
    const backwardBtn = this.createMenuItem('backward', 'Move Backward', ICONS.layerBack, !isLocked);
    layersList.appendChild(backwardBtn);

    // Move forward
    const forwardBtn = this.createMenuItem('forward', 'Move Forward', ICONS.layerForward, !isLocked);
    layersList.appendChild(forwardBtn);

    // Move to front
    const toFrontBtn = this.createMenuItem('to-front', 'Move to Front', ICONS.toFront, !isLocked);
    layersList.appendChild(toFrontBtn);

    layersSection.appendChild(layersList);
    menu.appendChild(layersSection);

    return menu;
  }

  private createMenuItem(
    action: string,
    label: string,
    icon: string,
    enabled: boolean,
    isDanger: boolean = false
  ): HTMLElement {
    const item = document.createElement('button');
    item.className = `context-menu-item ${!enabled ? 'disabled' : ''} ${isDanger ? 'danger' : ''}`;
    item.setAttribute('data-action', action);
    item.innerHTML = `<span class="context-menu-item-icon">${icon}</span><span class="context-menu-item-label">${label}</span>`;
    return item;
  }

  private attach() {
    this.element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest('.context-menu-item') as HTMLElement;
      if (!item || item.classList.contains('disabled')) return;

      const action = item.getAttribute('data-action');
      if (action) {
        this.handleAction(action);
        this.close();
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.element.contains(e.target as Node)) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  private handleAction(action: string) {
    const state = this.api.getState();
    const selectedIds = this.selectedIds;

    switch (action) {
      case 'duplicate':
        const newIds: string[] = [];
        selectedIds.forEach((id: string) => {
          const oldShape = state.shapes.find((s: Shape) => s.id === id);
          if (oldShape) {
            const newShape = { ...oldShape, id: createId(), x: oldShape.x + 10, y: oldShape.y + 10 };
            this.api.addShape(newShape);
            newIds.push(newShape.id);
          }
        });
        this.api.setSelection(newIds);
        this.api.commitState();
        break;

      case 'lock':
        selectedIds.forEach((id: string) => this.api.updateShape(id, { locked: true }));
        this.api.commitState();
        break;

      case 'unlock':
        selectedIds.forEach((id: string) => this.api.updateShape(id, { locked: false }));
        this.api.commitState();
        break;

      case 'delete':
        selectedIds.forEach((id: string) => this.api.deleteShape(id));
        this.api.setSelection([]);
        this.api.commitState();
        break;

      case 'create-template':
        const selectedShapes = state.shapes.filter((s: Shape) => selectedIds.includes(s.id));
        if (selectedShapes.length === 0) return;

        promptModal({
          title: 'Save as Template',
          label: 'Template Name',
          placeholder: 'My Custom Template',
          defaultValue: 'My Custom Template',
          confirmLabel: 'Save',
        }).then((name) => {
          if (name) {
            const template = selectionToTemplate(name, selectedShapes);
            UserTemplateManager.addTemplate(name, template);
            this.api.forceNotify();
            alertModal({
              title: 'Template Saved',
              message: `"${name}" has been saved to your library.`,
            });
          }
        });
        break;

      case 'to-back':
        selectedIds.forEach((id: string) => this.api.reorderShape(id, 'back'));
        this.api.commitState();
        break;

      case 'backward':
        selectedIds.forEach((id: string) => this.api.reorderShape(id, 'backward'));
        this.api.commitState();
        break;

      case 'forward':
        selectedIds.forEach((id: string) => this.api.reorderShape(id, 'forward'));
        this.api.commitState();
        break;

      case 'to-front':
        selectedIds.forEach((id: string) => this.api.reorderShape(id, 'front'));
        this.api.commitState();
        break;
    }
  }

  private close() {
    this.element.remove();
  }

  show() {
    // Close any existing context menus before showing the new one
    document.querySelectorAll('.context-menu').forEach(el => el.remove());
    document.body.appendChild(this.element);
  }
}
