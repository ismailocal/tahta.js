import { generateKeyBetween } from 'fractional-indexing';
import { z } from 'zod';
import type { CanvasEngine } from './CanvasEngine.js';
import type { CanvasCommand } from './commands.js';
import {
  assertJsonSize, assetRecordSchema, bindingRecordSchema, CanvasValidationError, compareFractionalIndex,
  ROOT_PARENT_ID, shapeRecordSchema, type AssetRecord, type BindingRecord, type ShapeRecord,
} from './model.js';
import { getWorldTransform } from './transforms.js';

export const TAHTA_CLIPBOARD_MIME = 'application/vnd.tahta.records+json';
const clipboardSchema = z.object({
  type: z.literal('tahta-clipboard'),
  version: z.literal(1),
  records: z.array(shapeRecordSchema).max(10_000),
  bindings: z.array(bindingRecordSchema).max(20_000),
  assets: z.array(assetRecordSchema).max(1_000),
});

export interface CanvasClipboardPayload {
  type: 'tahta-clipboard';
  version: 1;
  records: ShapeRecord[];
  bindings: BindingRecord[];
  assets: AssetRecord[];
}

function selectedWithDescendants(records: readonly ShapeRecord[], selectedIds: readonly string[]): Set<string> {
  const ids = new Set(selectedIds); let changed = true;
  while (changed) {
    changed = false;
    records.forEach((record) => { if (!ids.has(record.id) && ids.has(record.parentId)) { ids.add(record.id); changed = true; } });
  }
  return ids;
}

function referencedAssets(records: readonly ShapeRecord[]): Set<string> {
  const ids = new Set<string>();
  records.forEach((record) => {
    const props = record.props as Record<string, unknown>;
    for (const key of ['assetId', 'imageAssetId', 'faviconAssetId']) {
      const value = props[key]; if (typeof value === 'string') ids.add(value);
    }
  });
  return ids;
}

export function createClipboardPayload(engine: CanvasEngine, selectedIds = engine.getViewState().selectedIds): CanvasClipboardPayload {
  if (!selectedIds.length) throw new CanvasValidationError('Select at least one shape to copy', 'EMPTY_SELECTION');
  const snapshot = engine.getSnapshot(); const ids = selectedWithDescendants(snapshot.records, selectedIds);
  const records = snapshot.records.filter((record) => ids.has(record.id));
  const bindings = snapshot.bindings.filter((binding) => ids.has(binding.connectorId) && (!binding.start || ids.has(binding.start.shapeId)) && (!binding.end || ids.has(binding.end.shapeId)));
  const assetIds = referencedAssets(records); const assets = snapshot.assets.filter((asset) => assetIds.has(asset.id) || assetIds.has(asset.assetId));
  const payload: CanvasClipboardPayload = { type: 'tahta-clipboard', version: 1, records, bindings, assets };
  assertJsonSize(payload, 5 * 1024 * 1024, 'Clipboard payload'); return payload;
}

export function serializeClipboardPayload(payload: CanvasClipboardPayload): string { return JSON.stringify(payload); }

export function parseClipboardPayload(source: string): CanvasClipboardPayload {
  if (new TextEncoder().encode(source).byteLength > 5 * 1024 * 1024) throw new CanvasValidationError('Clipboard payload exceeds 5 MB', 'PAYLOAD_TOO_LARGE');
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new CanvasValidationError('Clipboard data is not valid JSON', 'INVALID_CLIPBOARD'); }
  return clipboardSchema.parse(parsed) as CanvasClipboardPayload;
}

export function pasteClipboardPayload(engine: CanvasEngine, payload: CanvasClipboardPayload, offset = { x: 32, y: 32 }): readonly string[] {
  const validated = clipboardSchema.parse(payload) as CanvasClipboardPayload;
  const snapshot = engine.getSnapshot(); const incomingIds = new Set(validated.records.map(({ id }) => id));
  const existingAssetIds = new Set(snapshot.assets.map(({ id }) => id));
  const shapeIds = new Map(validated.records.map((record) => [record.id, crypto.randomUUID()]));
  const assetIds = new Map(validated.assets.map((asset) => [asset.id, existingAssetIds.has(asset.id) ? asset.id : asset.id]));
  const sourceMap = new Map(validated.records.map((record) => [record.id, record]));
  const lastIndexes = new Map<string, string>();
  snapshot.records.forEach((record) => {
    const current = lastIndexes.get(record.parentId);
    if (current === undefined || compareFractionalIndex(record.index, current) > 0) lastIndexes.set(record.parentId, record.index);
  });
  const commands: CanvasCommand[] = validated.assets.filter((asset) => !existingAssetIds.has(asset.id)).map((asset) => ({ type: 'asset.set', asset }));
  const depth = (record: ShapeRecord): number => { let result = 0; let parentId = record.parentId; const seen = new Set<string>(); while (incomingIds.has(parentId)) { if (seen.has(parentId)) throw new CanvasValidationError('Clipboard hierarchy contains a cycle', 'INVALID_CLIPBOARD'); seen.add(parentId); result++; parentId = sourceMap.get(parentId)!.parentId; } return result; };
  const records = [...validated.records].sort((left, right) => depth(left) - depth(right) || compareFractionalIndex(left.index, right.index));
  records.forEach((record) => {
    const parentIncluded = incomingIds.has(record.parentId); const parentId = parentIncluded ? shapeIds.get(record.parentId)! : ROOT_PARENT_ID;
    const last = lastIndexes.get(parentId) ?? null; const index = generateKeyBetween(last, null); lastIndexes.set(parentId, index);
    const world = parentIncluded ? { x: record.x, y: record.y, rotation: record.rotation } : getWorldTransform(record.id, sourceMap);
    const props = { ...(record.props as Record<string, unknown>) };
    for (const key of ['assetId', 'imageAssetId', 'faviconAssetId']) { const value = props[key]; if (typeof value === 'string' && assetIds.has(value)) props[key] = assetIds.get(value); }
    commands.push({ type: 'shape.create', record: engine.registry.validate({ ...record, id: shapeIds.get(record.id)!, parentId, index, x: world.x + (parentIncluded ? 0 : offset.x), y: world.y + (parentIncluded ? 0 : offset.y), rotation: world.rotation, props }) });
  });
  validated.bindings.forEach((binding) => commands.push({ type: 'binding.set', binding: {
    ...binding, id: crypto.randomUUID(), connectorId: shapeIds.get(binding.connectorId)!,
    start: binding.start ? { ...binding.start, shapeId: shapeIds.get(binding.start.shapeId)! } : null,
    end: binding.end ? { ...binding.end, shapeId: shapeIds.get(binding.end.shapeId)! } : null,
  } }));
  engine.dispatch({ type: 'batch', commands }); const createdIds = records.map((record) => shapeIds.get(record.id)!);
  engine.setViewState({ selectedIds: records.filter((record) => !incomingIds.has(record.parentId)).map((record) => shapeIds.get(record.id)!) });
  return createdIds;
}
