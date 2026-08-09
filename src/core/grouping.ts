import { generateKeyBetween } from 'fractional-indexing';
import type { CanvasEngine } from './CanvasEngine.js';
import { CanvasValidationError, compareFractionalIndex, ROOT_PARENT_ID } from './model.js';

export function groupSelection(engine: CanvasEngine): string {
  const state = engine.getViewState(); if (state.selectedIds.length < 2) throw new CanvasValidationError('Select at least two shapes to group', 'GROUP_SELECTION_EMPTY');
  const records = state.snapshot.records.filter(({ id }) => state.selectedIds.includes(id));
  if (records.some(({ locked }) => locked)) throw new CanvasValidationError('Locked shapes cannot be grouped', 'SHAPE_LOCKED');
  const parents = new Set(records.map(({ parentId }) => parentId)); if (parents.size !== 1) throw new CanvasValidationError('Grouped shapes must share the same parent', 'GROUP_PARENT_MISMATCH');
  const parentId = records[0]!.parentId; const bounds = records.map((record) => engine.registry.get(record.type).geometry.getBounds(record));
  const minX = Math.min(...bounds.map(({ x }) => x)); const minY = Math.min(...bounds.map(({ y }) => y)); const maxX = Math.max(...bounds.map(({ x, width }) => x + width)); const maxY = Math.max(...bounds.map(({ y, height }) => y + height));
  const siblings = state.snapshot.records.filter((record) => record.parentId === parentId).sort((a, b) => compareFractionalIndex(a.index, b.index)); const definition = engine.registry.get('group'); const id = crypto.randomUUID();
  const record = engine.registry.validate({ id, type: 'group', typeVersion: definition.version, parentId: parentId || ROOT_PARENT_ID, index: generateKeyBetween(siblings.at(-1)?.index ?? null, null), x: minX, y: minY, rotation: 0, opacity: 1, locked: false, hidden: false, props: { width: maxX - minX, height: maxY - minY } });
  engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record }, { type: 'shape.reparent', ids: records.map(({ id: childId }) => childId), parentId: id }] }); engine.setViewState({ selectedIds: [id] }); return id;
}

export function ungroupSelection(engine: CanvasEngine): void {
  const state = engine.getViewState(); const groups = state.snapshot.records.filter(({ id, type }) => type === 'group' && state.selectedIds.includes(id));
  if (!groups.length) throw new CanvasValidationError('Select a group to ungroup', 'GROUP_SELECTION_EMPTY');
  const commands: Parameters<CanvasEngine['dispatch']>[0][] = [];
  groups.forEach((group) => { const children = state.snapshot.records.filter(({ parentId }) => parentId === group.id); if (children.length) commands.push({ type: 'shape.reparent', ids: children.map(({ id }) => id), parentId: group.parentId }); commands.push({ type: 'shape.delete', ids: [group.id], mode: 'only' }); });
  engine.dispatch({ type: 'batch', commands });
}
