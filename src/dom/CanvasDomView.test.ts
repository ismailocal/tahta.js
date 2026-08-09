/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasEngine } from '../core/CanvasEngine';
import { EMPTY_CANVAS_SNAPSHOT } from '../core/model';
import { createBuiltinShapeRegistry } from '../shapes';
import { mountCanvas } from './CanvasDomView';
import type { ShapeRecord } from '../core/model';

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

function pointer(target: EventTarget, type: string, x: number, y: number, options: { pointerId?: number; button?: number; buttons?: number; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {}): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: options.button ?? 0, buttons: options.buttons ?? (type === 'pointerup' ? 0 : 1), shiftKey: options.shiftKey, ctrlKey: options.ctrlKey, metaKey: options.metaKey });
  Object.defineProperties(event, { pointerId: { value: options.pointerId ?? 1 }, pointerType: { value: 'mouse' } }); target.dispatchEvent(event);
}

function boxRecord(engine: ReturnType<typeof createCanvasEngine>, id: string, x: number, y: number): ShapeRecord {
  const definition = engine.registry.get('rectangle'); return engine.registry.validate({ id, type: 'rectangle', typeVersion: definition.version, parentId: 'root', index: id === 'source' ? 'a0' : 'a1', x, y, rotation: 0, opacity: 1, locked: false, hidden: false, props: definition.defaults() });
}

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

  it('places a selected template at the clicked world point and returns to select', () => {
    const root = document.createElement('div'); const onPlaceTemplate = vi.fn();
    const engine = createCanvasEngine({ documentId: 'template-tool', registry: createBuiltinShapeRegistry(), initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    const view = mountCanvas({ root, engine, onPlaceTemplate }); view.setTool('template:flowchart');
    pointer(view.canvas, 'pointerdown', 320, 240); pointer(view.canvas, 'pointerup', 320, 240);
    expect(onPlaceTemplate).toHaveBeenCalledWith('flowchart', { x: 320, y: 240 }); expect(engine.getViewState().activeTool).toBe('select');
    view.destroy(); engine.destroy();
  });

  it('fits visible content into the viewport and resets an empty board', () => {
    const root = document.createElement('div'); const registry = createBuiltinShapeRegistry();
    const engine = createCanvasEngine({ documentId: 'fit-content-test', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    const definition = registry.get('rectangle');
    engine.dispatch({ type: 'shape.create', record: registry.validate({ id: 'shape', type: 'rectangle', typeVersion: definition.version, parentId: 'root', index: 'a0', x: 1_000, y: 500, rotation: 0, opacity: 1, locked: false, hidden: false, props: definition.defaults() }) });
    const view = mountCanvas({ root, engine });

    view.fitToContent();
    expect(engine.getViewState().viewport).toEqual({ x: -1_780, y: -792, zoom: 2 });

    engine.dispatch({ type: 'shape.delete', ids: ['shape'], mode: 'only' });
    view.fitToContent();
    expect(engine.getViewState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
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

  it('restores port-to-port arrow drawing and keeps the entire gesture in one undo step', () => {
    const root = document.createElement('div'); const registry = createBuiltinShapeRegistry(); const engine = createCanvasEngine({ documentId: 'arrow-gesture', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: boxRecord(engine, 'source', 0, 0) }, { type: 'shape.create', record: boxRecord(engine, 'target', 400, 0) }] });
    const view = mountCanvas({ root, engine });
    view.setTool('arrow');
    pointer(view.canvas, 'pointerdown', 180, 50); pointer(view.canvas, 'pointermove', 400, 50); pointer(view.canvas, 'pointerup', 400, 50);
    const arrow = engine.getSnapshot().records.find(({ type }) => type === 'arrow'); expect(arrow).toBeDefined();
    expect(engine.getSnapshot().bindings.find(({ connectorId }) => connectorId === arrow!.id)).toMatchObject({ start: { shapeId: 'source', portId: 'right' }, end: { shapeId: 'target', portId: 'left' } });
    engine.undo(); expect(engine.getSnapshot().records.map(({ id }) => id).sort()).toEqual(['source', 'target']); view.destroy(); engine.destroy();
  });

  it('restores selection-box, resize handles, shift toggle, and legacy tool shortcuts', () => {
    const root = document.createElement('div'); const registry = createBuiltinShapeRegistry(); const engine = createCanvasEngine({ documentId: 'selection-gesture', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: boxRecord(engine, 'source', 20, 20) }, { type: 'shape.create', record: boxRecord(engine, 'target', 400, 20) }] }); const view = mountCanvas({ root, engine });
    pointer(view.canvas, 'pointerdown', 0, 0); pointer(view.canvas, 'pointermove', 650, 180); pointer(view.canvas, 'pointerup', 650, 180); expect(engine.getViewState().selectedIds.sort()).toEqual(['source', 'target']);
    pointer(view.canvas, 'pointerdown', 50, 50, { shiftKey: true }); pointer(view.canvas, 'pointerup', 50, 50, { shiftKey: true }); expect(engine.getViewState().selectedIds).toEqual(['target']);
    pointer(view.canvas, 'pointerdown', 450, 50); pointer(view.canvas, 'pointerup', 450, 50); pointer(view.canvas, 'pointerdown', 580, 120); pointer(view.canvas, 'pointermove', 640, 170); pointer(view.canvas, 'pointerup', 640, 170);
    expect(engine.getSnapshot().records.find(({ id }) => id === 'target')!.props).toMatchObject({ width: 240, height: 150 });
    view.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true })); expect(engine.getViewState().activeTool).toBe('ellipse');
    view.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true })); expect(engine.getViewState().activeTool).toBe('eraser'); view.destroy(); engine.destroy();
  });

  it('deletes click-only box gestures and returns completed drawing tools to select', () => {
    const root = document.createElement('div'); const engine = createCanvasEngine({ documentId: 'draw-contract', registry: createBuiltinShapeRegistry(), initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) }); const view = mountCanvas({ root, engine });
    view.setTool('rectangle'); pointer(view.canvas, 'pointerdown', 100, 100); pointer(view.canvas, 'pointerup', 100, 100); expect(engine.getSnapshot().records).toHaveLength(0);
    view.setTool('ellipse'); pointer(view.canvas, 'pointerdown', 100, 100); pointer(view.canvas, 'pointermove', 240, 180); pointer(view.canvas, 'pointerup', 240, 180); expect(engine.getSnapshot().records).toHaveLength(1); expect(engine.getViewState().activeTool).toBe('select'); view.destroy(); engine.destroy();
  });
});
