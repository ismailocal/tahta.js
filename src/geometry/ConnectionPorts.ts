import type { Point, Shape } from '../core/types.js';
import type { ShapeRegistry } from '../core/registry.js';
import { UI_CONSTANTS } from '../core/constants.js';
import type { ShapeSpatialIndex } from './SpatialIndex.js';
import { getShapePlugin } from '../plugins/index.js';

export interface NearestConnectionPort {
  readonly shape: Shape;
  readonly portId: string;
  readonly x: number;
  readonly y: number;
}

export function findNearestConnectionPort(
  cursor: Point,
  spatialIndex: ShapeSpatialIndex,
  registry: ShapeRegistry,
  excludeIds: readonly string[] = [],
): NearestConnectionPort | null {
  const radius = UI_CONSTANTS.PORT_SNAP_RADIUS;
  const excluded = new Set(excludeIds);
  let nearest: NearestConnectionPort | null = null;
  let nearestDistance = radius;

  const candidates = spatialIndex.queryBounds({
    x: cursor.x - radius,
    y: cursor.y - radius,
    width: radius * 2,
    height: radius * 2,
  });
  for (const shape of candidates) {
    if (excluded.has(shape.id)) continue;
    const plugin = getShapePlugin(registry, shape.type);
    if (plugin.isConnector || !plugin.getConnectionPoints) continue;
    for (const port of plugin.getConnectionPoints(shape)) {
      const distance = Math.hypot(cursor.x - port.x, cursor.y - port.y);
      if (distance >= nearestDistance) continue;
      nearestDistance = distance;
      nearest = { shape, portId: port.id, x: port.x, y: port.y };
    }
  }
  return nearest;
}
