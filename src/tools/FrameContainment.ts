import { ROOT_PARENT_ID } from '../core/model.js';
import type { Shape, Point } from '../core/types.js';
import type { ShapeRegistry } from '../core/registry.js';
import { getShapeBounds } from '../geometry/Geometry.js';

function parentId(shape: Shape): string {
  return shape.parentId ?? ROOT_PARENT_ID;
}

function hasAncestor(shapeId: string, ancestorIds: ReadonlySet<string>, shapesById: ReadonlyMap<string, Shape>): boolean {
  let current = shapesById.get(shapeId);
  const visited = new Set<string>();
  while (current && parentId(current) !== ROOT_PARENT_ID) {
    const currentParentId = parentId(current);
    if (ancestorIds.has(currentParentId)) return true;
    if (visited.has(currentParentId)) return false;
    visited.add(currentParentId);
    current = shapesById.get(currentParentId);
  }
  return false;
}

function pointInShapeBounds(point: Point, shape: Shape, registry: ShapeRegistry): boolean {
  const bounds = getShapeBounds(shape, registry);
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

export function topLevelSelectionIds(selectedIds: readonly string[], shapes: readonly Shape[]): string[] {
  const selected = new Set(selectedIds);
  const shapesById = new Map(shapes.map((shape) => [shape.id, shape]));
  return selectedIds.filter((id) => {
    const shape = shapesById.get(id);
    return Boolean(shape && !shape.locked && !hasAncestor(id, selected, shapesById));
  });
}

export function commonParentId(shapeIds: readonly string[], shapes: readonly Shape[]): string | null {
  if (shapeIds.length === 0) return null;
  const shapesById = new Map(shapes.map((shape) => [shape.id, shape]));
  const firstShape = shapesById.get(shapeIds[0]);
  if (!firstShape) return null;
  const commonParent = parentId(firstShape);
  return shapeIds.every((id) => {
    const shape = shapesById.get(id);
    return shape !== undefined && parentId(shape) === commonParent;
  }) ? commonParent : null;
}

export interface FrameDropResolution {
  parentId: string;
  highlightTargetId: string | null;
}

export function resolveFrameDrop(
  selectedIds: readonly string[],
  shapes: readonly Shape[],
  dropPoint: Point,
  registry: ShapeRegistry,
): FrameDropResolution {
  const movingIds = new Set(topLevelSelectionIds(selectedIds, shapes));
  if (movingIds.size === 0) return { parentId: ROOT_PARENT_ID, highlightTargetId: null };
  const shapesById = new Map(shapes.map((shape) => [shape.id, shape]));

  const target = [...shapes].reverse().find((shape) => shape.type === 'frame'
    && !shape.locked
    && !movingIds.has(shape.id)
    && !hasAncestor(shape.id, movingIds, shapesById)
    && pointInShapeBounds(dropPoint, shape, registry));
  const destinationParentId = target?.id ?? ROOT_PARENT_ID;
  const changesParent = target !== undefined && [...movingIds].some((id) => {
    const movingShape = shapesById.get(id);
    return movingShape && parentId(movingShape) !== destinationParentId;
  });
  return {
    parentId: destinationParentId,
    highlightTargetId: changesParent ? destinationParentId : null,
  };
}

export function shapesContainedByFrame(
  frameId: string,
  shapes: readonly Shape[],
  registry: ShapeRegistry,
): string[] {
  const frame = shapes.find((shape) => shape.id === frameId);
  if (!frame || frame.type !== 'frame') return [];
  const frameBounds = getShapeBounds(frame, registry);
  const currentParentId = parentId(frame);
  return shapes.filter((shape) => {
    if (shape.id === frame.id || shape.locked || parentId(shape) !== currentParentId) return false;
    const bounds = getShapeBounds(shape, registry);
    return bounds.x >= frameBounds.x
      && bounds.y >= frameBounds.y
      && bounds.x + bounds.width <= frameBounds.x + frameBounds.width
      && bounds.y + bounds.height <= frameBounds.y + frameBounds.height;
  }).map(({ id }) => id);
}
