import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createCanvasEngine } from './CanvasEngine';
import type { CanvasCommand } from './commands';
import { EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID, type AssetRecord, type ShapeRecord } from './model';
import { createBuiltinShapeRegistry, richTextFromString } from '../shapes';

function setup(readonly = false) { return createCanvasEngine({ documentId: crypto.randomUUID(), registry: createBuiltinShapeRegistry(), readonly, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) }); }
function shape(engine: ReturnType<typeof setup>, id: string, type = 'rectangle', patch: Partial<ShapeRecord> = {}): ShapeRecord {
  const definition = engine.registry.get(type); return engine.registry.validate({ id, type, typeVersion: definition.version, parentId: ROOT_PARENT_ID, index: generateKeyBetween(null, null), x: 0, y: 0, rotation: 0, opacity: 1, locked: false, hidden: false, props: definition.defaults(), ...patch });
}

describe('CanvasEngine command and validation boundaries', () => {
  it('rejects conflicting initialization modes and missing CRDT documents', () => {
    const registry = createBuiltinShapeRegistry(); const empty = new Y.Doc(); const update = Y.encodeStateAsUpdate(empty); empty.destroy();
    expect(() => createCanvasEngine({ documentId: 'x', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT), initialUpdate: update })).toThrow('either');
    expect(() => createCanvasEngine({ documentId: 'x', registry, document: new Y.Doc(), initialUpdate: update })).toThrow('cannot be combined');
    expect(() => createCanvasEngine({ documentId: 'x', registry, initialUpdate: update })).toThrow('missing');
    expect(() => createCanvasEngine({ documentId: ' ', registry })).toThrow('required');
  });

  it('rejects duplicate shapes, nested batches, oversized batches, and unknown selections', () => {
    const engine = setup(); engine.dispatch({ type: 'shape.create', record: shape(engine, 'a') });
    expect(() => engine.dispatch({ type: 'shape.create', record: shape(engine, 'a') })).toThrow('already exists');
    expect(() => engine.dispatch({ type: 'batch', commands: [{ type: 'batch', commands: [] }] })).toThrow('Nested');
    expect(() => engine.dispatch({ type: 'batch', commands: Array<CanvasCommand>(150_001).fill({ type: 'binding.delete', ids: [] }) })).toThrow('150,000');
    expect(() => engine.setViewState({ selectedIds: ['missing'] })).toThrow('does not exist'); engine.destroy();
  });

  it('enforces locked records for update, delete, reorder, reparent, rich text, and table cells', () => {
    const engine = setup(); const locked = shape(engine, 'locked', 'rectangle', { locked: true }); const table = shape(engine, 'table', 'table', { locked: true });
    engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: locked }, { type: 'shape.create', record: table }] });
    expect(() => engine.dispatch({ type: 'shape.update', id: 'locked', patch: { x: 1 } })).toThrow('locked');
    expect(() => engine.dispatch({ type: 'shape.delete', ids: ['locked'], mode: 'only' })).toThrow('locked');
    expect(() => engine.dispatch({ type: 'shape.reorder', id: 'locked' })).toThrow('locked');
    expect(() => engine.dispatch({ type: 'shape.reparent', ids: ['locked'], parentId: ROOT_PARENT_ID })).toThrow('locked');
    expect(() => engine.dispatch({ type: 'text.replace', shapeId: 'locked', document: richTextFromString('x') })).toThrow('locked');
    const props = table.props as { columns: { id: string }[]; rows: { id: string }[] }; expect(() => engine.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: props.rows[0]?.id ?? 'missing', columnId: props.columns[0]!.id, text: 'x' })).toThrow('locked');
    engine.dispatch({ type: 'shape.update', id: 'locked', patch: { hidden: true } }); engine.dispatch({ type: 'shape.update', id: 'locked', patch: { locked: false } }); engine.destroy();
  });

  it('supports explicit frame-only and cascading deletion while cleaning bindings', () => {
    const engine = setup(); const frame = shape(engine, 'frame', 'frame'); const child = shape(engine, 'child', 'rectangle', { parentId: 'frame', x: 20, y: 30 }); const target = shape(engine, 'target', 'rectangle', { x: 300 }); const arrow = shape(engine, 'arrow', 'arrow');
    engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: frame }, { type: 'shape.create', record: child }, { type: 'shape.create', record: target }, { type: 'shape.create', record: arrow }, { type: 'binding.set', binding: { id: 'binding', connectorId: 'arrow', start: { shapeId: 'child' }, end: { shapeId: 'target' } } }] });
    engine.dispatch({ type: 'shape.delete', ids: ['frame'], mode: 'only' }); expect(engine.getSnapshot().records.find(({ id }) => id === 'child')).toMatchObject({ parentId: ROOT_PARENT_ID, x: 20, y: 30 });
    engine.dispatch({ type: 'shape.delete', ids: ['child'], mode: 'cascade' }); expect(engine.getSnapshot().bindings).toHaveLength(0); engine.destroy();
  });

  it('validates parent types, beforeId scope, hierarchy cycles, and presentation order commands', () => {
    const engine = setup(); engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: shape(engine, 'box') }, { type: 'shape.create', record: shape(engine, 'frame', 'frame') }, { type: 'shape.create', record: shape(engine, 'other-frame', 'frame') }] });
    expect(() => engine.dispatch({ type: 'shape.create', record: shape(engine, 'child', 'rectangle', { parentId: 'box' }) })).toThrow('cannot contain');
    expect(() => engine.dispatch({ type: 'shape.reparent', ids: ['box'], parentId: 'missing' })).toThrow('does not exist');
    expect(() => engine.dispatch({ type: 'shape.reparent', ids: ['box'], parentId: 'frame', beforeId: 'other-frame' })).toThrow('destination');
    expect(() => engine.dispatch({ type: 'shape.reorder', id: 'box', beforeId: 'missing' })).toThrow('not a sibling');
    expect(() => engine.dispatch({ type: 'presentation.reorder', frameId: 'box' })).toThrow('not a frame');
    expect(() => engine.dispatch({ type: 'presentation.reorder', frameId: 'frame', beforeId: 'missing' })).toThrow('does not exist');
    expect(() => engine.dispatch({ type: 'document.update', patch: { presentation: { frameIds: ['frame'] } } } as unknown as CanvasCommand)).toThrow('presentation.reorder'); engine.destroy();
  });

  it('validates binding endpoints and connector types', () => {
    const engine = setup(); engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: shape(engine, 'a') }, { type: 'shape.create', record: shape(engine, 'arrow', 'arrow') }] });
    expect(() => engine.dispatch({ type: 'binding.set', binding: { id: 'bad', connectorId: 'a', start: null, end: null } })).toThrow('not a line or arrow');
    expect(() => engine.dispatch({ type: 'binding.set', binding: { id: 'bad', connectorId: 'arrow', start: { shapeId: 'missing' }, end: null } })).toThrow('does not exist');
    engine.dispatch({ type: 'binding.set', binding: { id: 'ok', connectorId: 'arrow', start: { shapeId: 'a' }, end: null } }); engine.dispatch({ type: 'binding.delete', ids: ['ok'] }); expect(engine.getSnapshot().bindings).toEqual([]); engine.destroy();
  });

  it('requires image assets and prevents deleting assets still in use', () => {
    const engine = setup(); const asset: AssetRecord = { id: crypto.randomUUID(), assetId: crypto.randomUUID(), mimeType: 'image/png', width: 10, height: 10, byteSize: 100 };
    const definition = engine.registry.get('image'); const image = engine.registry.validate({ id: 'image', type: 'image', typeVersion: definition.version, parentId: ROOT_PARENT_ID, index: 'a0', x: 0, y: 0, rotation: 0, opacity: 1, locked: false, hidden: false, props: { width: 10, height: 10, assetId: asset.assetId, alt: '' } });
    expect(() => engine.dispatch({ type: 'document.replace', snapshot: { ...structuredClone(EMPTY_CANVAS_SNAPSHOT), records: [image] } })).toThrow('missing asset');
    engine.dispatch({ type: 'batch', commands: [{ type: 'asset.set', asset }, { type: 'shape.create', record: image }] }); expect(() => engine.dispatch({ type: 'asset.delete', ids: [asset.id] })).toThrow('still in use');
    engine.dispatch({ type: 'shape.delete', ids: ['image'], mode: 'cascade' }); engine.dispatch({ type: 'asset.delete', ids: [asset.id] }); expect(engine.getSnapshot().assets).toEqual([]); engine.destroy();
  });

  it('validates table cell identity, text size, and rich-text capable shapes', () => {
    const engine = setup(); engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: shape(engine, 'box') }, { type: 'shape.create', record: shape(engine, 'table', 'table') }] });
    expect(() => engine.dispatch({ type: 'table.cell.set', shapeId: 'box', rowId: 'x', columnId: 'x', text: '' })).toThrow('not a table');
    expect(() => engine.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: 'x', columnId: 'x', text: '' })).toThrow('does not exist');
    expect(() => engine.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: 'x', columnId: 'x', text: 'x'.repeat(20_001) })).toThrow('20,000');
    const group = shape(engine, 'group', 'group'); engine.dispatch({ type: 'shape.create', record: group }); expect(() => engine.dispatch({ type: 'text.replace', shapeId: 'group', document: richTextFromString('x') })).toThrow('no rich text'); engine.destroy();
  });

  it('reports selector changes, supports redo, rejects invalid remote payloads, and closes lifecycle APIs', () => {
    const engine = setup(); const listener = vi.fn(); const unsubscribe = engine.subscribe((state) => state.selectedIds.length, listener);
    engine.dispatch({ type: 'shape.create', record: shape(engine, 'a') }); expect(listener).not.toHaveBeenCalled(); engine.setViewState({ selectedIds: ['a'] }); expect(listener).toHaveBeenCalledWith(1);
    engine.dispatch({ type: 'shape.update', id: 'a', patch: { x: 5 } }); expect(engine.canUndo()).toBe(true); engine.undo(); expect(engine.canRedo()).toBe(true); engine.redo(); expect(engine.getSnapshot().records[0]!.x).toBe(5);
    expect(() => engine.applyRemoteUpdate(new Uint8Array())).toThrow('invalid size'); expect(() => engine.applyRemoteUpdate(new Uint8Array(2 * 1024 * 1024 + 1))).toThrow('invalid size'); expect(() => engine.applyRemoteUpdate(new Uint8Array([255, 255]))).toThrow();
    unsubscribe(); engine.destroy(); engine.destroy(); expect(() => engine.getSnapshot()).toThrow('destroyed');
  });

  it('transports awareness separately and binds its client id to transport identity', () => {
    const sender = setup(); const receiver = setup(); let update: Uint8Array | null = null;
    const unsubscribe = sender.onAwarenessUpdate((value) => { update = value; });
    sender.setLocalAwarenessUser({ peerId: 'peer-a', name: 'Ada', color: '#3366ff' });
    expect(update).not.toBeNull(); receiver.applyRemoteAwarenessUpdate(update!, 'peer-a');
    expect([...receiver.awareness.getStates().values()]).toContainEqual(expect.objectContaining({ peerId: 'peer-a', user: { name: 'Ada', color: '#3366ff' } }));
    expect(() => receiver.applyRemoteAwarenessUpdate(update!, 'peer-b')).toThrow('another participant');
    expect(() => sender.setLocalAwarenessUser({ peerId: 'peer-a', name: '', color: 'blue' })).toThrow('invalid');
    receiver.removeRemoteAwareness('peer-a'); expect([...receiver.awareness.getStates().values()].some((state) => state.peerId === 'peer-a')).toBe(false);
    unsubscribe(); sender.destroy(); receiver.destroy();
  });
});
