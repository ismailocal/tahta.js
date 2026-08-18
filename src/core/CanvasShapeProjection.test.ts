import { describe, expect, it } from 'vitest';
import { createBuiltinShapeRegistry } from './builtinRegistry';
import { createCanvasEngine } from './CanvasEngine';
import { CanvasShapeProjection } from './CanvasShapeProjection';
import { shapesToSnapshot } from './projection';
import type { Shape } from './types';

const rectangle = (id: string, x: number): Shape => ({
  id,
  type: 'rectangle',
  x,
  y: 0,
  width: 100,
  height: 100,
});

describe('CanvasShapeProjection', () => {
  it('preserves unchanged shape references and reports index-ready changes', () => {
    const registry = createBuiltinShapeRegistry();
    const engine = createCanvasEngine({
      documentId: 'projection-test',
      registry,
      initialSnapshot: shapesToSnapshot(
        'projection-test',
        [rectangle('a', 0), rectangle('b', 200)],
        registry,
        {},
      ),
    });
    const projection = new CanvasShapeProjection(registry);

    const before = projection.project(engine.getViewState());
    engine.dispatch({ type: 'shape.update', id: 'a', patch: { x: 50 } });
    const after = projection.project(engine.getViewState());

    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(projection.changes).toEqual([{ id: 'a', shape: after[0] }]);
    engine.destroy();
  });

  it('reprojects descendants when their frame moves without rewriting child records', () => {
    const registry = createBuiltinShapeRegistry();
    const frame = { ...rectangle('frame', 100), type: 'frame', width: 300, height: 200 };
    const child = { ...rectangle('child', 140), parentId: 'frame' };
    const engine = createCanvasEngine({
      documentId: 'projection-frame-test',
      registry,
      initialSnapshot: shapesToSnapshot('projection-frame-test', [frame, child], registry, {}),
    });
    const projection = new CanvasShapeProjection(registry);

    const before = projection.project(engine.getViewState());
    const childRecordBefore = engine.getSnapshot().records.find(({ id }) => id === 'child');
    engine.dispatch({ type: 'shape.update', id: 'frame', patch: { x: 200 } });
    const after = projection.project(engine.getViewState());

    expect(after.find(({ id }) => id === 'child')).toMatchObject({ x: 240, parentId: 'frame' });
    expect(after.find(({ id }) => id === 'child')).not.toBe(before.find(({ id }) => id === 'child'));
    expect(engine.getSnapshot().records.find(({ id }) => id === 'child')).toEqual(childRecordBefore);
    engine.destroy();
  });
});
