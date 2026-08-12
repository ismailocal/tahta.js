import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { z } from 'zod';
import { createBuiltinShapeRegistry } from './builtinRegistry';
import { createCanvasEngine, mergeCanvasUpdates } from './CanvasEngine';
import type { CanvasCommand } from './commands';
import { EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID, type ShapeRecord } from './model';
import type { ShapeRegistry } from './registry';

function setup(registry: ShapeRegistry = createBuiltinShapeRegistry()) {
  return createCanvasEngine({
    documentId: crypto.randomUUID(),
    registry,
    initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT),
  });
}

function makeRecord(
  registry: ShapeRegistry,
  id: string,
  type = 'rectangle',
  props: Record<string, unknown> = { width: 100, height: 80 },
  patch: Partial<ShapeRecord> = {},
): ShapeRecord {
  return registry.validate({
    id,
    type,
    typeVersion: registry.get(type).version,
    parentId: ROOT_PARENT_ID,
    index: generateKeyBetween(null, null),
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    props,
    ...patch,
  });
}

function asset(id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') {
  return { id, assetId: id, mimeType: 'image/png' as const, width: 20, height: 10, byteSize: 80 };
}

function tableRegistry(): ShapeRegistry {
  const registry = createBuiltinShapeRegistry();
  const cellSchema = z.record(z.string(), z.string());
  const schema = z.object({
    width: z.number(),
    height: z.number(),
    columns: z.array(z.object({ id: z.string() })),
    rows: z.array(z.object({ id: z.string(), cells: cellSchema })),
  }).strict();
  registry.register({
    type: 'table',
    version: 1,
    schema,
    defaults: () => ({ width: 100, height: 80, columns: [], rows: [] }),
    geometry: {
      getBounds: (record) => ({ x: record.x, y: record.y, width: record.props.width, height: record.props.height }),
      containsPoint: () => false,
    },
    render: () => { throw new Error('Test table renderer must not be called'); },
    exportSvg: () => '<g/>',
  });
  return registry;
}

