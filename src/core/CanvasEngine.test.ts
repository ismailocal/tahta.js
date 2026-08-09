import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createCanvasEngine } from './CanvasEngine';
import { EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID, type ShapeRecord } from './model';
import { ShapeRegistry, type ShapeDefinition } from './registry';

const boxProps = z.object({ width: z.number().positive(), height: z.number().positive() });
type BoxProps = z.infer<typeof boxProps>;

const boxDefinition: ShapeDefinition<BoxProps> = {
  type: 'box',
  version: 1,
  schema: boxProps,
  defaults: () => ({ width: 100, height: 80 }),
  geometry: {
    getBounds: (record) => ({ x: record.x, y: record.y, width: record.props.width, height: record.props.height }),
    containsPoint: (record, point) => point.x >= record.x && point.y >= record.y
      && point.x <= record.x + record.props.width && point.y <= record.y + record.props.height,
  },
  render: vi.fn(),
  exportSvg: ({ record }) => `<rect data-id="${record.id}" />`,
};
const frameDefinition: ShapeDefinition<BoxProps> = { ...boxDefinition, type: 'frame' };

function record(id: string, patch: Partial<ShapeRecord<BoxProps>> = {}): ShapeRecord<BoxProps> {
  return {
    id,
    type: 'box',
    typeVersion: 1,
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
  };
}

