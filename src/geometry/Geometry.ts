import type { Point, Shape, CanvasState } from '../core/types';
import type { ShapeRegistry } from '../core/registry';
import { getShapePlugin } from '../plugins/index';

export { pointToSegmentDistance, pointToQuadraticBezierDistance } from './GeometryUtils';
export const screenToWorld = (screen: Point, viewport: CanvasState['viewport']): Point => ({
  x: (screen.x - viewport.x) / viewport.zoom,
  y: (screen.y - viewport.y) / viewport.zoom,
});

const boundsCaches = new WeakMap<ShapeRegistry, WeakMap<Shape, { x: number, y: number, width: number, height: number }>>();

export function getShapeBounds(shape: Shape, registry: ShapeRegistry) {
  let boundsCache = boundsCaches.get(registry);
  if (!boundsCache) {
    boundsCache = new WeakMap();
    boundsCaches.set(registry, boundsCache);
  }
  if (boundsCache.has(shape)) return boundsCache.get(shape)!;
  const bounds = getShapePlugin(registry, shape.type).getBounds(shape);
  boundsCache.set(shape, bounds);
  return bounds;
}

function isPointInsideLabel(point: Point, shape: Shape, allShapes: Shape[], registry: ShapeRegistry): boolean {
  if (!shape.text || shape.type === 'text') return false;
  const plugin = getShapePlugin(registry, shape.type);
  const fontSize = shape.fontSize || 20;
  const lines = shape.text.split('\n');

  let cx = shape.x;
  let cy = shape.y;

  const textAnchor = plugin.getTextAnchor?.(shape, []);
  if (textAnchor) {
    cx = textAnchor.x;
    cy = textAnchor.y;
  } else {
    const bounds = getShapeBounds(shape, registry);
    cx = bounds.x + bounds.width / 2;
    cy = bounds.y + bounds.height / 2;
  }

  const h = lines.length * fontSize * 1.25;
  const w = Math.max(40, ...lines.map(line => line.length * fontSize * 0.62));

  return point.x >= cx - w/2 && point.x <= cx + w/2 && point.y >= cy - h/2 && point.y <= cy + h/2;
}

function isPointInsideShape(point: Point, shape: Shape, allShapes: Shape[], registry: ShapeRegistry): boolean {
  if (isPointInsideLabel(point, shape, allShapes, registry)) return true;
  return getShapePlugin(registry, shape.type).isPointInside(point, shape, allShapes);
}

export type HandleType = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | 'start' | 'end';

export function getHandleAtPoint(shape: Shape, point: Point, allShapes: Shape[], registry: ShapeRegistry): string | null {
  const plugin = getShapePlugin(registry, shape.type);
  if (!plugin.getHandleAtPoint) return null;
  return plugin.getHandleAtPoint(shape, point, allShapes);
}

export function getTopShapeAtPoint(shapes: Shape[], point: Point, registry: ShapeRegistry, spatialIndex?: { queryPoint(point: Point): Shape[] }): Shape | null {
  // If spatial index is provided, use it for faster lookup
  if (spatialIndex) {
    const candidates = spatialIndex.queryPoint(point);
    const candidateIds = new Set(candidates.map((s: Shape) => s.id));
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (candidateIds.has(shapes[i].id) && isPointInsideShape(point, shapes[i], shapes, registry)) {
        return shapes[i];
      }
    }
    return null;
  }

  for (let i = shapes.length - 1; i >= 0; i--) {
    if (isPointInsideShape(point, shapes[i], shapes, registry)) {
      return shapes[i];
    }
  }
  return null;
}
