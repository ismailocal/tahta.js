import type { ShapeRecord } from './model.js';
import { CANVAS_LIMITS, CanvasValidationError, ROOT_PARENT_ID } from './model.js';

export interface Transform2D {
  x: number;
  y: number;
  rotation: number;
}
export function rotatePoint(point: { x: number; y: number }, rotation: number): { x: number; y: number } {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}

export function composeTransform(parent: Transform2D, local: Transform2D): Transform2D {
  const translated = rotatePoint({ x: local.x, y: local.y }, parent.rotation);
  return {
    x: parent.x + translated.x,
    y: parent.y + translated.y,
    rotation: parent.rotation + local.rotation,
  };
}

export function toLocalTransform(parent: Transform2D, world: Transform2D): Transform2D {
  const translated = rotatePoint(
    { x: world.x - parent.x, y: world.y - parent.y },
    -parent.rotation,
  );
  return {
    x: translated.x,
    y: translated.y,
    rotation: world.rotation - parent.rotation,
  };
}

export function getWorldTransform(recordId: string, records: ReadonlyMap<string, ShapeRecord>): Transform2D {
  let current = records.get(recordId);
  if (!current) throw new CanvasValidationError(`Shape '${recordId}' does not exist`, 'SHAPE_NOT_FOUND');

  let transform: Transform2D = { x: current.x, y: current.y, rotation: current.rotation };
  const visited = new Set([current.id]);
  let depth = 0;

  while (current.parentId !== ROOT_PARENT_ID) {
    if (++depth > CANVAS_LIMITS.nestingDepth) {
      throw new CanvasValidationError('Canvas hierarchy exceeds the nesting limit', 'NESTING_LIMIT');
    }
    const parent = records.get(current.parentId);
    if (!parent) {
      throw new CanvasValidationError(`Parent '${current.parentId}' does not exist`, 'PARENT_NOT_FOUND');
    }
    if (visited.has(parent.id)) {
      throw new CanvasValidationError('Canvas hierarchy contains a cycle', 'HIERARCHY_CYCLE');
    }
    visited.add(parent.id);
    transform = composeTransform(
      { x: parent.x, y: parent.y, rotation: parent.rotation },
      transform,
    );
    current = parent;
  }
  return transform;
}

export function assertCanReparent(
  recordIds: readonly string[],
  parentId: string,
  records: ReadonlyMap<string, ShapeRecord>,
): void {
  if (parentId !== ROOT_PARENT_ID && !records.has(parentId)) {
    throw new CanvasValidationError(`Parent '${parentId}' does not exist`, 'PARENT_NOT_FOUND');
  }
  const moving = new Set(recordIds);
  let currentId = parentId;
  let depth = 0;
  while (currentId !== ROOT_PARENT_ID) {
    if (moving.has(currentId)) {
      throw new CanvasValidationError('A shape cannot be parented to itself or its descendant', 'HIERARCHY_CYCLE');
    }
    const current = records.get(currentId);
    if (!current) throw new CanvasValidationError(`Parent '${currentId}' does not exist`, 'PARENT_NOT_FOUND');
    currentId = current.parentId;
    if (++depth > CANVAS_LIMITS.nestingDepth) {
      throw new CanvasValidationError('Canvas hierarchy exceeds the nesting limit', 'NESTING_LIMIT');
    }
  }
}
