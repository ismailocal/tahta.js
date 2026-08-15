import { describe, expect, it } from 'vitest';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import type { Shape } from '../core/types';
import { attachBuiltinShapeRuntimes } from '../plugins';
import { findNearestConnectionPort } from './ConnectionPorts';
import { createShapeSpatialIndex } from './SpatialIndex';

describe('findNearestConnectionPort', () => {
  it('queries only nearby indexed shapes and respects exclusions', () => {
    const registry = createBuiltinShapeRegistry();
    attachBuiltinShapeRuntimes(registry);
    const near: Shape = { id: 'near', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
    const far: Shape = { id: 'far', type: 'rectangle', x: 10_000, y: 10_000, width: 100, height: 100 };
    const index = createShapeSpatialIndex([near, far], registry);

    expect(findNearestConnectionPort({ x: 50, y: 0 }, index, registry)?.shape.id).toBe('near');
    expect(findNearestConnectionPort({ x: 50, y: 0 }, index, registry, ['near'])).toBeNull();
  });
});
