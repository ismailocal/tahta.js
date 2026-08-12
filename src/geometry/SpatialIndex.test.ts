import { describe, expect, it } from 'vitest';
import type { Shape } from '../core/types';
import { createShapeSpatialIndex } from './SpatialIndex';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import { attachBuiltinShapeRuntimes } from '../plugins';

const registry = createBuiltinShapeRegistry();
attachBuiltinShapeRuntimes(registry);

const shape = (id: string, x: number, y: number): Shape => ({
  id,
  type: 'rectangle' as Shape['type'],
  x,
  y,
  width: 20,
  height: 20,
});

describe('shape spatial index', () => {
  it('returns only shapes intersecting a viewport bounds query', () => {
    const shapes = Array.from({ length: 100 }, (_, index) => shape(String(index), index * 100, index * 100));
    const index = createShapeSpatialIndex(shapes, registry);
    expect(index.queryBounds({ x: 0, y: 0, width: 150, height: 150 }).map(({ id }) => id).sort()).toEqual(['0', '1']);
  });

  it('finds point hits across spatial hash cells', () => {
    const shapes = Array.from({ length: 30 }, (_, index) => shape(String(index), index * 50, 10));
    const index = createShapeSpatialIndex(shapes, registry);
    expect(index.queryPoint({ x: 510, y: 20 }).map(({ id }) => id)).toContain('10');
  });

  it('updates and removes only the changed entries', () => {
    const original = [shape('a', 0, 0), shape('b', 100, 100)];
    const index = createShapeSpatialIndex(original, registry);
    const moved = { ...original[0], x: 1_000 };

    index.update([moved, original[1]], ['a']);
    expect(index.queryPoint({ x: 10, y: 10 })).toEqual([]);
    expect(index.queryPoint({ x: 1_010, y: 10 }).map(({ id }) => id)).toEqual(['a']);

    index.update([moved], ['b']);
    expect(index.queryPoint({ x: 110, y: 110 })).toEqual([]);
  });

  it('keeps very large shapes queryable without expanding unbounded cells', () => {
    const large = { ...shape('large', -1_000_000, -1_000_000), width: 2_000_000, height: 2_000_000 };
    const index = createShapeSpatialIndex([large], registry);
    expect(index.queryPoint({ x: 0, y: 0 }).map(({ id }) => id)).toEqual(['large']);
  });

  it('maintains connector adjacency incrementally', () => {
    const target = shape('target', 0, 0);
    const connector: Shape = {
      id: 'connector',
      type: 'arrow',
      x: 0,
      y: 0,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      startBinding: { elementId: target.id },
    };
    const index = createShapeSpatialIndex([target, connector], registry);
    expect([...index.expandConnected(new Set([target.id]))]).toEqual(expect.arrayContaining(['target', 'connector']));

    const detached = { ...connector, startBinding: undefined };
    index.update([target, detached], [connector.id]);
    expect([...index.expandConnected(new Set([target.id]))]).toEqual(['target']);
  });
});
