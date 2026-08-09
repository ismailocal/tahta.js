/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasEngine } from '../core/CanvasEngine';
import { EMPTY_CANVAS_SNAPSHOT } from '../core/model';
import { createBuiltinShapeRegistry } from '../shapes';
import { mountCanvas } from './CanvasDomView';

class ResizeObserverStub {
  observe = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(), beginPath: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    strokeRect: vi.fn(), roundRect: vi.fn(), ellipse: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
    setLineDash: vi.fn(), fillText: vi.fn(), drawImage: vi.fn(), arc: vi.fn(), rect: vi.fn(), quadraticCurveTo: vi.fn(), measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'top',
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLCanvasElement.prototype, 'hasPointerCapture', { configurable: true, value: vi.fn(() => false) });
});

describe('DomCanvasView', () => {
  it('mounts a single instance-scoped canvas and destroys every owned node', () => {
    const root = document.createElement('div');
    const engine = createCanvasEngine({ documentId: 'dom-test', registry: createBuiltinShapeRegistry(), initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    const view = mountCanvas({ root, engine });
    expect(root.querySelectorAll('canvas')).toHaveLength(1);
    expect(root.querySelector('[role="toolbar"]')).not.toBeNull();
    view.destroy();
    expect(root.childElementCount).toBe(0);
    engine.destroy();
  });

  it('isolates multiple mounts and aborts every instance-owned event listener on destroy', () => {
    const roots = [document.createElement('div'), document.createElement('div')];
    const engines = roots.map((_, index) => createCanvasEngine({ documentId: `multi-${index}`, registry: createBuiltinShapeRegistry(), initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) }));
    const views = roots.map((root, index) => mountCanvas({ root, engine: engines[index]! }));

    views[0]!.setTool('rectangle');
    expect(engines[0]!.getViewState().activeTool).toBe('rectangle');
    expect(engines[1]!.getViewState().activeTool).toBe('select');

    views.forEach((view) => view.destroy());
    roots.forEach((root) => expect(root.childElementCount).toBe(0));
    views.forEach((view) => {
      view.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      expect(view.canvas.isConnected).toBe(false);
    });
    engines.forEach((engine) => engine.destroy());
  });

  it('does not silently accept an unknown tool', () => {
    const root = document.createElement('div');
    const engine = createCanvasEngine({ documentId: 'dom-test', registry: createBuiltinShapeRegistry(), initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    const view = mountCanvas({ root, engine });
    expect(() => view.setTool('missing')).toThrow("Unknown canvas tool 'missing'");
    view.destroy(); engine.destroy();
  });

  it('keeps keyboard and pointer mutation paths read-only', () => {
    const root = document.createElement('div'); const registry = createBuiltinShapeRegistry();
    const engine = createCanvasEngine({ documentId: 'readonly-dom-test', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    const definition = registry.get('rectangle'); engine.dispatch({ type: 'shape.create', record: registry.validate({ id: 'shape', type: 'rectangle', typeVersion: definition.version, parentId: 'root', index: 'a0', x: 0, y: 0, rotation: 0, opacity: 1, locked: false, hidden: false, props: definition.defaults() }) }); engine.setReadonly(true);
    const view = mountCanvas({ root, engine }); engine.setViewState({ selectedIds: ['shape'] }); view.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    view.setTool('rectangle'); view.canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 300, clientY: 300, bubbles: true }));
    expect(engine.getSnapshot().records.map(({ id }) => id)).toEqual(['shape']); view.destroy(); engine.destroy();
  });
});
