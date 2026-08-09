import type { CanvasEngine } from './CanvasEngine.js';
import { canvasSnapshotSchema, CanvasValidationError, compareFractionalIndex, ROOT_PARENT_ID, type CanvasSnapshotV2, type ShapeRecord } from './model.js';
import { getWorldTransform } from './transforms.js';
import { resolveBindingGeometry } from './bindings.js';
import { tableToCsv } from './tableCsv.js';
import { embeddedExportFontCss, ensureBrowserExportFonts } from './exportFonts.js';
import { serializeDsl, type CanvasAst } from '../dsl/index.js';
import { plainText } from '../shapes/builtins.js';

export type ExportFormat = 'json' | 'png' | 'jpeg' | 'svg' | 'pdf' | 'csv' | 'dsl';
export interface ExportScope { kind: 'board' | 'selection' | 'frame'; frameId?: string }
export interface ExportOptions {
  format: ExportFormat;
  scope?: ExportScope;
  transparent?: boolean;
  scale?: number;
  quality?: number;
  resolveAssetHref?: (assetId: string) => string | Promise<string>;
}

interface ExportScene { records: ShapeRecord[]; bounds: { x: number; y: number; width: number; height: number } }

function hierarchyOrder(records: readonly ShapeRecord[]): ShapeRecord[] {
  const ids = new Set(records.map(({ id }) => id));
  const children = new Map<string, ShapeRecord[]>();
  records.forEach((record) => {
    const parentId = ids.has(record.parentId) ? record.parentId : ROOT_PARENT_ID;
    const siblings = children.get(parentId) ?? [];
    siblings.push(record);
    children.set(parentId, siblings);
  });
  children.forEach((siblings) => siblings.sort((left, right) => compareFractionalIndex(left.index, right.index) || left.id.localeCompare(right.id)));
  const ordered: ShapeRecord[] = [];
  const visit = (parentId: string) => {
    for (const record of children.get(parentId) ?? []) {
      ordered.push(record);
      visit(record.id);
    }
  };
  visit(ROOT_PARENT_ID);
  if (ordered.length !== records.length) throw new CanvasValidationError('Export hierarchy contains a cycle', 'INVALID_HIERARCHY');
  return ordered;
}

function isEffectivelyHidden(record: ShapeRecord, records: ReadonlyMap<string, ShapeRecord>): boolean {
  let current: ShapeRecord | undefined = record;
  while (current) {
    if (current.hidden) return true;
    current = current.parentId === ROOT_PARENT_ID ? undefined : records.get(current.parentId);
  }
  return false;
}

function descendants(id: string, records: readonly ShapeRecord[]): Set<string> {
  const result = new Set([id]); let changed = true;
  while (changed) { changed = false; records.forEach((record) => { if (result.has(record.parentId) && !result.has(record.id)) { result.add(record.id); changed = true; } }); }
  return result;
}

function scopeRecordIds(engine: CanvasEngine, scope: ExportScope): Set<string> {
  const snapshot = engine.getSnapshot();
  if (scope.kind === 'board') return new Set(snapshot.records.map(({ id }) => id));
  const roots = scope.kind === 'selection'
    ? engine.getViewState().selectedIds
    : scope.frameId ? [scope.frameId] : [];
  if (!roots.length) throw new CanvasValidationError(scope.kind === 'selection' ? 'Select at least one shape to export' : 'frameId is required for frame export', 'EXPORT_SCOPE_EMPTY');
  const ids = new Set<string>();
  roots.forEach((id) => {
    const root = snapshot.records.find((record) => record.id === id);
    if (!root) throw new CanvasValidationError(`Export root '${id}' does not exist`, 'EXPORT_SCOPE_INVALID');
    if (scope.kind === 'frame' && root.type !== 'frame') throw new CanvasValidationError(`Shape '${id}' is not a frame`, 'EXPORT_SCOPE_INVALID');
    descendants(id, snapshot.records).forEach((descendantId) => ids.add(descendantId));
  });
  return ids;
}

function scopedSnapshot(engine: CanvasEngine, scope: ExportScope = { kind: 'board' }): CanvasSnapshotV2 {
  const snapshot = engine.getSnapshot();
  if (scope.kind === 'board') return snapshot;
  const ids = scopeRecordIds(engine, scope);
  const records = snapshot.records.filter(({ id }) => ids.has(id));
  const bindings = snapshot.bindings.filter((binding) =>
    ids.has(binding.connectorId)
    && (!binding.start || ids.has(binding.start.shapeId))
    && (!binding.end || ids.has(binding.end.shapeId)));
  const assetReferences = new Set<string>();
  records.forEach((record) => {
    const props = record.props as { assetId?: unknown; imageAssetId?: unknown; faviconAssetId?: unknown };
    [props.assetId, props.imageAssetId, props.faviconAssetId].forEach((value) => { if (typeof value === 'string') assetReferences.add(value); });
  });
  const assets = snapshot.assets.filter((asset) => assetReferences.has(asset.id) || assetReferences.has(asset.assetId));
  return canvasSnapshotSchema.parse({
    ...snapshot,
    document: {
      ...snapshot.document,
      presentation: { frameIds: snapshot.document.presentation.frameIds.filter((id) => ids.has(id)) },
    },
    records,
    bindings,
    assets,
  }) as CanvasSnapshotV2;
}

