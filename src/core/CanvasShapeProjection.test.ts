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
});
