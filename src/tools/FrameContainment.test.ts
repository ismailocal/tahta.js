import { describe, expect, it } from 'vitest';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import type { Shape } from '../core/types';
import { attachBuiltinShapeRuntimes } from '../plugins';
import { resolveFrameDrop, shapesContainedByFrame, topLevelSelectionIds } from './FrameContainment';

const rectangle = (id: string, patch: Partial<Shape> = {}): Shape => ({
  id,
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...patch,
});

describe('frame containment', () => {
  const registry = createBuiltinShapeRegistry();
  attachBuiltinShapeRuntimes(registry);

  it('captures only unlocked sibling shapes fully enclosed by a new frame', () => {
    const shapes = [
      { ...rectangle('frame', { x: 100, y: 100, width: 300, height: 200 }), type: 'frame' },
      rectangle('inside', { x: 140, y: 130 }),
      rectangle('partial', { x: 350, y: 250 }),
      rectangle('locked', { x: 200, y: 150, locked: true }),
      rectangle('nested', { x: 200, y: 150, parentId: 'other-frame' }),
    ];

    expect(shapesContainedByFrame('frame', shapes, registry)).toEqual(['inside']);
  });

  it('selects the topmost valid frame on drop and detaches outside every frame', () => {
    const shapes = [
      { ...rectangle('outer', { x: 100, y: 100, width: 400, height: 300 }), type: 'frame' },
      { ...rectangle('inner', { parentId: 'outer', x: 180, y: 160, width: 200, height: 140 }), type: 'frame' },
      rectangle('shape', { x: 20, y: 20 }),
    ];

    expect(resolveFrameDrop(['shape'], shapes, { x: 220, y: 190 }, registry)).toEqual({
      parentId: 'inner',
      highlightTargetId: 'inner',
    });
    expect(resolveFrameDrop(['shape'], shapes, { x: 600, y: 500 }, registry)).toEqual({
      parentId: 'root',
      highlightTargetId: null,
    });
  });

  it('does not reparent selected descendants separately or create hierarchy cycles', () => {
    const shapes = [
      { ...rectangle('frame', { x: 100, y: 100, width: 300, height: 200 }), type: 'frame' },
      rectangle('child', { parentId: 'frame', x: 140, y: 130 }),
      { ...rectangle('target', { x: 500, y: 100, width: 300, height: 200 }), type: 'frame' },
    ];

    expect(topLevelSelectionIds(['frame', 'child'], shapes)).toEqual(['frame']);
    expect(resolveFrameDrop(['frame'], shapes, { x: 150, y: 150 }, registry)).toEqual({
      parentId: 'root',
      highlightTargetId: null,
    });
  });

  it('highlights only a frame that will actually become a new parent', () => {
    const shapes = [
      { ...rectangle('frame', { x: 100, y: 100, width: 300, height: 200 }), type: 'frame' },
      rectangle('child', { parentId: 'frame', x: 140, y: 130 }),
      rectangle('root-shape', { x: 20, y: 20 }),
    ];

    expect(resolveFrameDrop(['child'], shapes, { x: 180, y: 160 }, registry)).toEqual({
      parentId: 'frame',
      highlightTargetId: null,
    });
    expect(resolveFrameDrop(['root-shape'], shapes, { x: 180, y: 160 }, registry)).toEqual({
      parentId: 'frame',
      highlightTargetId: 'frame',
    });
  });
});
