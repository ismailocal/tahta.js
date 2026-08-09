import { createHash } from 'node:crypto';
import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it, vi } from 'vitest';
import { createCanvasEngine } from './CanvasEngine';
import { CommandRegistry } from './CommandRegistry';
import { groupSelection, ungroupSelection } from './grouping';
import { EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID, type ShapeRecord } from './model';
import { quickCreate } from './quickCreate';
import { applyCsvToTable, parseCsv, serializeCsv, tableToCsv } from './tableCsv';
import { previewStickyClusters } from './clustering';
import { exportCanvas, importCanvasJson } from './export';
import { createClipboardPayload, parseClipboardPayload, pasteClipboardPayload, serializeClipboardPayload } from './clipboard';
import { resolveBindingGeometry } from './bindings';
import { deleteTableColumn, deleteTableRow, insertTableColumn, insertTableRow, moveTableColumn, moveTableRow, resizeTableColumn } from './tableCsv';
import { createBuiltinShapeRegistry, richTextFromString } from '../shapes';
import { applyImportPlan } from '../dsl/importPlan';

function createRecord(engine: ReturnType<typeof createCanvasEngine>, id: string, type = 'rectangle', x = 0, y = 0): ShapeRecord {
  const definition = engine.registry.get(type);
  return engine.registry.validate({ id, type, typeVersion: definition.version, parentId: ROOT_PARENT_ID, index: generateKeyBetween(null, null), x, y, rotation: 0, opacity: 1, locked: false, hidden: false, props: definition.defaults() });
}
function setup() { return createCanvasEngine({ documentId: crypto.randomUUID(), registry: createBuiltinShapeRegistry(), initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) }); }
async function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(blob); });
}

