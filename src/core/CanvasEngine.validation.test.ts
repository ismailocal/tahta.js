import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createBuiltinShapeRegistry } from './builtinRegistry';
import { createCanvasEngine } from './CanvasEngine';
import { EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID, type CanvasSnapshotV2, type ShapeRecord } from './model';

const registry = () => createBuiltinShapeRegistry();

function record(id: string, type = 'rectangle', props: Record<string, unknown> = { width: 100, height: 80 }, patch: Partial<ShapeRecord> = {}): ShapeRecord {
  const shapes = registry();
  return shapes.validate({
    id, type, typeVersion: shapes.get(type).version, parentId: ROOT_PARENT_ID,
    index: generateKeyBetween(null, null), x: 0, y: 0, rotation: 0, opacity: 1,
    locked: false, hidden: false, props, ...patch,
  });
}

function snapshot(records: ShapeRecord[] = []): CanvasSnapshotV2 {
  return { ...structuredClone(EMPTY_CANVAS_SNAPSHOT), records };
}

describe('CanvasEngine snapshot and awareness validation', () => {
  it('supports a supplied Y.Doc but rejects ambiguous initialization', () => {
    const source = createCanvasEngine({ documentId: 'source', registry: registry(), initialSnapshot: snapshot() });
    const document = new Y.Doc();
    Y.applyUpdate(document, source.encodeState());
    const hydrated = createCanvasEngine({ documentId: 'hydrated', registry: registry(), document });
    expect(hydrated.getSnapshot()).toEqual(source.getSnapshot());
    hydrated.destroy();

    const nonEmpty = new Y.Doc();
    Y.applyUpdate(nonEmpty, source.encodeState());
    expect(() => createCanvasEngine({ documentId: 'invalid', registry: registry(), document: nonEmpty, initialSnapshot: snapshot() }))
      .toThrow('non-empty Y.Doc');
    source.destroy();
  });

  it('validates duplicate ids, parents, presentation and bindings before accepting a snapshot', () => {
    const rectangle = record('rectangle');
    const frame = record('frame', 'frame', { width: 200, height: 120, text: 'Frame' });
    const arrow = record('arrow', 'arrow', { width: 100, height: 0, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
    const create = (value: CanvasSnapshotV2) => createCanvasEngine({ documentId: crypto.randomUUID(), registry: registry(), initialSnapshot: value });

    expect(() => create(snapshot([rectangle, rectangle]))).toThrow("Duplicate shape id 'rectangle'");
    expect(() => create(snapshot([{ ...rectangle, parentId: 'missing' }]))).toThrow("Parent 'missing' does not exist");
    expect(() => create({ ...snapshot([rectangle]), document: { ...snapshot().document, presentation: { frameIds: ['rectangle'] } } })).toThrow('does not exist');
    expect(() => create({ ...snapshot([frame]), document: { ...snapshot().document, presentation: { frameIds: ['frame', 'frame'] } } })).toThrow('duplicated');
    expect(() => create({ ...snapshot([arrow]), bindings: [{ id: 'bind', connectorId: 'arrow', start: { shapeId: 'missing' }, end: null }] })).toThrow('references a missing shape');
    expect(() => create({ ...snapshot([arrow]), bindings: [
      { id: 'bind', connectorId: 'arrow', start: null, end: null },
      { id: 'bind', connectorId: 'arrow', start: null, end: null },
    ] })).toThrow("Duplicate binding id 'bind'");
  });

  it('requires valid image metadata or a supported inline source', () => {
    const missing = record('image', 'image', { width: 20, height: 10, assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect(() => createCanvasEngine({ documentId: 'missing', registry: registry(), initialSnapshot: snapshot([missing]) })).toThrow('missing asset');
    const inline = record('inline', 'image', { width: 20, height: 10, imageSrc: 'data:image/png;base64,AA==' });
    const engine = createCanvasEngine({ documentId: 'inline', registry: registry(), initialSnapshot: snapshot([inline]) });
    expect(engine.getSnapshot().records).toHaveLength(1);
    engine.destroy();
    const unsafe = record('unsafe', 'image', { width: 20, height: 10, imageSrc: 'https://example.com/a.png' });
    expect(() => createCanvasEngine({ documentId: 'unsafe', registry: registry(), initialSnapshot: snapshot([unsafe]) })).toThrow('no valid image source');
  });

  it('replaces a document atomically and keeps the operation undoable', () => {
    const engine = createCanvasEngine({ documentId: 'replace', registry: registry(), initialSnapshot: snapshot([record('old')]) });
    const replacement = snapshot([record('new')]);
    const result = engine.dispatch({ type: 'document.replace', snapshot: replacement });
    expect(result.changedRecordIds).toEqual(['new']);
    expect(engine.getSnapshot().records.map(({ id }) => id)).toEqual(['new']);
    engine.undo();
    expect(engine.getSnapshot().records.map(({ id }) => id)).toEqual(['old']);
    engine.destroy();
  });

  it('publishes complete collaborator state and removes it by verified transport identity', () => {
    const sender = createCanvasEngine({ documentId: 'sender', registry: registry(), initialSnapshot: snapshot() });
    const receiver = createCanvasEngine({ documentId: 'receiver', registry: registry(), initialSnapshot: snapshot() });
    let update = new Uint8Array();
    sender.onAwarenessUpdate((value) => { update = value; });
    sender.setLocalAwarenessUser({ peerId: 'peer-a', name: 'Ada', color: '#3366ff' });
    sender.awareness.setLocalStateField('user', { name: 'Ada', color: '#3366ff', avatarUrl: 'https://tahta.io/a.png' });
    sender.awareness.setLocalStateField('cursor', { x: 10, y: 20 });
    sender.awareness.setLocalStateField('button', 'primary');
    sender.awareness.setLocalStateField('viewportZoom', 1.5);
    sender.awareness.setLocalStateField('presentationFrameId', 'frame');
    sender.awareness.setLocalStateField('pointerTool', 'laser');
    sender.awareness.setLocalStateField('laserTrail', [{ x: 10, y: 20, timestamp: Date.now(), strokeId: 0 }]);
    receiver.applyRemoteAwarenessUpdate(update, 'peer-a');
    expect(receiver.getViewState().collaborators.get('peer-a')).toEqual({
      id: 'peer-a', name: 'Ada', color: '#3366ff', avatarUrl: 'https://tahta.io/a.png',
      cursor: { x: 10, y: 20 }, button: 'primary', zoom: 1.5, presentationFrameId: 'frame',
      pointerTool: 'laser', laserTrail: [{ x: 10, y: 20, timestamp: expect.any(Number), strokeId: 0 }],
    });
    receiver.removeRemoteAwareness('peer-a');
    expect(receiver.getViewState().collaborators.size).toBe(0);
    receiver.removeRemoteAwareness('unknown');
    sender.destroy(); receiver.destroy();
  });

  it('rejects malformed profiles, updates and spoofed awareness payloads', () => {
    const engine = createCanvasEngine({ documentId: 'receiver', registry: registry(), initialSnapshot: snapshot() });
    expect(() => engine.setLocalAwarenessUser({ peerId: '', name: 'Ada', color: '#3366ff' })).toThrow('invalid');
    expect(() => engine.setLocalAwarenessUser({ peerId: 'peer', name: '', color: '#3366ff' })).toThrow('invalid');
    expect(() => engine.setLocalAwarenessUser({ peerId: 'peer', name: 'Ada', color: 'blue' })).toThrow('invalid');
    expect(() => engine.applyRemoteAwarenessUpdate(new Uint8Array(), 'peer')).toThrow('invalid');
    expect(() => engine.applyRemoteAwarenessUpdate(new Uint8Array([255]), 'peer')).toThrow('could not be decoded');

    const spoof = createCanvasEngine({ documentId: 'spoof', registry: registry(), initialSnapshot: snapshot() });
    spoof.setLocalAwarenessUser({ peerId: 'claimed-peer', name: 'Ada', color: '#3366ff' });
    expect(() => engine.applyRemoteAwarenessUpdate(spoof.encodeLocalAwareness(), 'transport-peer')).toThrow('does not match');
    const invalidLaser = createCanvasEngine({ documentId: 'invalid-laser', registry: registry(), initialSnapshot: snapshot() });
    invalidLaser.setLocalAwarenessUser({ peerId: 'peer', name: 'Ada', color: '#3366ff' });
    invalidLaser.awareness.setLocalStateField('pointerTool', 'laser');
    invalidLaser.awareness.setLocalStateField('laserTrail', [{ x: Number.NaN, y: 0, timestamp: Date.now(), strokeId: 0 }]);
    expect(() => engine.applyRemoteAwarenessUpdate(invalidLaser.encodeLocalAwareness(), 'peer')).toThrow('laser trail is invalid');
    invalidLaser.destroy(); spoof.destroy(); engine.destroy();
  });

  it('does not notify unchanged selectors or leak awareness events after unsubscribe', () => {
    const engine = createCanvasEngine({ documentId: 'events', registry: registry(), initialSnapshot: snapshot() });
    const selection = vi.fn();
    const disposeSelection = engine.subscribe((state) => state.selectedIds.length, selection);
    engine.setViewState({ activeTool: 'hand' });
    expect(selection).not.toHaveBeenCalled();
    disposeSelection();
    const awareness = vi.fn();
    const disposeAwareness = engine.onAwarenessUpdate(awareness);
    disposeAwareness();
    engine.setLocalAwarenessUser({ peerId: 'peer', name: 'Ada', color: '#3366ff' });
    expect(awareness).not.toHaveBeenCalled();
    engine.destroy();
  });

  it('publishes user and pointer awareness as one atomic update each', () => {
    const engine = createCanvasEngine({ documentId: 'awareness-atomic', registry: registry(), initialSnapshot: snapshot() });
    const awareness = vi.fn();
    const disposeAwareness = engine.onAwarenessUpdate(awareness);

    engine.setLocalAwarenessUser({ peerId: 'peer', name: 'Ada', color: '#3366ff' });
    expect(awareness).toHaveBeenCalledTimes(1);

    engine.setLocalAwarenessPointer({
      cursor: { x: 10, y: 20 },
      button: 'down',
      viewportZoom: 1,
      pointerTool: 'pointer',
    });
    expect(awareness).toHaveBeenCalledTimes(2);
    expect(engine.awareness.getLocalState()).toMatchObject({
      cursor: { x: 10, y: 20 },
      button: 'down',
      viewportZoom: 1,
      pointerTool: 'pointer',
      laserTrail: null,
    });
    expect(() => engine.setLocalAwarenessPointer({
      cursor: { x: 10, y: 20 },
      button: 'down',
      viewportZoom: Number.POSITIVE_INFINITY,
      pointerTool: 'pointer',
    })).toThrow('invalid');
    expect(awareness).toHaveBeenCalledTimes(2);

    disposeAwareness();
    engine.destroy();
  });
});