function scene(engine: CanvasEngine, scope: ExportScope = { kind: 'board' }): ExportScene {
  const state = engine.getViewState(); const ids = scopeRecordIds(engine, scope);
  const map = new Map(state.snapshot.records.map((record) => [record.id, record]));
  const records = hierarchyOrder(state.snapshot.records.filter((record) => ids.has(record.id) && !isEffectivelyHidden(record, map)));
  if (!records.length) throw new CanvasValidationError('Export scope contains no shapes', 'EXPORT_SCOPE_EMPTY');
  const world = resolveBindingGeometry(records.map((record) => ({ ...record, ...getWorldTransform(record.id, map), parentId: ROOT_PARENT_ID })), state.snapshot.bindings, engine.registry);
  const bounds = world.map((record) => engine.registry.get(record.type).geometry.getBounds(record));
  const minX = Math.min(...bounds.map(({ x }) => x)); const minY = Math.min(...bounds.map(({ y }) => y));
  const maxX = Math.max(...bounds.map(({ x, width }) => x + width)); const maxY = Math.max(...bounds.map(({ y, height }) => y + height));
  return { records: world, bounds: { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) } };
}

async function assetHrefs(records: readonly ShapeRecord[], resolver?: ExportOptions['resolveAssetHref']): Promise<Map<string, string>> {
  const ids = new Set<string>();
  records.forEach((record) => {
    const props = record.props as { assetId?: unknown; imageAssetId?: unknown; faviconAssetId?: unknown };
    [props.assetId, props.imageAssetId, props.faviconAssetId].forEach((value) => { if (typeof value === 'string') ids.add(value); });
  });
  if (ids.size && !resolver) throw new CanvasValidationError('Export contains image assets but no asset resolver was provided', 'ASSET_RESOLVER_REQUIRED');
  return new Map(await Promise.all([...ids].map(async (id) => [id, await resolver!(id)] as const)));
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

async function embeddedAssetHrefs(hrefs: ReadonlyMap<string, string>): Promise<Map<string, string>> {
  return new Map(await Promise.all([...hrefs].map(async ([id, href]) => {
    if (href.startsWith('data:')) return [id, href] as const;
    if (typeof fetch !== 'function') throw new CanvasValidationError('SVG asset embedding requires Fetch API support', 'FETCH_REQUIRED');
    const response = await fetch(href, { credentials: 'include' });
    if (!response.ok) throw new CanvasValidationError(`Asset '${id}' could not be fetched for embedding`, 'ASSET_FETCH_FAILED');
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (!contentType?.startsWith('image/')) throw new CanvasValidationError(`Asset '${id}' is not an image`, 'ASSET_CONTENT_TYPE_INVALID');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 25 * 1024 * 1024) throw new CanvasValidationError(`Asset '${id}' exceeds the SVG embedding limit`, 'ASSET_TOO_LARGE');
    return [id, `data:${contentType};base64,${encodeBase64(bytes)}`] as const;
  })));
}

function svgDocument(engine: CanvasEngine, selected: ExportScene, hrefs: ReadonlyMap<string, string>, transparent: boolean): string {
  const background = transparent ? '' : `<rect width="100%" height="100%" fill="${engine.getSnapshot().document.background}"/>`;
  const shapes = selected.records.map((record) => engine.registry.get(record.type).exportSvg({ record: { ...record, x: record.x - selected.bounds.x, y: record.y - selected.bounds.y }, theme: engine.getViewState().theme, resolveAssetHref: (id) => { const href = hrefs.get(id); if (!href) throw new CanvasValidationError(`Asset '${id}' was not resolved`, 'ASSET_NOT_RESOLVED'); return href; } })).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${selected.bounds.width}" height="${selected.bounds.height}" viewBox="0 0 ${selected.bounds.width} ${selected.bounds.height}"><style>${embeddedExportFontCss()}</style>${background}${shapes}</svg>`;
}

async function loadImages(hrefs: ReadonlyMap<string, string>): Promise<Map<string, HTMLImageElement>> {
  return new Map(await Promise.all([...hrefs].map(([id, href]) => new Promise<readonly [string, HTMLImageElement]>((resolve, reject) => {
    const image = new Image(); image.decoding = 'async'; image.onload = () => resolve([id, image]); image.onerror = () => reject(new CanvasValidationError(`Asset '${id}' could not be decoded`, 'ASSET_DECODE_FAILED')); image.src = href;
  }))));
}

