import 'fake-indexeddb/auto';
import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it } from 'vitest';
import { IndexeddbPersistence, clearDocument } from 'y-indexeddb';
import * as Y from 'yjs';
import { createCanvasEngine } from './CanvasEngine';
import { createBuiltinShapeRegistry } from './builtinRegistry';
import { EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID, type ShapeRecord } from './model';

function setup(readonly = false) {
  return createCanvasEngine({
    documentId: crypto.randomUUID(),
    registry: createBuiltinShapeRegistry(),
    readonly,
    initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT),
  });
}

function record(engine: ReturnType<typeof setup>, id: string, patch: Partial<ShapeRecord> = {}): ShapeRecord {
  const definition = engine.registry.get('rectangle');
  return engine.registry.validate({
    id,
    type: 'rectangle',
    typeVersion: definition.version,
    parentId: ROOT_PARENT_ID,
    index: generateKeyBetween(null, null),
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    props: { width: 100, height: 80 },
    ...patch,
  });
}

describe('YjsCanvasEngine', () => {
  it('validates IndexedDB state before applying it to the live document', async () => {
    const databaseName = `tahta-test:${crypto.randomUUID()}`;
    const storedEngine = setup();
    const arrow = storedEngine.registry.validate({
      ...record(storedEngine, 'arrow'),
      type: 'arrow',
      props: { width: 100, height: 0, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    });
    storedEngine.dispatch({ type: 'shape.create', record: arrow });
    const invalidDocument = new Y.Doc();
    Y.applyUpdate(invalidDocument, storedEngine.encodeState());
    const storedProps = invalidDocument.getMap<Y.Map<unknown>>('records').get('arrow')?.get('props');
    expect(storedProps).toBeInstanceOf(Y.Map);
    storedProps!.set('points', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const persistence = new IndexeddbPersistence(databaseName, invalidDocument);
    await persistence.whenSynced;
    await persistence.destroy();

    const engine = setup();
    let emittedUpdates = 0;
    const unsubscribe = engine.onDocumentUpdate(() => { emittedUpdates += 1; });
    await expect(engine.enableIndexedDbPersistence(databaseName)).rejects.toThrow('points are not stored collaboratively');
    expect(engine.getSnapshot().records).toEqual([]);
    expect(emittedUpdates).toBe(0);

    unsubscribe();
    engine.destroy();
    storedEngine.destroy();
    invalidDocument.destroy();
    await clearDocument(databaseName);
  });

  it('loads valid IndexedDB state without adding it to local undo history', async () => {
    const databaseName = `tahta-test:${crypto.randomUUID()}`;
    const storedEngine = setup();
    storedEngine.dispatch({ type: 'shape.create', record: record(storedEngine, 'persisted') });
    const storedDocument = new Y.Doc();
    Y.applyUpdate(storedDocument, storedEngine.encodeState());
    const persistence = new IndexeddbPersistence(databaseName, storedDocument);
    await persistence.whenSynced;
    await persistence.destroy();

    const engine = setup();
    const dispose = await engine.enableIndexedDbPersistence(databaseName);
    expect(engine.getSnapshot().records.map(({ id }) => id)).toEqual(['persisted']);
    expect(engine.canUndo()).toBe(false);

    await dispose();
    engine.destroy();
    storedEngine.destroy();
    storedDocument.destroy();
    await clearDocument(databaseName);
  });

  it('cancels IndexedDB initialization before opening a provider', async () => {
    const databaseName = `tahta-test:${crypto.randomUUID()}`;
    const engine = setup();
    const controller = new AbortController();
    controller.abort();

    await expect(engine.enableIndexedDbPersistence(databaseName, { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(engine.getSnapshot().records).toEqual([]);

    engine.destroy();
    await clearDocument(databaseName);
  });

  it('forks definitions without sharing view runtime instances', () => {
    const source = createBuiltinShapeRegistry();
    const first = source.fork();
    const second = source.fork();
    const runtime = { view: 'first' };

    first.attachRuntime('rectangle', runtime);
    expect(first.getRuntime('rectangle')).toBe(runtime);
    expect(second.hasRuntime('rectangle')).toBe(false);
    expect(source.hasRuntime('rectangle')).toBe(false);
  });

  it('validates commands and rejects unknown shapes without a fallback', () => {
    const engine = setup();
    engine.dispatch({ type: 'shape.create', record: record(engine, 'a') });
    engine.dispatch({ type: 'shape.update', id: 'a', patch: { x: 24 } });
    expect(engine.getSnapshot().records).toMatchObject([{ id: 'a', x: 24 }]);
    expect(() => engine.dispatch({ type: 'shape.create', record: { ...record(engine, 'b'), type: 'missing' } }))
      .toThrow("Shape definition 'missing' is not registered");
    engine.destroy();
  });

  it('enforces read-only state at the dispatch boundary', () => {
    const engine = setup(true);
    expect(() => engine.dispatch({ type: 'shape.create', record: record(engine, 'a') })).toThrow('read-only');
    engine.destroy();
  });

  it('collapses a pointer undo group into one local undo operation', () => {
    const engine = setup();
    engine.dispatch({ type: 'shape.create', record: record(engine, 'a') });
    engine.dispatch({ type: 'shape.update', id: 'a', patch: { x: 10 } }, { undoGroup: 'pointer-1' });
    engine.dispatch({ type: 'shape.update', id: 'a', patch: { x: 20 } }, { undoGroup: 'pointer-1' });
    engine.completeUndoGroup('pointer-1');
    engine.undo();
    expect(engine.getSnapshot().records[0]?.x).toBe(0);
    engine.destroy();
  });

  it('does not add remote changes to the receiver local undo stack', () => {
    const source = setup();
    const receiver = setup();
    source.dispatch({ type: 'shape.create', record: record(source, 'remote') });
    receiver.applyRemoteUpdate(source.encodeDiff(receiver.encodeStateVector()));
    expect(receiver.getSnapshot().records.map(({ id }) => id)).toEqual(['remote']);
    expect(receiver.canUndo()).toBe(false);
    source.destroy();
    receiver.destroy();
  });

  it('merges concurrent field edits without last-write data loss', () => {
    const seed = setup();
    seed.dispatch({ type: 'shape.create', record: record(seed, 'a') });
    const state = seed.encodeState();
    const vector = seed.encodeStateVector();
    const left = createCanvasEngine({ documentId: 'left', registry: seed.registry, initialUpdate: state });
    const right = createCanvasEngine({ documentId: 'right', registry: seed.registry, initialUpdate: state });
    left.dispatch({ type: 'shape.update', id: 'a', patch: { x: 120 } });
    right.dispatch({ type: 'shape.update', id: 'a', patch: { y: 80 } });
    const leftUpdate = left.encodeDiff(vector);
    const rightUpdate = right.encodeDiff(vector);
    left.applyRemoteUpdate(rightUpdate);
    right.applyRemoteUpdate(leftUpdate);
    expect(left.getSnapshot().records[0]).toMatchObject({ x: 120, y: 80 });
    expect(right.getSnapshot()).toEqual(left.getSnapshot());
    seed.destroy();
    left.destroy();
    right.destroy();
  });

  it('merges concurrent delete and reorder without resurrecting records', () => {
    const seed = setup();
    const first = record(seed, 'a');
    const second = record(seed, 'b', { index: generateKeyBetween(first.index, null) });
    seed.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: first },
      { type: 'shape.create', record: second },
    ] });
    const state = seed.encodeState();
    const vector = seed.encodeStateVector();
    const left = createCanvasEngine({ documentId: 'left', registry: createBuiltinShapeRegistry(), initialUpdate: state });
    const right = createCanvasEngine({ documentId: 'right', registry: createBuiltinShapeRegistry(), initialUpdate: state });
    left.dispatch({ type: 'shape.delete', ids: ['a'], mode: 'only' });
    right.dispatch({ type: 'shape.reorder', id: 'b' });
    const leftUpdate = left.encodeDiff(vector);
    const rightUpdate = right.encodeDiff(vector);
    left.applyRemoteUpdate(rightUpdate);
    right.applyRemoteUpdate(leftUpdate);
    expect(left.getSnapshot().records.map(({ id }) => id)).toEqual(['b']);
    expect(right.getSnapshot()).toEqual(left.getSnapshot());
    seed.destroy(); left.destroy(); right.destroy();
  });

  it('merges connector bindings independently from shape field changes', () => {
    const seed = setup();
    const first = record(seed, 'a');
    const second = record(seed, 'b', { index: generateKeyBetween(first.index, null) });
    const arrow = seed.registry.validate({
      ...record(seed, 'connector', { index: generateKeyBetween(second.index, null) }),
      type: 'arrow',
      props: { width: 100, height: 0, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    });
    seed.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: first },
      { type: 'shape.create', record: second },
      { type: 'shape.create', record: arrow },
    ] });
    const state = seed.encodeState();
    const vector = seed.encodeStateVector();
    const left = createCanvasEngine({ documentId: 'left', registry: createBuiltinShapeRegistry(), initialUpdate: state });
    const right = createCanvasEngine({ documentId: 'right', registry: createBuiltinShapeRegistry(), initialUpdate: state });
    left.dispatch({ type: 'shape.update', id: 'a', patch: { x: 44 } });
    right.dispatch({ type: 'binding.set', binding: { id: 'connector:binding', connectorId: 'connector', start: { shapeId: 'a' }, end: { shapeId: 'b' } } });
    const leftUpdate = left.encodeDiff(vector);
    const rightUpdate = right.encodeDiff(vector);
    left.applyRemoteUpdate(rightUpdate);
    right.applyRemoteUpdate(leftUpdate);
    expect(left.getSnapshot()).toEqual(right.getSnapshot());
    expect(left.getSnapshot().records.find(({ id }) => id === 'a')?.x).toBe(44);
    expect(left.getSnapshot().bindings).toEqual([{ id: 'connector:binding', connectorId: 'connector', start: { shapeId: 'a' }, end: { shapeId: 'b' } }]);
    seed.destroy(); left.destroy(); right.destroy();
  });

  it('requires image asset metadata and stores asset plus reference atomically', () => {
    const engine = setup();
    const image = engine.registry.validate({
      ...record(engine, 'image'),
      type: 'image',
      props: { width: 20, height: 10, assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    });
    expect(() => engine.dispatch({ type: 'shape.create', record: image })).toThrow('missing asset');
    engine.dispatch({ type: 'batch', commands: [
      { type: 'asset.set', asset: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', mimeType: 'image/png', width: 20, height: 10, byteSize: 80 } },
      { type: 'shape.create', record: image },
    ] });
    expect(engine.getSnapshot()).toMatchObject({ assets: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }], records: [{ id: 'image' }] });
    expect(() => engine.dispatch({ type: 'asset.delete', ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] })).toThrow('still in use');
    engine.destroy();
  });

  it('rejects malformed and oversized remote updates atomically', () => {
    const engine = setup();
    expect(() => engine.applyRemoteUpdate(new Uint8Array())).toThrow('invalid size');
    expect(() => engine.applyRemoteUpdate(new Uint8Array([255, 255]))).toThrow();
    expect(() => engine.applyRemoteUpdate(new Uint8Array(2 * 1024 * 1024 + 1))).toThrow('invalid size');
    expect(engine.getSnapshot().records).toEqual([]);
    engine.destroy();
  });

  it('preflights a batch so a later invalid command cannot partially mutate the document', () => {
    const engine = setup();
    expect(() => engine.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: record(engine, 'valid') },
      { type: 'shape.create', record: { ...record(engine, 'invalid'), type: 'unknown' } },
    ] })).toThrow("Shape definition 'unknown' is not registered");
    expect(engine.getSnapshot().records).toEqual([]);
    expect(engine.canUndo()).toBe(false);
    engine.destroy();
  });

  it('binds awareness identity to the verified transport identity', () => {
    const sender = setup();
    const receiver = setup();
    let update: Uint8Array | null = null;
    const unsubscribe = sender.onAwarenessUpdate((next) => { update = next; });
    sender.setLocalAwarenessUser({ peerId: 'peer-a', name: 'Ada', color: '#3366ff' });
    receiver.applyRemoteAwarenessUpdate(update!, 'peer-a');
    expect([...receiver.awareness.getStates().values()]).toContainEqual(expect.objectContaining({ peerId: 'peer-a' }));
    expect(() => receiver.applyRemoteAwarenessUpdate(update!, 'peer-b')).toThrow('another participant');
    unsubscribe();
    sender.destroy();
    receiver.destroy();
  });
});
