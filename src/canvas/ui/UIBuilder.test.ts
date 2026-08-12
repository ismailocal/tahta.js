// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { EventBus } from '../EventBus';
import { createBuiltinShapeRegistry } from '../../core/builtinRegistry';
import { createCanvasEngine } from '../../core/CanvasEngine';
import { WhiteboardStore } from '../../core/Store';
import { createWhiteboardAPI } from '../../core/StoreAPI';
import { attachBuiltinShapeRuntimes } from '../../plugins';
import { createUI } from './UIBuilder';

describe('canvas UI contract', () => {
  const disposers: Array<() => void> = [];

  afterEach(() => {
    disposers.splice(0).reverse().forEach((dispose) => dispose());
    document.body.replaceChildren();
  });

  it('keeps the toolbar and bottom control DOM contract unchanged', () => {
    const root = document.createElement('div');
    const canvas = document.createElement('canvas');
    document.body.appendChild(root);
    const registry = createBuiltinShapeRegistry();
    attachBuiltinShapeRuntimes(registry);
    const engine = createCanvasEngine({ documentId: 'ui-contract', registry });
    const store = new WhiteboardStore(engine, {}, new EventBus());
    const api = createWhiteboardAPI(store, canvas);
    const disposeUI = createUI(root, store, canvas, api);
    disposers.push(() => { disposeUI(); store.destroy(); engine.destroy(); });

    const toolbar = root.querySelector<HTMLElement>('[data-toolbar]');
    expect(toolbar).not.toBeNull();
    expect([...toolbar!.children].map((element) =>
      element.classList.contains('toolbar-separator')
        ? '|'
        : element.getAttribute('data-tool') ?? element.getAttribute('data-dropdown'),
    )).toEqual([
      'hand', 'select', '|', 'rectangle', 'ellipse', 'diamond', 'sticky-note', 'frame', '|', 'arrow', '|',
      'freehand', 'laser', 'text', 'image', '|', 'library-group', '|', 'eraser', '|', 'undo', 'redo',
    ]);

    const rectangle = toolbar!.querySelector<HTMLButtonElement>('[data-tool="rectangle"]');
    expect(rectangle?.className).toBe('tool-button ');
    expect(rectangle?.title).toBe('Rectangle (R)');
    expect(rectangle?.getAttribute('aria-label')).toBe('Rectangle');
    expect(rectangle?.querySelector('svg')?.outerHTML).toBe('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>');

    const mobileToolbar = root.querySelector<HTMLElement>('[data-mobile-toolbar]');
    expect(mobileToolbar).not.toBeNull();
    expect([...mobileToolbar!.children].map((element) =>
      element.getAttribute('data-tool') ?? element.getAttribute('data-dropdown'),
    )).toEqual(['hand', 'select', 'mobile-shapes', 'freehand', 'mobile-more']);
    expect(mobileToolbar!.querySelectorAll(':scope > .tool-button, :scope > .tool-dropdown-wrap')).toHaveLength(5);
    expect(mobileToolbar!.querySelector('#dropdown-mobile-shapes [data-tool="rectangle"]')).not.toBeNull();
    expect(mobileToolbar!.querySelector('#dropdown-mobile-more [data-tool="db-table"]')).not.toBeNull();
    expect(mobileToolbar!.querySelector<HTMLButtonElement>('#dropdown-mobile-more [data-tool="undo"]')?.disabled).toBe(true);

    const controls = root.querySelector<HTMLElement>('[data-zoom-controls]');
    expect(controls?.className).toBe('zoom-controls');
    expect([...controls!.children].map((element) =>
      [...element.attributes].find((attribute) => attribute.name.startsWith('data-'))?.name ?? element.className,
    )).toEqual(['data-layers-toggle', 'zoom-separator', 'data-zoom-fit', 'zoom-separator', 'data-zoom-out', 'data-zoom-value', 'data-zoom-in']);
    expect(root.querySelector('[data-zoom-value]')?.textContent).toBe('100%');
    expect(root.querySelector('.properties-panel')?.getAttribute('data-properties')).toBe('');
  });

  it('owns hidden inputs and modal resources per mounted root', () => {
    const root = document.createElement('div');
    const canvas = document.createElement('canvas');
    document.body.appendChild(root);
    const registry = createBuiltinShapeRegistry();
    attachBuiltinShapeRuntimes(registry);
    const engine = createCanvasEngine({ documentId: 'ui-lifecycle', registry });
    const store = new WhiteboardStore(engine, {}, new EventBus());
    const disposeUI = createUI(root, store, canvas, createWhiteboardAPI(store, canvas));

    root.querySelector<HTMLButtonElement>('[data-tool="image"]')?.click();
    expect(document.body.querySelectorAll('input[type="file"]')).toHaveLength(1);
    disposeUI();
    store.destroy();
    engine.destroy();
    expect(document.body.querySelectorAll('input[type="file"]')).toHaveLength(0);
  });
});
