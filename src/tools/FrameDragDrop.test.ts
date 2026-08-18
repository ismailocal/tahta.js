import { describe, expect, it } from 'vitest';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import { createCanvasEngine } from '../core/CanvasEngine';
import { shapesToSnapshot } from '../core/projection';
import { WhiteboardStore } from '../core/Store';
import { createWhiteboardAPI } from '../core/StoreAPI';
import type { PointerPayload, Shape } from '../core/types';
import { attachBuiltinShapeRuntimes } from '../plugins';
import { SelectTool } from './SelectTool';

const rectangle = (id: string, patch: Partial<Shape> = {}): Shape => ({
  id,
  type: 'rectangle',
  x: 20,
  y: 30,
  width: 80,
  height: 60,
  stroke: '#111827',
  fill: '#ffffff',
  ...patch,
});

function pointer(x: number, y: number): PointerPayload {
  return {
    nativeEvent: { target: { style: {} } } as unknown as PointerEvent,
    screen: { x, y },
    world: { x, y },
    button: 0,
    pointerId: 1,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: true,
  };
}

describe('frame drag and drop', () => {
  it('reparents a shape when dropped into a frame and detaches it outside without jumping', () => {
    const registry = createBuiltinShapeRegistry();
    attachBuiltinShapeRuntimes(registry);
    const frame = { ...rectangle('frame', { x: 100, y: 100, width: 300, height: 220 }), type: 'frame' };
    const child = rectangle('child');
    const engine = createCanvasEngine({
      documentId: 'frame-drag-drop',
      registry,
      initialSnapshot: shapesToSnapshot('frame-drag-drop', [frame, child], registry, {}),
    });
    const store = new WhiteboardStore(engine, {}, undefined, registry);
    const api = createWhiteboardAPI(store, { offsetWidth: 800, offsetHeight: 600 } as HTMLCanvasElement);
    const tool = new SelectTool();

    tool.onPointerDown(pointer(40, 50), api);
    tool.onPointerMove(pointer(160, 150), api);
    tool.onPointerUp(pointer(160, 150), api);

    expect(engine.getSnapshot().records.find(({ id }) => id === 'child')).toMatchObject({
      parentId: 'frame', x: 40, y: 30,
    });
    expect(store.getState().shapes.find(({ id }) => id === 'child')).toMatchObject({ x: 140, y: 130 });

    tool.onPointerDown(pointer(160, 150), api);
    tool.onPointerMove(pointer(560, 500), api);
    tool.onPointerUp(pointer(560, 500), api);

    expect(engine.getSnapshot().records.find(({ id }) => id === 'child')).toMatchObject({
      parentId: 'root', x: 540, y: 480,
    });
    expect(store.getState().shapes.find(({ id }) => id === 'child')).toMatchObject({ x: 540, y: 480 });

    store.destroy();
    engine.destroy();
  });
});