describe('V2 canvas features', () => {
  it('creates a node, connector, and binding as one undo transaction', () => {
    const engine = setup(); engine.dispatch({ type: 'shape.create', record: createRecord(engine, 'source') });
    const result = quickCreate(engine, { sourceId: 'source', direction: 'right' });
    expect(engine.getSnapshot().records.map(({ id }) => id)).toEqual(expect.arrayContaining(['source', result.shapeId, result.connectorId]));
    expect(engine.getSnapshot().bindings).toHaveLength(1); engine.undo();
    expect(engine.getSnapshot().records.map(({ id }) => id)).toEqual(['source']); engine.destroy();
  });

  it('merges concurrent connector endpoint edits independently', () => {
    const seed = setup(); seed.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: createRecord(seed, 'a') }, { type: 'shape.create', record: createRecord(seed, 'b', 'ellipse', 240) }, { type: 'shape.create', record: createRecord(seed, 'connector', 'arrow') }, { type: 'binding.set', binding: { id: 'binding', connectorId: 'connector', start: null, end: null } }] });
    const state = seed.encodeState(); const vector = seed.encodeStateVector(); const left = createCanvasEngine({ documentId: 'binding-left', registry: seed.registry, initialUpdate: state }); const right = createCanvasEngine({ documentId: 'binding-right', registry: seed.registry, initialUpdate: state });
    left.dispatch({ type: 'binding.set', binding: { id: 'binding', connectorId: 'connector', start: { shapeId: 'a' }, end: null } }); right.dispatch({ type: 'binding.set', binding: { id: 'binding', connectorId: 'connector', start: null, end: { shapeId: 'b' } } });
    left.applyRemoteUpdate(right.encodeDiff(vector)); right.applyRemoteUpdate(left.encodeDiff(vector));
    expect(left.getSnapshot().bindings[0]).toMatchObject({ start: { shapeId: 'a' }, end: { shapeId: 'b' } }); expect(right.getSnapshot().bindings).toEqual(left.getSnapshot().bindings); seed.destroy(); left.destroy(); right.destroy();
  });

  it('derives connector endpoints from bound shape geometry', () => {
    const engine = setup(); const start = createRecord(engine, 'start', 'rectangle', 20, 40); const end = createRecord(engine, 'end', 'ellipse', 420, 240); const connector = createRecord(engine, 'connector', 'arrow');
    const resolved = resolveBindingGeometry([start, end, connector], [{ id: 'binding', connectorId: 'connector', start: { shapeId: 'start' }, end: { shapeId: 'end' } }], engine.registry); const arrow = resolved.find(({ id }) => id === 'connector')!; const points = (arrow.props as { points: { x: number; y: number }[] }).points;
    expect(arrow).toMatchObject({ x: 110, y: 90 }); expect(points[0]).toMatchObject({ x: 0, y: 0 }); expect(points.at(-1)).toMatchObject({ x: 400, y: 200 }); engine.destroy();
  });

  it('groups and ungroups while preserving child records', () => {
    const engine = setup(); engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: createRecord(engine, 'a') }, { type: 'shape.create', record: createRecord(engine, 'b', 'ellipse', 240) }] });
    engine.setViewState({ selectedIds: ['a', 'b'] }); const groupId = groupSelection(engine);
    expect(engine.getSnapshot().records.filter(({ parentId }) => parentId === groupId)).toHaveLength(2);
    ungroupSelection(engine); expect(engine.getSnapshot().records.map(({ id }) => id).sort()).toEqual(['a', 'b']); engine.destroy();
  });

  it('round-trips RFC 4180 CSV and applies it through a table command', () => {
    const source = 'Name,Note\r\nAlice,"Hello, ""Tahta"""\r\nBob,"Line 1\nLine 2"'; const rows = parseCsv(source);
    expect(parseCsv(serializeCsv(rows))).toEqual(rows);
    const engine = setup(); engine.dispatch({ type: 'shape.create', record: createRecord(engine, 'table', 'table') }); applyCsvToTable(engine, 'table', rows);
    expect(parseCsv(tableToCsv(engine, 'table'))).toEqual(rows); engine.destroy();
  });

  it('edits table rows and columns through validated commands', () => {
    const engine = setup(); engine.dispatch({ type: 'shape.create', record: createRecord(engine, 'table', 'table') });
    const columnA = (engine.getSnapshot().records.find(({ id }) => id === 'table')!.props as { columns: { id: string }[] }).columns[0]!.id;
    const columnB = insertTableColumn(engine, 'table');
    const rowA = insertTableRow(engine, 'table'); const rowB = insertTableRow(engine, 'table');
    engine.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: rowA, columnId: columnA, text: 'value' });
    resizeTableColumn(engine, 'table', columnA, 240); moveTableColumn(engine, 'table', columnB, columnA); moveTableRow(engine, 'table', rowB, rowA);
    deleteTableColumn(engine, 'table', columnB); deleteTableRow(engine, 'table', rowB);
    expect(tableToCsv(engine, 'table')).toBe('Column 1\r\nvalue'); engine.destroy();
  });

  it('copies a hierarchy and remaps ids without mutating the source records', () => {
    const engine = setup(); const frame = createRecord(engine, 'frame', 'frame', 100, 80); const child = createRecord(engine, 'child'); child.parentId = frame.id; child.x = 20; child.y = 30;
    engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: frame }, { type: 'shape.create', record: child }] });
    engine.setViewState({ selectedIds: ['frame'] });
    const payload = parseClipboardPayload(serializeClipboardPayload(createClipboardPayload(engine)));
    const created = pasteClipboardPayload(engine, payload);
    expect(created).toHaveLength(2); expect(new Set(engine.getSnapshot().records.map(({ id }) => id)).size).toBe(4);
    const copiedFrame = engine.getSnapshot().records.find(({ id }) => id === created[0])!; const copiedChild = engine.getSnapshot().records.find(({ id }) => id === created[1])!;
    expect(copiedFrame).toMatchObject({ x: 132, y: 112 }); expect(copiedChild).toMatchObject({ parentId: copiedFrame.id, x: 20, y: 30 }); engine.destroy();
  });

  it('enforces read-only mode for clipboard, CSV, JSON, and AI/import-plan mutation helpers', () => {
    const source = setup(); source.dispatch({ type: 'shape.create', record: createRecord(source, 'source') }); source.setViewState({ selectedIds: ['source'] });
    const clipboard = createClipboardPayload(source); const snapshotJson = JSON.stringify(source.getSnapshot());
    const target = setup(); target.dispatch({ type: 'shape.create', record: createRecord(target, 'table', 'table') }); target.setReadonly(true);
    expect(() => pasteClipboardPayload(target, clipboard)).toThrow('read-only');
    expect(() => applyCsvToTable(target, 'table', [['Header'], ['Value']])).toThrow('read-only');
    expect(() => importCanvasJson(target, snapshotJson)).toThrow('read-only');
    expect(() => applyImportPlan(target, { schemaVersion: 2, commands: [{ type: 'shape.create', record: createRecord(source, 'ai-shape') }] })).toThrow('read-only');
    expect(target.getSnapshot().records.map(({ id }) => id)).toEqual(['table']); source.destroy(); target.destroy();
  });

  it('indexes sticky clusters deterministically', () => {
    const engine = setup(); const first = createRecord(engine, 'a', 'sticky-note'); const second = createRecord(engine, 'b', 'sticky-note', 220);
    first.props = { ...(first.props as object), text: richTextFromString('customer onboarding') }; second.props = { ...(second.props as object), text: richTextFromString('customer activation') };
    engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: first }, { type: 'shape.create', record: second }] });
    expect(previewStickyClusters(engine, 1)).toMatchObject([{ id: 'cluster-1', stickyIds: ['a', 'b'] }]); engine.destroy();
  });

  it('detects command shortcut conflicts', () => {
    const commands = new CommandRegistry(); commands.register({ id: 'one', label: 'One', shortcut: 'Cmd+K', execute: () => undefined });
    expect(() => commands.register({ id: 'two', label: 'Two', shortcut: 'Ctrl+K', execute: () => undefined })).toThrow('conflicts');
  });

  it('exports registered shapes to SVG without a generic fallback', async () => {
    const engine = setup(); engine.dispatch({ type: 'shape.create', record: createRecord(engine, 'a') });
    const blob = await exportCanvas(engine, { format: 'svg' });
    const text = await blobText(blob);
    expect(text).toContain('<rect'); expect(text).toContain('@font-face'); expect(text).toContain('data:font/woff2;base64,'); engine.destroy();
  });

  it('renders frame parents behind descendants and inherits hidden state in exports', async () => {
    const engine = setup();
    const frame = createRecord(engine, 'frame', 'frame');
    frame.index = 'z0';
    frame.props = { ...(frame.props as object), fill: '#112233' };
    const child = createRecord(engine, 'child');
    child.parentId = frame.id;
    child.index = 'a0';
    child.props = { ...(child.props as object), fill: '#445566' };
    const visible = createRecord(engine, 'visible', 'ellipse', 900);
    visible.props = { ...(visible.props as object), fill: '#778899' };
    engine.dispatch({ type: 'batch', commands: [
      { type: 'shape.create', record: frame },
      { type: 'shape.create', record: child },
      { type: 'shape.create', record: visible },
    ] });

    const layered = await blobText(await exportCanvas(engine, { format: 'svg' }));
    expect(layered.indexOf('#112233')).toBeLessThan(layered.indexOf('#445566'));

    engine.dispatch({ type: 'shape.update', id: frame.id, patch: { hidden: true } });
    const hidden = await blobText(await exportCanvas(engine, { format: 'svg' }));
    expect(hidden).not.toContain('#112233');
    expect(hidden).not.toContain('#445566');
    expect(hidden).toContain('#778899');
    engine.destroy();
  });

  it('matches the standalone SVG golden render', async () => {
    const engine = setup(); const record = createRecord(engine, 'golden-rectangle', 'rectangle', 12, 18);
    record.props = { ...(record.props as object), width: 160, height: 90, text: richTextFromString('Golden') };
    engine.dispatch({ type: 'shape.create', record });
    const svg = await blobText(await exportCanvas(engine, { format: 'svg', transparent: true }));
    expect(createHash('sha256').update(svg).digest('hex')).toBe('2211fe220422501592530a5ef362dd8b567c245824e09146125c1a54e0356db8');
    engine.destroy();
  });

  it('embeds resolved image bytes in standalone SVG exports', async () => {
    const engine = setup(); const assetId = crypto.randomUUID(); const definition = engine.registry.get('image');
    const record = engine.registry.validate({ id: 'image', type: 'image', typeVersion: definition.version, parentId: ROOT_PARENT_ID, index: 'a0', x: 0, y: 0, rotation: 0, opacity: 1, locked: false, hidden: false, props: { width: 20, height: 10, assetId, alt: 'Example' } });
    engine.dispatch({ type: 'batch', commands: [{ type: 'asset.set', asset: { id: assetId, assetId, mimeType: 'image/png', width: 20, height: 10, byteSize: 3 } }, { type: 'shape.create', record }] });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } }));
    const blob = await exportCanvas(engine, { format: 'svg', resolveAssetHref: () => 'https://assets.test/image' });
    const text = await blobText(blob);
    expect(text).toContain('data:image/png;base64,AQID'); expect(fetchMock).toHaveBeenCalledWith('https://assets.test/image', { credentials: 'include' });
    fetchMock.mockRestore(); engine.destroy();
  });

  it('applies selection and frame scope to JSON and DSL exports including descendants', async () => {
    const engine = setup(); const frame = createRecord(engine, 'frame', 'frame', 100, 80); const child = createRecord(engine, 'child'); child.parentId = frame.id; child.x = 20; child.y = 30;
    const outside = createRecord(engine, 'outside', 'ellipse', 900, 900);
    engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record: frame }, { type: 'shape.create', record: child }, { type: 'shape.create', record: outside }] });
    engine.setViewState({ selectedIds: ['frame'] });
    const json = JSON.parse(await blobText(await exportCanvas(engine, { format: 'json', scope: { kind: 'selection' } }))) as { records: ShapeRecord[] };
    expect(json.records.map(({ id }) => id).sort()).toEqual(['child', 'frame']);
    const dsl = await blobText(await exportCanvas(engine, { format: 'dsl', scope: { kind: 'frame', frameId: 'frame' } }));
    expect(dsl).toContain('frame frame'); expect(dsl).toContain('node child'); expect(dsl).not.toContain('outside');
    engine.destroy();
  });

  it('exports table headers and escaped cell text to SVG', async () => {
    const engine = setup(); engine.dispatch({ type: 'shape.create', record: createRecord(engine, 'table', 'table') });
    const props = engine.getSnapshot().records[0]!.props as { columns: { id: string }[] };
    const rowId = insertTableRow(engine, 'table');
    engine.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId, columnId: props.columns[0]!.id, text: '<script>alert(1)</script>' });
    const svg = await blobText(await exportCanvas(engine, { format: 'svg' }));
    expect(svg).toContain('Column 1'); expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;'); expect(svg).not.toContain('<script>');
    engine.destroy();
  });
});
