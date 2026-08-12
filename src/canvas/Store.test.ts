import { describe, it, expect, vi } from 'vitest';
import { WhiteboardStore } from '../core/Store'; 
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import { createCanvasEngine } from '../core/CanvasEngine';
import type { Shape } from '../core/types';

const mockShape = (): Shape => ({
  id: '1',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});

describe('WhiteboardStore', () => {
  it('should notify subscribers on state change', () => {
    const engine = createCanvasEngine({ documentId: 'store-notify', registry: createBuiltinShapeRegistry() });
    const store = new WhiteboardStore(engine);
    const handler = vi.fn();
    store.subscribe(handler);
    store.addShape(mockShape());
    expect(handler).toHaveBeenCalled();
    store.destroy();
    engine.destroy();
  });

  it('should not notify if state is identical', () => {
    const engine = createCanvasEngine({ documentId: 'store-noop', registry: createBuiltinShapeRegistry() });
    const store = new WhiteboardStore(engine);
    const handler = vi.fn();
    store.subscribe(handler);
    store.setState(store.getState()); // no-op
    expect(handler).not.toHaveBeenCalled();
    store.destroy();
    engine.destroy();
  });

  it('preserves the shape projection across view-only updates', () => {
    const engine = createCanvasEngine({ documentId: 'store-view-projection', registry: createBuiltinShapeRegistry() });
    const store = new WhiteboardStore(engine);
    store.addShape(mockShape());
    store.commitState();
    const shapes = store.getState().shapes;
    const shape = shapes[0];

    engine.setViewState({ viewport: { x: 30, y: 40, zoom: 1.2 } });

    expect(store.getState().shapes).toBe(shapes);
    expect(store.getState().shapes[0]).toBe(shape);
    store.destroy();
    engine.destroy();
  });

  it('reprojects only the changed shape when document records change', () => {
    const engine = createCanvasEngine({ documentId: 'store-record-projection', registry: createBuiltinShapeRegistry() });
    const store = new WhiteboardStore(engine);
    store.addShape(mockShape());
    store.addShape({ ...mockShape(), id: '2', x: 20 });
    store.commitState();
    const before = store.getState().shapes;

    store.updateShape('1', { x: 5 });

    expect(store.getState().shapes).not.toBe(before);
    expect(store.getState().shapes[0]).not.toBe(before[0]);
    expect(store.getState().shapes[1]).toBe(before[1]);
    store.destroy();
    engine.destroy();
  });

  it('discards queued commands when a batch callback fails', () => {
    const engine = createCanvasEngine({ documentId: 'store-failed-batch', registry: createBuiltinShapeRegistry() });
    const store = new WhiteboardStore(engine);

    expect(() => store.batchUpdate(() => {
      store.addShape(mockShape());
      throw new Error('stop');
    })).toThrow('stop');

    expect(store.getState().shapes).toEqual([]);
    store.destroy();
    engine.destroy();
  });
});