async function rasterCanvas(engine: CanvasEngine, selected: ExportScene, options: ExportOptions, hrefs: ReadonlyMap<string, string>): Promise<HTMLCanvasElement> {
  if (typeof document === 'undefined') throw new CanvasValidationError('Raster export requires a browser environment', 'BROWSER_REQUIRED');
  try { await ensureBrowserExportFonts(); } catch (error) { throw new CanvasValidationError(`Export font could not be loaded: ${error instanceof Error ? error.message : String(error)}`, 'FONT_LOAD_FAILED'); }
  const scale = Math.max(0.25, Math.min(options.scale ?? 2, 8));
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(selected.bounds.width * scale); canvas.height = Math.ceil(selected.bounds.height * scale);
  const context = canvas.getContext('2d'); if (!context) throw new CanvasValidationError('2D export context is unavailable', 'CANVAS_CONTEXT_UNAVAILABLE');
  const images = await loadImages(hrefs); context.scale(scale, scale);
  if (!options.transparent) { context.fillStyle = engine.getSnapshot().document.background; context.fillRect(0, 0, selected.bounds.width, selected.bounds.height); }
  context.translate(-selected.bounds.x, -selected.bounds.y);
  selected.records.forEach((record) => engine.registry.get(record.type).render({ context, record, selected: false, theme: engine.getViewState().theme, getImage: (id) => images.get(id) ?? null }));
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new CanvasValidationError('Canvas encoding failed', 'ENCODE_FAILED')), type, quality));
}

function snapshotDsl(snapshot: CanvasSnapshotV2): string {
  const ast: CanvasAst = { title: snapshot.document.title, direction: 'LR', statements: [] };
  snapshot.records.filter(({ type }) => type !== 'arrow' && type !== 'line' && type !== 'freehand').forEach((record) => {
    const props = record.props as { text?: Parameters<typeof plainText>[0]; width?: number; height?: number; fill?: string; name?: string };
    ast.statements.push({ kind: 'node', id: record.id, shape: record.type, label: props.text ? plainText(props.text) : props.name ?? '', x: record.x, y: record.y, width: props.width, height: props.height, fill: props.fill, parentId: record.parentId === ROOT_PARENT_ID ? undefined : record.parentId, location: { line: 1, column: 1 } });
  });
  snapshot.bindings.forEach((binding) => { if (binding.start && binding.end) ast.statements.push({ kind: 'edge', id: binding.connectorId, from: binding.start.shapeId, to: binding.end.shapeId, label: '', location: { line: 1, column: 1 } }); });
  return serializeDsl(ast);
}

export async function exportCanvas(engine: CanvasEngine, options: ExportOptions): Promise<Blob> {
  if (options.format === 'json') return new Blob([JSON.stringify(scopedSnapshot(engine, options.scope), null, 2)], { type: 'application/json' });
  if (options.format === 'dsl') return new Blob([snapshotDsl(scopedSnapshot(engine, options.scope))], { type: 'text/plain;charset=utf-8' });
  if (options.format === 'csv') {
    const selected = engine.getViewState().selectedIds; if (selected.length !== 1) throw new CanvasValidationError('Select exactly one table for CSV export', 'EXPORT_SCOPE_INVALID');
    return new Blob([tableToCsv(engine, selected[0]!)], { type: 'text/csv;charset=utf-8' });
  }
  const selected = scene(engine, options.scope); const hrefs = await assetHrefs(selected.records, options.resolveAssetHref);
  if (options.format === 'svg') return new Blob([svgDocument(engine, selected, await embeddedAssetHrefs(hrefs), options.transparent ?? false)], { type: 'image/svg+xml' });
  if (options.format === 'png' || options.format === 'jpeg') return canvasBlob(await rasterCanvas(engine, selected, options, hrefs), options.format === 'png' ? 'image/png' : 'image/jpeg', options.quality ?? 0.92);
  const { jsPDF } = await import('jspdf');
  const frames = options.scope?.kind === 'frame' ? [options.scope.frameId!] : engine.getSnapshot().document.presentation.frameIds;
  const pages = frames.length ? frames.map((frameId) => scene(engine, { kind: 'frame', frameId })) : [selected];
  let pdf: InstanceType<typeof jsPDF> | null = null;
  for (const [index, page] of pages.entries()) {
    const pageHrefs = await assetHrefs(page.records, options.resolveAssetHref); const canvas = await rasterCanvas(engine, page, { ...options, scale: 2, transparent: false }, pageHrefs);
    const orientation = page.bounds.width >= page.bounds.height ? 'landscape' : 'portrait';
    if (!pdf) pdf = new jsPDF({ orientation, unit: 'px', format: [page.bounds.width, page.bounds.height] });
    else pdf.addPage([page.bounds.width, page.bounds.height], orientation);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, page.bounds.width, page.bounds.height);
    if (index === pages.length - 1) break;
  }
  if (!pdf) throw new CanvasValidationError('PDF contains no pages', 'EXPORT_SCOPE_EMPTY');
  return pdf.output('blob');
}

export function importCanvasJson(engine: CanvasEngine, json: string): void {
  const snapshot = canvasSnapshotSchema.parse(JSON.parse(json)) as CanvasSnapshotV2;
  engine.dispatch({ type: 'document.replace', snapshot });
}