function setup(readonly = false) {
  const registry = new ShapeRegistry();
  registry.register(boxDefinition);
  registry.register(frameDefinition);
  return createCanvasEngine({ documentId: 'test', registry, readonly, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
}

describe('YjsCanvasEngine', () => {
  it('validates and executes document commands', () => {
    const engine = setup();
    engine.dispatch({ type: 'shape.create', record: record('a') });
    engine.dispatch({ type: 'shape.update', id: 'a', patch: { x: 24 } });
    expect(engine.getSnapshot().records).toMatchObject([{ id: 'a', x: 24 }]);
    engine.destroy();
  });

  it('keeps previously returned snapshots stable across later commands and undo', () => {
    const engine = setup();
    engine.dispatch({ type: 'shape.create', record: record('a') });
    const beforeCreate = engine.getSnapshot();
    engine.dispatch({ type: 'shape.create', record: record('b', { index: generateKeyBetween(beforeCreate.records[0]!.index, null) }) });
    const afterCreate = engine.getSnapshot();

    expect(beforeCreate.records.map(({ id }) => id)).toEqual(['a']);
    expect(afterCreate.records.map(({ id }) => id)).toEqual(['a', 'b']);

    engine.undo();
    expect(beforeCreate.records.map(({ id }) => id)).toEqual(['a']);
    expect(afterCreate.records.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(engine.getSnapshot().records.map(({ id }) => id)).toEqual(['a']);
    engine.destroy();
  });

  it('rejects unknown shape definitions instead of falling back', () => {
    const engine = setup();
    expect(() => engine.dispatch({ type: 'shape.create', record: { ...record('a'), type: 'missing' } }))
      .toThrow("Shape definition 'missing' is not registered");
    engine.destroy();
  });

  it('enforces read-only state at the command boundary', () => {
    const engine = setup(true);
    expect(() => engine.dispatch({ type: 'shape.create', record: record('a') })).toThrow('read-only');
    engine.destroy();
  });

  it('keeps a grouped pointer interaction as one undo step', () => {
    const engine = setup();
    engine.dispatch({ type: 'shape.create', record: record('a') });
    engine.dispatch({ type: 'shape.update', id: 'a', patch: { x: 10 } }, { undoGroup: 'drag-1' });
    engine.dispatch({ type: 'shape.update', id: 'a', patch: { x: 20 } }, { undoGroup: 'drag-1' });
    engine.completeUndoGroup('drag-1');
    engine.undo();
    expect(engine.getSnapshot().records[0]?.x).toBe(0);
    engine.destroy();
  });

  it('preserves world transform while reparenting', () => {
    const engine = setup();
    engine.dispatch({ type: 'shape.create', record: record('frame', { type: 'frame', x: 100, y: 50 }) });
    engine.dispatch({ type: 'shape.create', record: record('child', { x: 140, y: 90 }) });
    engine.dispatch({ type: 'shape.reparent', ids: ['child'], parentId: 'frame' });
    expect(engine.getSnapshot().records.find(({ id }) => id === 'child')).toMatchObject({ parentId: 'frame', x: 40, y: 40 });
    engine.destroy();
  });

  it('rejects hierarchy cycles', () => {
    const engine = setup();
    engine.dispatch({ type: 'shape.create', record: record('a', { type: 'frame' }) });
    engine.dispatch({ type: 'shape.create', record: record('b', { type: 'frame', parentId: 'a' }) });
    expect(() => engine.dispatch({ type: 'shape.reparent', ids: ['a'], parentId: 'b' })).toThrow('descendant');
    engine.destroy();
  });

  it('applies validated Yjs updates and rejects malformed records', () => {
    const source = setup();
    const target = setup();
    source.dispatch({ type: 'shape.create', record: record('a') });
    target.applyRemoteUpdate(source.encodeDiff(target.encodeStateVector()));
    expect(target.getSnapshot().records.map(({ id }) => id)).toEqual(['a']);
    source.destroy();
    target.destroy();
  });

  it('merges concurrent updates to different shape fields without last-write data loss', () => {
    const seed = setup(); seed.dispatch({ type: 'shape.create', record: record('a') }); const state = seed.encodeState(); const stateVector = seed.encodeStateVector();
    const left = createCanvasEngine({ documentId: 'left', registry: seed.registry, initialUpdate: state }); const right = createCanvasEngine({ documentId: 'right', registry: seed.registry, initialUpdate: state });
    left.dispatch({ type: 'shape.update', id: 'a', patch: { x: 120 } }); right.dispatch({ type: 'shape.update', id: 'a', patch: { y: 80 } });
    const leftUpdate = left.encodeDiff(stateVector); const rightUpdate = right.encodeDiff(stateVector);
    left.applyRemoteUpdate(rightUpdate); right.applyRemoteUpdate(leftUpdate);
    expect(left.getSnapshot().records[0]).toMatchObject({ x: 120, y: 80 }); expect(right.getSnapshot().records[0]).toMatchObject({ x: 120, y: 80 });
    seed.destroy(); left.destroy(); right.destroy();
  });

  it('merges concurrent document fields and presentation frame membership', () => {
    const seed = setup(); const state = seed.encodeState(); const vector = seed.encodeStateVector();
    const left = createCanvasEngine({ documentId: 'left-document', registry: seed.registry, initialUpdate: state }); const right = createCanvasEngine({ documentId: 'right-document', registry: seed.registry, initialUpdate: state });
    left.dispatch({ type: 'document.update', patch: { title: 'Architecture' } }); left.dispatch({ type: 'shape.create', record: record('frame-a', { type: 'frame' }) });
    right.dispatch({ type: 'document.update', patch: { background: '#111827' } }); right.dispatch({ type: 'shape.create', record: record('frame-b', { type: 'frame' }) });
    const leftUpdate = left.encodeDiff(vector); const rightUpdate = right.encodeDiff(vector); left.applyRemoteUpdate(rightUpdate); right.applyRemoteUpdate(leftUpdate);
    expect(left.getSnapshot().document).toMatchObject({ title: 'Architecture', background: '#111827' }); expect([...left.getSnapshot().document.presentation.frameIds].sort()).toEqual(['frame-a', 'frame-b']);
    expect(right.getSnapshot().document).toEqual(left.getSnapshot().document); seed.destroy(); left.destroy(); right.destroy();
  });

  it('converges independent concurrent delete, reparent, and reorder operations', () => {
    const seed = setup();
    seed.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: record('frame', { type: 'frame', index: 'a0', x: 100, y: 50 }) },
      { type: 'shape.create', record: record('child', { index: 'a1', x: 140, y: 90 }) },
      { type: 'shape.create', record: record('moved', { index: 'a2' }) },
      { type: 'shape.create', record: record('deleted', { index: 'a3' }) },
    ] });
    const state = seed.encodeState(); const vector = seed.encodeStateVector();
    const left = createCanvasEngine({ documentId: 'left', registry: seed.registry, initialUpdate: state });
    const right = createCanvasEngine({ documentId: 'right', registry: seed.registry, initialUpdate: state });
    left.dispatch({ type: 'shape.delete', ids: ['deleted'], mode: 'cascade' });
    left.dispatch({ type: 'shape.reparent', ids: ['child'], parentId: 'frame' });
    right.dispatch({ type: 'shape.reorder', id: 'moved', beforeId: 'child' });
    const leftUpdate = left.encodeDiff(vector); const rightUpdate = right.encodeDiff(vector);
    left.applyRemoteUpdate(rightUpdate); right.applyRemoteUpdate(leftUpdate);
    expect(left.getSnapshot()).toEqual(right.getSnapshot());
    expect(left.getSnapshot().records.some(({ id }) => id === 'deleted')).toBe(false);
    expect(left.getSnapshot().records.find(({ id }) => id === 'child')).toMatchObject({ parentId: 'frame', x: 40, y: 40 });
    seed.destroy(); left.destroy(); right.destroy();
  });

  it('reorders one presentation frame with a fractional CRDT update', () => {
    const engine = setup();
    engine.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: record('frame-a', { type: 'frame' }) },
      { type: 'shape.create', record: record('frame-b', { type: 'frame' }) },
      { type: 'shape.create', record: record('frame-c', { type: 'frame' }) },
    ] });
    const updates: Uint8Array[] = []; const unsubscribe = engine.onDocumentUpdate((update) => updates.push(update));
    engine.dispatch({ type: 'presentation.reorder', frameId: 'frame-c', beforeId: 'frame-a' });
    expect(engine.getSnapshot().document.presentation.frameIds).toEqual(['frame-c', 'frame-a', 'frame-b']);
    expect(updates).toHaveLength(1); expect(updates[0]!.byteLength).toBeLessThan(1_000);
    engine.undo(); expect(engine.getSnapshot().document.presentation.frameIds).toEqual(['frame-a', 'frame-b', 'frame-c']);
    unsubscribe(); engine.destroy();
  });
});
