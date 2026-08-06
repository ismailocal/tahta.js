import { describe, expect, it } from 'vitest';
import type { Shape } from '../core/types';
import { createShapeSpatialIndex } from './SpatialIndex';

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
    const index = createShapeSpatialIndex(shapes);
    expect(index.queryBounds({ x: 0, y: 0, width: 150, height: 150 }).map(({ id }) => id).sort()).toEqual(['0', '1']);
  });

  it('finds point hits after the quadtree splits', () => {
    const shapes = Array.from({ length: 30 }, (_, index) => shape(String(index), index * 50, 10));
    const index = createShapeSpatialIndex(shapes);
    expect(index.queryPoint({ x: 510, y: 20 }).map(({ id }) => id)).toContain('10');
  });
});
