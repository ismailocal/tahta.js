import type { Point, Shape, CanvasState } from '../core/types';
import { UI_CONSTANTS } from '../core/constants';
import { getTextMetrics } from '../core/Utils';

import { distance, getRayBoxIntersection, getRayEllipseIntersection, pointToSegmentDistance } from './GeometryUtils';

export { distance, getRayBoxIntersection, getRayEllipseIntersection, pointToSegmentDistance };
export const screenToWorld = (screen: Point, viewport: CanvasState['viewport']): Point => ({
  x: (screen.x - viewport.x) / viewport.zoom,
  y: (screen.y - viewport.y) / viewport.zoom,
});

import { getArrowClippedEndpoints } from './lineUtils';
export { getArrowClippedEndpoints };
import { PluginRegistry } from '../plugins/index';

const boundsCache = new WeakMap<Shape, { x: number, y: number, width: number, height: number }>();

export function getShapeBounds(shape: Shape) {
  if (boundsCache.has(shape)) return boundsCache.get(shape)!;
  
  if (PluginRegistry.hasPlugin(shape.type)) {
    const bounds = PluginRegistry.getPlugin(shape.type).getBounds(shape);
    boundsCache.set(shape, bounds);
    return bounds;
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}

export function isShapeVisible(shape: Shape, viewport: CanvasState['viewport'], width: number, height: number): boolean {
  const bounds = getShapeBounds(shape);
  const vx = -viewport.x / viewport.zoom;
  const vy = -viewport.y / viewport.zoom;
  const vw = width / viewport.zoom;
  const vh = height / viewport.zoom;

  return (
    bounds.x + bounds.width >= vx &&
    bounds.x <= vx + vw &&
    bounds.y + bounds.height >= vy &&
    bounds.y <= vy + vh
  );
}

export function isPointInsideLabel(point: Point, shape: Shape, allShapes: Shape[] = []): boolean {
  if (!shape.text || shape.type === 'text') return false;
  if (!PluginRegistry.hasPlugin(shape.type)) return false;

  const plugin = PluginRegistry.getPlugin(shape.type);
  const fontSize = shape.fontSize || 20;
  const lines = shape.text.split('\n');

  let cx = shape.x;
  let cy = shape.y;

  const textAnchor = plugin.getTextAnchor?.(shape, []);
  if (textAnchor) {
    cx = textAnchor.x;
    cy = textAnchor.y;
  } else {
    const bounds = getShapeBounds(shape);
    cx = bounds.x + bounds.width / 2;
    cy = bounds.y + bounds.height / 2;
  }

  const h = lines.length * fontSize * 1.25;
  const w = Math.max(40, ...lines.map(line => line.length * fontSize * 0.62));

  return point.x >= cx - w/2 && point.x <= cx + w/2 && point.y >= cy - h/2 && point.y <= cy + h/2;
}

export function isPointInsideShape(point: Point, shape: Shape, allShapes: Shape[] = []): boolean {
  if (isPointInsideLabel(point, shape, allShapes)) return true;

  if (PluginRegistry.hasPlugin(shape.type)) {
    return PluginRegistry.getPlugin(shape.type).isPointInside(point, shape, allShapes);
  }

  return false;
}

export type HandleType = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | 'start' | 'end';

export function getHandleAtPoint(shape: Shape, point: Point, allShapes: Shape[]): string | null {
  if (!PluginRegistry.hasPlugin(shape.type)) return null;
  const plugin = PluginRegistry.getPlugin(shape.type);
  if (!plugin.getHandleAtPoint) return null;
  return plugin.getHandleAtPoint(shape, point, allShapes);
}

export function getTopShapeAtPoint(shapes: Shape[], point: Point, spatialIndex?: any): Shape | null {
  // If spatial index is provided, use it for faster lookup
  if (spatialIndex) {
    const candidates = spatialIndex.queryPoint(point);
    const candidateIds = new Set(candidates.map((s: Shape) => s.id));
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (candidateIds.has(shapes[i].id) && isPointInsideShape(point, shapes[i], shapes)) {
        return shapes[i];
      }
    }
    return null;
  }

  for (let i = shapes.length - 1; i >= 0; i--) {
    if (isPointInsideShape(point, shapes[i], shapes)) {
      return shapes[i];
    }
  }
  return null;
}
