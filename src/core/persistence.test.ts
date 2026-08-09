import 'fake-indexeddb/auto';
import { generateKeyBetween } from 'fractional-indexing';
import { afterEach, describe, expect, it } from 'vitest';
import { createCanvasEngine } from './CanvasEngine';
import { EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID } from './model';
import { createBuiltinShapeRegistry, richTextFromString } from '../shapes';

const databases = new Set<string>();

function removeDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`IndexedDB '${name}' remained open`));
  });
}

afterEach(async () => {
  await Promise.all([...databases].map(removeDatabase));
  databases.clear();
});

describe('IndexedDB persistence', () => {
  it('restores offline Yjs updates and can continue editing after reconnect', async () => {
    const databaseName = `tahta-test-${crypto.randomUUID()}`;
    databases.add(databaseName);
    const registry = createBuiltinShapeRegistry();
    const first = createCanvasEngine({ documentId: 'offline-board', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    const disposeFirst = await first.enableIndexedDbPersistence(databaseName);
    const definition = registry.get('rectangle');
    first.dispatch({
      type: 'shape.create',
      record: registry.validate({ id: 'offline-shape', type: 'rectangle', typeVersion: definition.version, parentId: ROOT_PARENT_ID, index: generateKeyBetween(null, null), x: 10, y: 20, rotation: 0, opacity: 1, locked: false, hidden: false, props: definition.defaults() }),
    });
    first.dispatch({ type: 'text.replace', shapeId: 'offline-shape', document: richTextFromString('Offline') });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await disposeFirst();
    first.destroy();

    const restored = createCanvasEngine({ documentId: 'offline-board', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    const disposeRestored = await restored.enableIndexedDbPersistence(databaseName);
    expect(restored.getSnapshot().records).toContainEqual(expect.objectContaining({ id: 'offline-shape', x: 10, y: 20 }));
    restored.dispatch({ type: 'shape.update', id: 'offline-shape', patch: { x: 42 } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await disposeRestored();
    restored.destroy();

    const reconnected = createCanvasEngine({ documentId: 'offline-board', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
    const disposeReconnected = await reconnected.enableIndexedDbPersistence(databaseName);
    expect(reconnected.getSnapshot().records.find(({ id }) => id === 'offline-shape')).toMatchObject({ x: 42 });
    await disposeReconnected();
    reconnected.destroy();
  });
});
