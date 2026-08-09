import type { ShapeRecord } from '../core/model.js';
import type { ShapeBounds, ShapeRegistry } from '../core/registry.js';

export interface Point { x: number; y: number }
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
export interface SnapLine { x1: number; y1: number; x2: number; y2: number }

export function selectionBounds(records: readonly ShapeRecord[], registry: ShapeRegistry): ShapeBounds | null {
  if (!records.length) return null;
  const bounds = records.map((record) => registry.get(record.type).geometry.getBounds(record));
  const x = Math.min(...bounds.map((value) => value.x));
  const y = Math.min(...bounds.map((value) => value.y));
  const right = Math.max(...bounds.map((value) => value.x + value.width));
  const bottom = Math.max(...bounds.map((value) => value.y + value.height));
  return { x, y, width: right - x, height: bottom - y };
}

export function normalizedBox(start: Point, end: Point): ShapeBounds {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

export function intersects(left: ShapeBounds, right: ShapeBounds): boolean {
  return left.x <= right.x + right.width && left.x + left.width >= right.x && left.y <= right.y + right.height && left.y + left.height >= right.y;
}

export function resizeHandlePoints(bounds: ShapeBounds): Record<ResizeHandle, Point> {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return {
    nw: { x: bounds.x, y: bounds.y }, n: { x: centerX, y: bounds.y }, ne: { x: bounds.x + bounds.width, y: bounds.y },
    w: { x: bounds.x, y: centerY }, e: { x: bounds.x + bounds.width, y: centerY },
    sw: { x: bounds.x, y: bounds.y + bounds.height }, s: { x: centerX, y: bounds.y + bounds.height }, se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  };
}

export function resizeHandleAtPoint(bounds: ShapeBounds, point: Point, zoom: number): ResizeHandle | null {
  const threshold = 9 / zoom;
  for (const [handle, position] of Object.entries(resizeHandlePoints(bounds)) as [ResizeHandle, Point][]) {
    if (Math.abs(point.x - position.x) <= threshold && Math.abs(point.y - position.y) <= threshold) return handle;
  }
  return null;
}

export function connectorEndpointAtPoint(record: ShapeRecord, point: Point, zoom: number): 'start' | 'end' | null {
  if (record.type !== 'line' && record.type !== 'arrow') return null;
  const points = (record.props as { points: Point[] }).points;
  if (points.length < 2) return null;
  const cosine = Math.cos(record.rotation); const sine = Math.sin(record.rotation);
  const world = (value: Point) => ({ x: record.x + value.x * cosine - value.y * sine, y: record.y + value.x * sine + value.y * cosine });
  const start = world(points[0]!); const end = world(points.at(-1)!); const threshold = 12 / zoom;
  if (Math.hypot(point.x - start.x, point.y - start.y) <= threshold) return 'start';
  if (Math.hypot(point.x - end.x, point.y - end.y) <= threshold) return 'end';
  return null;
}

export function snapTranslation(
  moving: ShapeBounds,
  delta: Point,
  candidates: readonly ShapeBounds[],
  zoom: number,
): { delta: Point; lines: SnapLine[] } {
  const translated = { x: moving.x + delta.x, y: moving.y + delta.y, width: moving.width, height: moving.height };
  const movingX = [translated.x, translated.x + translated.width / 2, translated.x + translated.width];
  const movingY = [translated.y, translated.y + translated.height / 2, translated.y + translated.height];
  const threshold = 5 / zoom;
  let bestX: { distance: number; adjustment: number; line: SnapLine } | null = null;
  let bestY: { distance: number; adjustment: number; line: SnapLine } | null = null;
  candidates.forEach((candidate) => {
    const candidateX = [candidate.x, candidate.x + candidate.width / 2, candidate.x + candidate.width];
    const candidateY = [candidate.y, candidate.y + candidate.height / 2, candidate.y + candidate.height];
    movingX.forEach((source) => candidateX.forEach((target) => {
      const distance = Math.abs(target - source); if (distance > threshold || (bestX && distance >= bestX.distance)) return;
      bestX = { distance, adjustment: target - source, line: { x1: target, y1: Math.min(translated.y, candidate.y) - 20 / zoom, x2: target, y2: Math.max(translated.y + translated.height, candidate.y + candidate.height) + 20 / zoom } };
    }));
    movingY.forEach((source) => candidateY.forEach((target) => {
      const distance = Math.abs(target - source); if (distance > threshold || (bestY && distance >= bestY.distance)) return;
      bestY = { distance, adjustment: target - source, line: { x1: Math.min(translated.x, candidate.x) - 20 / zoom, y1: target, x2: Math.max(translated.x + translated.width, candidate.x + candidate.width) + 20 / zoom, y2: target } };
    }));
  });
  const horizontal = bestX as { adjustment: number; line: SnapLine } | null;
  const vertical = bestY as { adjustment: number; line: SnapLine } | null;
  return {
    delta: { x: delta.x + (horizontal?.adjustment ?? 0), y: delta.y + (vertical?.adjustment ?? 0) },
    lines: [horizontal?.line, vertical?.line].filter((line): line is SnapLine => Boolean(line)),
  };
}

export function cursorForResizeHandle(handle: ResizeHandle): string {
  if (handle === 'n' || handle === 's') return 'ns-resize';
  if (handle === 'e' || handle === 'w') return 'ew-resize';
  if (handle === 'nw' || handle === 'se') return 'nwse-resize';
  return 'nesw-resize';
}
