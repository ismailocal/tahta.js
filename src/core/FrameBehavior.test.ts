import { describe, expect, it } from 'vitest';
import { createBuiltinShapeRegistry } from './builtinRegistry';
import { createCanvasEngine } from './CanvasEngine';
import { shapesToSnapshot } from './projection';
import { WhiteboardStore } from './Store';
import type { Shape } from './types';

const rectangle = (id: string, patch: Partial<Shape> = {}): Shape => ({
  id,
  type: 'rectangle',
  x: 20,
  y: 30,
  width: 100,
  height: 80,
  ...patch,
});

describe('frame behavior', () => {
  it('reparents without jumping, moves with the frame, detaches, and keeps child size during resize', () => {
    const registry = createBuiltinShapeRegistry();
    const frame = { ...rectangle('frame', { x: 100, y: 80, width: 300, height: 200 }), type: 'frame' };
    const child = rectangle('child', { x: 140, y: 130 });
    const engine = createCanvasEngine({
      documentId: 'frame-behavior',
      registry,
      initialSnapshot: shapesToSnapshot('frame-behavior', [frame, child], registry, {}),
    });
    const store = new WhiteboardStore(engine);

    store.reparentShapes(['child'], 'frame');
    expect(engine.getSnapshot().records.find(({ id }) => id === 'child')).toMatchObject({
      parentId: 'frame', x: 40, y: 50,
    });
    expect(store.getState().shapes.find(({ id }) => id === 'child')).toMatchObject({
      x: 140, y: 130, width: 100, height: 80,
    });

    store.updateShape('frame', { x: 200, y: 180 });
    expect(store.getState().shapes.find(({ id }) => id === 'child')).toMatchObject({ x: 240, y: 230 });

    store.updateShape('child', { locked: true });
    store.resizeFrame('frame', { x: 180, y: 160, width: 320, height: 220 });
    expect(store.getState().shapes.find(({ id }) => id === 'child')).toMatchObject({
      x: 240, y: 230, width: 100, height: 80, locked: true,
    });

    store.updateShape('child', { locked: false });
    store.reparentShapes(['child'], 'root');
    expect(engine.getSnapshot().records.find(({ id }) => id === 'child')).toMatchObject({
      parentId: 'root', x: 240, y: 230,
    });
    expect(store.getState().shapes.find(({ id }) => id === 'child')).toMatchObject({ x: 240, y: 230 });

    store.destroy();
    engine.destroy();
  });
});
