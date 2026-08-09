import { generateKeyBetween } from 'fractional-indexing';
import type { CanvasEngine } from './CanvasEngine.js';
import { CanvasValidationError, compareFractionalIndex, type BindingRecord, type ShapeRecord } from './model.js';

export type QuickCreateDirection = 'left' | 'right' | 'up' | 'down';

export interface QuickCreateOptions {
  sourceId: string;
  direction: QuickCreateDirection;
  shapeType?: string;
  gap?: number;
}

export interface QuickCreateResult { shapeId: string; connectorId: string; bindingId: string }

export function quickCreate(engine: CanvasEngine, options: QuickCreateOptions): QuickCreateResult {
  const snapshot = engine.getSnapshot();
  const source = snapshot.records.find(({ id }) => id === options.sourceId);
  if (!source) throw new CanvasValidationError(`Shape '${options.sourceId}' does not exist`, 'SHAPE_NOT_FOUND');
  if (source.type === 'line' || source.type === 'arrow' || source.type === 'freehand') throw new CanvasValidationError('Quick Create requires a node shape', 'INVALID_QUICK_CREATE_SOURCE');
  const definition = engine.registry.get(options.shapeType ?? 'rectangle');
  const props = definition.defaults() as Record<string, unknown>;
  if (typeof props.width !== 'number' || typeof props.height !== 'number') throw new CanvasValidationError(`Shape '${definition.type}' cannot be quick-created`, 'INVALID_QUICK_CREATE_TARGET');
  const sourceBounds = engine.registry.get(source.type).geometry.getBounds(source);
  const gap = Math.max(24, Math.min(1_000, options.gap ?? 80));
  let x = source.x; let y = source.y;
  if (options.direction === 'right') x = sourceBounds.x + sourceBounds.width + gap;
  if (options.direction === 'left') x = sourceBounds.x - props.width - gap;
  if (options.direction === 'down') y = sourceBounds.y + sourceBounds.height + gap;
  if (options.direction === 'up') y = sourceBounds.y - props.height - gap;
  const siblings = snapshot.records.filter(({ parentId }) => parentId === source.parentId).sort((a, b) => compareFractionalIndex(a.index, b.index));
  let index = generateKeyBetween(siblings.at(-1)?.index ?? null, null);
  const shapeId = crypto.randomUUID();
  const shape: ShapeRecord = engine.registry.validate({ id: shapeId, type: definition.type, typeVersion: definition.version, parentId: source.parentId, index, x, y, rotation: 0, opacity: 1, locked: false, hidden: false, props });
  const targetBounds = definition.geometry.getBounds(shape);
  const sourceCenter = { x: sourceBounds.x + sourceBounds.width / 2, y: sourceBounds.y + sourceBounds.height / 2 };
  const targetCenter = { x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + targetBounds.height / 2 };
  const arrow = engine.registry.get('arrow'); index = generateKeyBetween(index, null);
  const connectorId = crypto.randomUUID();
  const connector: ShapeRecord = engine.registry.validate({ id: connectorId, type: 'arrow', typeVersion: arrow.version, parentId: source.parentId, index, x: sourceCenter.x, y: sourceCenter.y, rotation: 0, opacity: 1, locked: false, hidden: false, props: { ...(arrow.defaults() as Record<string, unknown>), edgeStyle: 'elbow', points: [{ x: 0, y: 0 }, { x: targetCenter.x - sourceCenter.x, y: targetCenter.y - sourceCenter.y }] } });
  const bindingId = crypto.randomUUID();
  const binding: BindingRecord = { id: bindingId, connectorId, start: { shapeId: source.id }, end: { shapeId } };
  engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: shape }, { type: 'shape.create', record: connector }, { type: 'binding.set', binding }] });
  engine.setViewState({ selectedIds: [shapeId], activeTool: 'select' });
  return { shapeId, connectorId, bindingId };
}
