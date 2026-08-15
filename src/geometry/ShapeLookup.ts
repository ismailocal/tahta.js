import type { Shape } from '../core/types.js';

const lookupByScene = new WeakMap<readonly Shape[], ReadonlyMap<string, Shape>>();

export function getShapeLookup(shapes: readonly Shape[]): ReadonlyMap<string, Shape> {
  const cached = lookupByScene.get(shapes);
  if (cached) return cached;
  const lookup = new Map(shapes.map((shape) => [shape.id, shape]));
  lookupByScene.set(shapes, lookup);
  return lookup;
}

export function getShapeById(shapes: readonly Shape[], id: string): Shape | undefined {
  return getShapeLookup(shapes).get(id);
}