describe('CanvasEngine command surface', () => {
  it('preflights the complete command surface against sequential draft state', () => {
    const engine = setup();
    const frameA = makeRecord(engine.registry, 'frame-a', 'frame', { width: 300, height: 200, text: 'A' });
    const frameB = makeRecord(engine.registry, 'frame-b', 'frame', { width: 300, height: 200, text: 'B' }, { index: generateKeyBetween(frameA.index, null) });
    const rectangle = makeRecord(engine.registry, 'rect', 'rectangle', { width: 100, height: 80 }, { index: generateKeyBetween(frameB.index, null) });
    const freehand = makeRecord(engine.registry, 'stroke', 'freehand', { points: [{ x: 0, y: 0, pressure: 0.5 }] }, { index: generateKeyBetween(rectangle.index, null) });
    const text = makeRecord(engine.registry, 'text', 'text', { width: 100, height: 40, text: 'Old' }, { index: generateKeyBetween(freehand.index, null) });
    const arrow = makeRecord(engine.registry, 'arrow', 'arrow', { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] }, { index: generateKeyBetween(text.index, null) });
    const unusedAsset = asset();

    engine.dispatch({ type: 'batch', commands: [
      { type: 'asset.set', asset: unusedAsset },
      { type: 'asset.set', asset: { ...unusedAsset, width: 21 } },
      { type: 'shape.create', record: frameA },
      { type: 'shape.create', record: frameB },
      { type: 'shape.create', record: rectangle },
      { type: 'shape.create', record: freehand },
      { type: 'shape.create', record: text },
      { type: 'shape.create', record: arrow },
      { type: 'shape.update', id: 'rect', patch: { x: 25 } },
      { type: 'shape.update', id: 'rect', patch: { locked: true } },
      { type: 'shape.update', id: 'rect', patch: { hidden: true } },
      { type: 'shape.update', id: 'rect', patch: { locked: false, hidden: false } },
      { type: 'shape.reorder', id: 'rect', beforeId: 'frame-b' },
      { type: 'shape.reparent', ids: ['rect'], parentId: 'frame-a' },
      { type: 'shape.points.append', id: 'stroke', points: [{ x: 2, y: 3, pressure: 0.7 }] },
      { type: 'text.replace', shapeId: 'text', document: { type: 'doc', content: [{ type: 'paragraph', align: 'left', content: [{ text: 'New', marks: [] }] }] } },
      { type: 'document.update', patch: { title: 'Draft' } },
      { type: 'presentation.reorder', frameId: 'frame-b', beforeId: 'frame-a' },
      { type: 'presentation.reorder', frameId: 'frame-b', beforeId: 'frame-b' },
      { type: 'binding.set', binding: { id: 'binding', connectorId: 'arrow', start: { shapeId: 'rect', portId: 'right' }, end: { shapeId: 'frame-b' } } },
      { type: 'binding.delete', ids: ['binding'] },
      { type: 'shape.reparent', ids: ['rect'], parentId: 'root' },
      { type: 'shape.delete', ids: ['frame-a'], mode: 'only' },
      { type: 'asset.delete', ids: [unusedAsset.id] },
    ] });

    expect(engine.getSnapshot()).toMatchObject({
      document: { title: 'Draft', presentation: { frameIds: ['frame-b'] } },
      assets: [],
    });
    expect((engine.getSnapshot().records.find(({ id }) => id === 'stroke')?.props as { points: unknown[] }).points).toHaveLength(2);
    expect(engine.getSnapshot().records.find(({ id }) => id === 'text')?.props).toMatchObject({ text: 'New' });

    const replacement = structuredClone(EMPTY_CANVAS_SNAPSHOT);
    replacement.document.title = 'Replacement';
    engine.dispatch({ type: 'batch', commands: [{ type: 'document.replace', snapshot: replacement }] });
    expect(engine.getSnapshot()).toEqual(replacement);
    engine.destroy();

    const registry = tableRegistry();
    const tableEngine = setup(registry);
    const table = makeRecord(registry, 'table', 'table', {
      width: 100,
      height: 80,
      columns: [{ id: 'name' }],
      rows: [{ id: 'row', cells: { name: 'Ada' } }],
    });
    tableEngine.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: table },
      { type: 'table.cell.set', shapeId: 'table', rowId: 'row', columnId: 'name', text: 'Grace' },
    ] });
    expect(tableEngine.getSnapshot().records[0]?.props).toMatchObject({ rows: [{ cells: { name: 'Grace' } }] });
    tableEngine.destroy();
  });

  it('preflights delete containment, binding cleanup and inline image branches', () => {
    const engine = setup();
    const frame = makeRecord(engine.registry, 'frame', 'frame', { width: 100, height: 100, text: 'Frame' });
    const child = makeRecord(engine.registry, 'child', 'rectangle', { width: 10, height: 10 }, { parentId: frame.id, index: generateKeyBetween(frame.index, null) });
    const arrow = makeRecord(engine.registry, 'arrow', 'arrow', { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }, { index: generateKeyBetween(child.index, null) });
    const inlineImage = makeRecord(engine.registry, 'inline-image', 'image', {
      width: 1,
      height: 1,
      imageSrc: 'data:image/png;base64,AA==',
    }, { index: generateKeyBetween(arrow.index, null) });
    engine.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: frame },
      { type: 'shape.create', record: child },
      { type: 'shape.create', record: arrow },
      { type: 'shape.create', record: inlineImage },
      { type: 'binding.set', binding: { id: 'binding', connectorId: arrow.id, start: null, end: { shapeId: child.id } } },
      { type: 'shape.delete', ids: [frame.id], mode: 'only' },
    ] });
    expect(engine.getSnapshot().records.find(({ id }) => id === child.id)?.parentId).toBe('root');
    expect(engine.getSnapshot().bindings).toHaveLength(1);

    const cascadeFrame = makeRecord(engine.registry, 'cascade-frame', 'frame', { width: 100, height: 100, text: 'Cascade' });
    const cascadeChild = makeRecord(engine.registry, 'cascade-child', 'rectangle', { width: 10, height: 10 }, { parentId: cascadeFrame.id });
    engine.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: cascadeFrame },
      { type: 'shape.create', record: cascadeChild },
      { type: 'shape.delete', ids: [cascadeFrame.id], mode: 'cascade' },
    ] });
    expect(engine.getSnapshot().records.some(({ id }) => id === cascadeChild.id)).toBe(false);
    engine.destroy();
  });

  it('rejects invalid batch branches before the Yjs transaction starts', () => {
    const engine = setup();
    const rectangle = makeRecord(engine.registry, 'rect');
    const locked = makeRecord(engine.registry, 'locked', 'rectangle', { width: 10, height: 10 }, { locked: true, index: generateKeyBetween(rectangle.index, null) });
    const freehand = makeRecord(engine.registry, 'stroke', 'freehand', { points: [{ x: 0, y: 0 }] }, { index: generateKeyBetween(locked.index, null) });
    const lockedFreehand = { ...freehand, id: 'locked-stroke', locked: true, index: generateKeyBetween(freehand.index, null) };
    const text = makeRecord(engine.registry, 'text', 'text', { text: 'Text', width: 50, height: 20 }, { index: generateKeyBetween(lockedFreehand.index, null) });
    const frame = makeRecord(engine.registry, 'frame', 'frame', { text: 'Frame', width: 200, height: 100 }, { index: generateKeyBetween(text.index, null) });
    const arrow = makeRecord(engine.registry, 'arrow', 'arrow', { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }, { index: generateKeyBetween(frame.index, null) });
    engine.dispatch({ type: 'batch', commands: [rectangle, locked, freehand, lockedFreehand, text, frame, arrow]
      .map((record) => ({ type: 'shape.create' as const, record })) });

    const invalid = (command: Exclude<CanvasCommand, { type: 'batch' }>, message?: string) => {
      const action = () => engine.dispatch({ type: 'batch', commands: [command] });
      if (message) expect(action).toThrow(message);
      else expect(action).toThrow();
    };
    invalid({ type: 'shape.create', record: rectangle }, 'already exists');
    invalid({ type: 'shape.create', record: { ...makeRecord(engine.registry, 'missing-parent'), parentId: 'missing' } }, 'does not exist');
    invalid({ type: 'shape.create', record: { ...makeRecord(engine.registry, 'bad-parent'), parentId: 'rect' } }, 'cannot contain');
    invalid({ type: 'shape.update', id: 'missing', patch: { x: 1 } }, 'does not exist');
    invalid({ type: 'shape.update', id: 'locked', patch: { x: 1 } }, 'locked');
    invalid({ type: 'shape.update', id: 'rect', patch: { parentId: 'frame' } }, 'shape.reparent');
    invalid({ type: 'shape.points.append', id: 'rect', points: [{ x: 1, y: 1 }] }, 'does not support');
    invalid({ type: 'shape.points.append', id: 'locked-stroke', points: [{ x: 1, y: 1 }] }, 'locked');
    invalid({ type: 'shape.points.append', id: 'stroke', points: [{ x: Number.NaN, y: 1 }] });
    invalid({ type: 'shape.reorder', id: 'locked' }, 'locked');
    invalid({ type: 'shape.reorder', id: 'rect', beforeId: 'missing' }, 'not a sibling');
    invalid({ type: 'shape.delete', ids: ['locked'], mode: 'only' }, 'locked');
    invalid({ type: 'shape.reparent', ids: ['locked'], parentId: 'frame' }, 'locked');
    invalid({ type: 'shape.reparent', ids: ['frame'], parentId: 'frame' }, 'descendant');
    invalid({ type: 'shape.reparent', ids: ['rect'], parentId: 'frame', beforeId: 'text' }, 'destination parent');
    invalid({ type: 'text.replace', shapeId: 'rect', document: { type: 'doc', content: [] } }, 'no rich text field');
    invalid({ type: 'document.update', patch: { presentation: { frameIds: [] } } } as CanvasCommand, 'presentation.reorder');
    invalid({ type: 'presentation.reorder', frameId: 'rect' }, 'not a frame');
    invalid({ type: 'presentation.reorder', frameId: 'frame', beforeId: 'missing' }, 'does not exist');
    invalid({ type: 'binding.set', binding: { id: 'bad', connectorId: 'rect', start: null, end: null } }, 'not a line or arrow');
    invalid({ type: 'binding.set', binding: { id: 'self', connectorId: 'arrow', start: { shapeId: 'arrow' }, end: null } }, 'cannot bind');
    invalid({ type: 'binding.set', binding: { id: 'port', connectorId: 'arrow', start: { shapeId: 'rect', portId: 'missing' }, end: null } }, 'does not exist');
    invalid({ type: 'shape.create', record: makeRecord(engine.registry, 'invalid-image', 'image', { width: 10, height: 10 }) }, 'no valid image source');
    engine.destroy();

    const registry = tableRegistry();
    const tableEngine = setup(registry);
    const table = makeRecord(registry, 'table', 'table', {
      width: 100,
      height: 80,
      columns: [{ id: 'column' }],
      rows: [{ id: 'row', cells: { column: '' } }],
    });
    tableEngine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: table }] });
    const invalidTable = (command: Exclude<CanvasCommand, { type: 'batch' }>, message: string) => {
      expect(() => tableEngine.dispatch({ type: 'batch', commands: [command] })).toThrow(message);
    };
    invalidTable({ type: 'table.cell.set', shapeId: 'table', rowId: 'missing', columnId: 'column', text: '' }, 'does not exist');
    invalidTable({ type: 'table.cell.set', shapeId: 'table', rowId: 'row', columnId: 'column', text: 'x'.repeat(20_001) }, '20,000');
    tableEngine.dispatch({ type: 'shape.update', id: 'table', patch: { locked: true } });
    invalidTable({ type: 'table.cell.set', shapeId: 'table', rowId: 'row', columnId: 'column', text: '' }, 'locked');
    tableEngine.destroy();
  });

  it('owns view state, subscriptions, readonly, undo, redo and lifecycle', () => {
    const engine = setup();
    const selected = vi.fn();
    const unsubscribe = engine.subscribe((state) => state.selectedIds.join(','), selected);
    engine.dispatch({ type: 'shape.create', record: makeRecord(engine.registry, 'a') });
    engine.setViewState({ selectedIds: ['a'], viewport: { x: 12, y: 24, zoom: 2 } });
    expect(selected).toHaveBeenLastCalledWith('a');
    expect(engine.getViewState()).toMatchObject({ selectedIds: ['a'], viewport: { x: 12, y: 24, zoom: 2 } });
    expect(() => engine.setViewState({ selectedIds: ['missing'] })).toThrow('does not exist');

    engine.setReadonly(true);
    expect(() => engine.undo()).toThrow('read-only');
    expect(() => engine.redo()).toThrow('read-only');
    engine.setReadonly(false);
    engine.dispatch({ type: 'shape.update', id: 'a', patch: { x: 40 } });
    expect(engine.canUndo()).toBe(true);
    engine.undo();
    expect(engine.getSnapshot().records[0]?.x).toBe(0);
    expect(engine.canRedo()).toBe(true);
    engine.redo();
    expect(engine.getSnapshot().records[0]?.x).toBe(40);

    unsubscribe();
    engine.destroy();
    engine.destroy();
    expect(() => engine.getSnapshot()).toThrow('destroyed');
  });

  it('updates document settings and keeps frame presentation order canonical', () => {
    const engine = setup();
    const first = makeRecord(engine.registry, 'frame-a', 'frame', { width: 200, height: 120, text: 'A' });
    const second = makeRecord(engine.registry, 'frame-b', 'frame', { width: 200, height: 120, text: 'B' }, { index: generateKeyBetween(first.index, null) });
    const rectangle = makeRecord(engine.registry, 'rect');
    engine.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: first },
      { type: 'shape.create', record: second },
      { type: 'shape.create', record: rectangle },
    ] });
    expect(engine.getSnapshot().document.presentation.frameIds).toEqual(['frame-a', 'frame-b']);
    engine.dispatch({ type: 'presentation.reorder', frameId: 'frame-b', beforeId: 'frame-a' });
    expect(engine.getSnapshot().document.presentation.frameIds).toEqual(['frame-b', 'frame-a']);
    engine.dispatch({ type: 'presentation.reorder', frameId: 'frame-b', beforeId: 'frame-b' });
    expect(() => engine.dispatch({ type: 'presentation.reorder', frameId: 'rect' })).toThrow('not a frame');
    expect(() => engine.dispatch({ type: 'presentation.reorder', frameId: 'frame-a', beforeId: 'missing' })).toThrow('does not exist');

    engine.dispatch({ type: 'document.update', patch: { title: 'Board', background: '#ffffff', grid: { enabled: true, size: 32 } } });
    expect(engine.getSnapshot().document).toMatchObject({ title: 'Board', background: '#ffffff', grid: { enabled: true, size: 32 } });
    expect(() => engine.dispatch({ type: 'document.update', patch: { presentation: { frameIds: [] } } } as CanvasCommand)).toThrow('presentation.reorder');
    engine.dispatch({ type: 'shape.delete', ids: ['frame-b'], mode: 'only' });
    expect(engine.getSnapshot().document.presentation.frameIds).toEqual(['frame-a']);
    engine.destroy();
  });

  it('validates connector bindings and deletes them with their targets', () => {
    const engine = setup();
    const a = makeRecord(engine.registry, 'a');
    const b = makeRecord(engine.registry, 'b', 'ellipse', { width: 80, height: 60 }, { index: generateKeyBetween(a.index, null) });
    const arrow = makeRecord(engine.registry, 'arrow', 'arrow', { width: 100, height: 0, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }, { index: generateKeyBetween(b.index, null) });
    engine.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: a },
      { type: 'shape.create', record: b },
      { type: 'shape.create', record: arrow },
    ] });
    engine.dispatch({ type: 'binding.set', binding: { id: 'binding', connectorId: 'arrow', start: { shapeId: 'a', portId: 'right' }, end: { shapeId: 'b', portId: 'left' } } });
    expect(engine.getSnapshot().bindings).toHaveLength(1);
    expect(() => engine.dispatch({ type: 'binding.set', binding: { id: 'self', connectorId: 'arrow', start: { shapeId: 'arrow' }, end: null } })).toThrow('cannot bind');
    expect(() => engine.dispatch({ type: 'binding.set', binding: { id: 'port', connectorId: 'arrow', start: { shapeId: 'a', portId: 'missing' }, end: null } })).toThrow('does not exist');
    expect(() => engine.dispatch({ type: 'binding.set', binding: { id: 'not-connector', connectorId: 'a', start: null, end: { shapeId: 'b' } } })).toThrow('not a line or arrow');
    engine.dispatch({ type: 'binding.delete', ids: ['binding'] });
    expect(engine.getSnapshot().bindings).toEqual([]);
    engine.dispatch({ type: 'binding.set', binding: { id: 'binding', connectorId: 'arrow', start: { shapeId: 'a' }, end: { shapeId: 'b' } } });
    engine.dispatch({ type: 'shape.delete', ids: ['b'], mode: 'only' });
    expect(engine.getSnapshot().bindings).toEqual([]);
    engine.destroy();
  });

  it('stores, updates and deletes unused assets while protecting referenced images', () => {
    const engine = setup();
    const first = asset();
    const second = asset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    engine.dispatch({ type: 'asset.set', asset: first });
    engine.dispatch({ type: 'asset.set', asset: { ...first, width: 25 } });
    engine.dispatch({ type: 'asset.set', asset: second });
    expect(engine.getSnapshot().assets.find(({ id }) => id === first.id)?.width).toBe(25);
    const image = makeRecord(engine.registry, 'image', 'image', { width: 25, height: 10, assetId: first.id });
    engine.dispatch({ type: 'shape.create', record: image });
    expect(() => engine.dispatch({ type: 'asset.delete', ids: [first.id, second.id] })).toThrow('still in use');
    expect(engine.getSnapshot().assets).toHaveLength(2);
    engine.dispatch({ type: 'asset.delete', ids: [second.id] });
    expect(engine.getSnapshot().assets.map(({ id }) => id)).toEqual([first.id]);
    engine.destroy();
  });

  it('stores rich text in Y.XmlFragment while exposing the existing plain string projection', () => {
    const engine = setup();
    engine.dispatch({ type: 'shape.create', record: makeRecord(engine.registry, 'text', 'text', { width: 200, height: 40, text: 'Old' }) });
    engine.dispatch({
      type: 'text.replace',
      shapeId: 'text',
      document: { type: 'doc', content: [{ type: 'paragraph', align: 'center', content: [{ text: 'New', marks: [{ type: 'bold' }] }] }] },
    });
    expect(engine.getSnapshot().records[0]?.props).toMatchObject({ text: 'New' });
    expect(engine.getRichTextFragment('text').toString()).toContain('New');
    expect(() => engine.dispatch({ type: 'text.replace', shapeId: 'text', document: { type: 'bad' } })).toThrow();
    engine.dispatch({ type: 'shape.update', id: 'text', patch: { locked: true } });
    expect(() => engine.dispatch({ type: 'text.replace', shapeId: 'text', document: { type: 'doc', content: [] } })).toThrow('locked');
    expect(() => engine.getRichTextFragment('text', 'label')).toThrow('no collaborative label');
    engine.destroy();
  });

  it('appends freehand points as incremental collaborative updates', () => {
    const engine = setup();
    const initialPoints = Array.from({ length: 1_000 }, (_, index) => ({ x: index, y: index % 10, pressure: 0.5 }));
    engine.dispatch({
      type: 'shape.create',
      record: makeRecord(engine.registry, 'stroke', 'freehand', { points: initialPoints, strokeWidth: 2 }),
    });
    const updates: Uint8Array[] = [];
    const dispose = engine.onDocumentUpdate((update) => updates.push(update));

    engine.dispatch({ type: 'shape.points.append', id: 'stroke', points: [{ x: 1_001, y: 2, pressure: 0.6 }] });

    const props = engine.getSnapshot().records[0]?.props as { points: unknown[] };
    expect(props.points).toHaveLength(1_001);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.byteLength).toBeLessThan(500);
    expect(() => engine.dispatch({ type: 'shape.points.append', id: 'stroke', points: [{ x: Number.NaN, y: 0 }] })).toThrow();
    dispose();
    engine.destroy();
  });

  it('keeps table cell text as collaborative Y.Text for registered table plugins', () => {
    const registry = tableRegistry();
    const engine = setup(registry);
    engine.dispatch({ type: 'shape.create', record: makeRecord(registry, 'table', 'table', {
      width: 100,
      height: 80,
      columns: [{ id: 'name' }],
      rows: [{ id: 'row-1', cells: { name: 'Ada' } }],
    }) });
    engine.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: 'row-1', columnId: 'name', text: 'Grace' });
    expect(engine.getSnapshot().records[0]?.props).toMatchObject({ rows: [{ id: 'row-1', cells: { name: 'Grace' } }] });
    expect(() => engine.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: 'missing', columnId: 'name', text: 'x' })).toThrow('does not exist');
    expect(() => engine.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: 'row-1', columnId: 'name', text: 'x'.repeat(20_001) })).toThrow('20,000');
    engine.dispatch({ type: 'shape.update', id: 'table', patch: { locked: true } });
    expect(() => engine.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: 'row-1', columnId: 'name', text: 'x' })).toThrow('locked');
    engine.destroy();
  });

  it('rejects text and table commands for incompatible shape types', () => {
    const engine = setup();
    engine.dispatch({ type: 'shape.create', record: makeRecord(engine.registry, 'rectangle') });
    expect(() => engine.dispatch({ type: 'text.replace', shapeId: 'rectangle', document: { type: 'doc', content: [] } })).toThrow('no rich text field');
    expect(() => engine.dispatch({ type: 'table.cell.set', shapeId: 'rectangle', rowId: 'row', columnId: 'column', text: 'x' })).toThrow('not a table');
    engine.destroy();
  });

  it('reparents and reorders records while preserving their world transform', () => {
    const engine = setup();
    const frame = makeRecord(engine.registry, 'frame', 'frame', { width: 300, height: 200, text: 'Frame' }, { x: 100, y: 80 });
    const first = makeRecord(engine.registry, 'first', 'rectangle', { width: 100, height: 80 }, { x: 160, y: 120, index: generateKeyBetween(frame.index, null) });
    const second = makeRecord(engine.registry, 'second', 'rectangle', { width: 100, height: 80 }, { x: 240, y: 120, index: generateKeyBetween(first.index, null) });
    engine.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: frame }, { type: 'shape.create', record: first }, { type: 'shape.create', record: second },
    ] });
    engine.dispatch({ type: 'shape.reparent', ids: ['first'], parentId: 'frame' });
    expect(engine.getSnapshot().records.find(({ id }) => id === 'first')).toMatchObject({ parentId: 'frame', x: 60, y: 40 });
    engine.dispatch({ type: 'shape.reparent', ids: ['first'], parentId: 'root', beforeId: 'second' });
    expect(engine.getSnapshot().records.find(({ id }) => id === 'first')).toMatchObject({ parentId: 'root', x: 160, y: 120 });
    expect(engine.getSnapshot().records.map(({ id }) => id).indexOf('first')).toBeLessThan(engine.getSnapshot().records.map(({ id }) => id).indexOf('second'));
    expect(() => engine.dispatch({ type: 'shape.reparent', ids: ['frame'], parentId: 'frame' })).toThrow('descendant');
    expect(() => engine.dispatch({ type: 'shape.reparent', ids: ['first'], parentId: 'second' })).toThrow('cannot contain');
    expect(() => engine.dispatch({ type: 'shape.reparent', ids: ['first'], parentId: 'frame', beforeId: 'second' })).toThrow('destination parent');
    engine.dispatch({ type: 'shape.update', id: 'first', patch: { locked: true } });
    expect(() => engine.dispatch({ type: 'shape.reorder', id: 'first' })).toThrow('locked');
    expect(() => engine.dispatch({ type: 'shape.reparent', ids: ['first'], parentId: 'frame' })).toThrow('locked');
    engine.destroy();
  });

  it('supports delete-only reparenting and cascading descendant cleanup', () => {
    const engine = setup();
    const frame = makeRecord(engine.registry, 'frame', 'frame', { width: 300, height: 200, text: 'Frame' }, { x: 100, y: 80 });
    const child = makeRecord(engine.registry, 'child', 'text', { width: 100, height: 40, text: 'Child' }, { parentId: 'frame', x: 10, y: 20, index: generateKeyBetween(frame.index, null) });
    engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: frame }, { type: 'shape.create', record: child }] });
    engine.dispatch({ type: 'shape.delete', ids: ['frame'], mode: 'only' });
    expect(engine.getSnapshot().records).toMatchObject([{ id: 'child', parentId: 'root', x: 110, y: 100 }]);
    expect(() => engine.getRichTextFragment('frame')).toThrow('does not exist');

    const nextFrame = makeRecord(engine.registry, 'next-frame', 'frame', { width: 300, height: 200, text: 'Next' });
    engine.dispatch({ type: 'shape.create', record: nextFrame });
    engine.dispatch({ type: 'shape.reparent', ids: ['child'], parentId: 'next-frame' });
    engine.dispatch({ type: 'shape.delete', ids: ['next-frame'], mode: 'cascade' });
    expect(engine.getSnapshot().records).toEqual([]);
    engine.destroy();
  });

  it('rejects invalid construction, nested batches and locked mutations explicitly', () => {
    const registry = createBuiltinShapeRegistry();
    expect(() => createCanvasEngine({ documentId: ' ', registry })).toThrow('documentId');
    expect(() => createCanvasEngine({ documentId: 'x', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT), initialUpdate: new Uint8Array([0]) })).toThrow('either');
    expect(() => createCanvasEngine({ documentId: 'x', registry, initialUpdate: new Uint8Array([255]) })).toThrow('could not be decoded');
    const document = new Y.Doc();
    document.getMap('records').set('x', new Y.Map());
    expect(() => createCanvasEngine({ documentId: 'x', registry, document })).toThrow('missing');
    document.destroy();

    const engine = setup(registry);
    const locked = makeRecord(registry, 'locked', 'rectangle', { width: 10, height: 10 }, { locked: true });
    engine.dispatch({ type: 'shape.create', record: locked });
    expect(() => engine.dispatch({ type: 'shape.update', id: 'locked', patch: { x: 1 } })).toThrow('locked');
    engine.dispatch({ type: 'shape.update', id: 'locked', patch: { locked: false } });
    expect(() => engine.dispatch({ type: 'shape.update', id: 'locked', patch: { parentId: 'missing' } })).toThrow('shape.reparent');
    expect(() => engine.dispatch({ type: 'batch', commands: [{ type: 'batch', commands: [] }] })).toThrow('Nested');
    expect(() => engine.dispatch({ type: 'shape.create', record: makeRecord(registry, 'locked') })).toThrow('already exists');
    expect(() => engine.dispatch({ type: 'shape.reorder', id: 'locked', beforeId: 'missing' })).toThrow('not a sibling');
    engine.destroy();
  });

  it('merges update queues and emits only local document changes', () => {
    const source = setup();
    const baseState = source.encodeState();
    const updates: Uint8Array[] = [];
    const dispose = source.onDocumentUpdate((update) => updates.push(update));
    source.dispatch({ type: 'shape.create', record: makeRecord(source.registry, 'a') });
    source.dispatch({ type: 'shape.update', id: 'a', patch: { x: 12 } });
    const merged = mergeCanvasUpdates(updates);
    const receiver = createCanvasEngine({ documentId: 'receiver', registry: createBuiltinShapeRegistry(), initialUpdate: baseState });
    const receiverListener = vi.fn();
    receiver.onDocumentUpdate(receiverListener);
    receiver.applyRemoteUpdate(merged);
    expect(receiver.getSnapshot().records[0]?.x).toBe(12);
    expect(receiverListener).not.toHaveBeenCalled();
    expect(() => mergeCanvasUpdates([])).toThrow('At least one');
    dispose();
    source.destroy();
    receiver.destroy();
  });
});
