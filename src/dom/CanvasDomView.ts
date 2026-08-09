import { generateKeyBetween } from 'fractional-indexing';
import type { CanvasEngine, CanvasViewState } from '../core/CanvasEngine.js';
import { findNearestConnectionPort, getConnectionPorts, resolveBindingGeometry, type NearestConnectionPort } from '../core/bindings.js';
import type { CanvasCommand } from '../core/commands.js';
import { CanvasReadonlyError, compareFractionalIndex, ROOT_PARENT_ID, type ShapeRecord } from '../core/model.js';
import { groupSelection, ungroupSelection } from '../core/grouping.js';
import { getWorldTransform, toLocalTransform } from '../core/transforms.js';
import { SpatialHashIndex } from './SpatialHashIndex.js';
import {
  connectorEndpointAtPoint,
  cursorForResizeHandle,
  intersects,
  normalizedBox,
  resizeHandleAtPoint,
  resizeHandlePoints,
  selectionBounds,
  snapTranslation,
  type Point,
  type ResizeHandle,
  type SnapLine,
} from './interactionGeometry.js';

const SHAPE_TOOLS = new Set(['rectangle', 'ellipse', 'diamond', 'triangle', 'sticky-note', 'frame', 'text', 'line', 'arrow', 'freehand', 'db-table', 'db-view', 'db-enum']);
const CONNECTOR_TOOLS = new Set(['line', 'arrow']);
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

export interface MountCanvasOptions {
  root: HTMLElement;
  engine: CanvasEngine;
  resolveAssetUrl?: (assetId: string) => string | Promise<string>;
  locale?: 'en' | 'tr';
  toolbar?: boolean;
  onEditRecord?: (recordId: string) => void;
  onPlaceTemplate?: (templateKey: string, world: { x: number; y: number }) => void;
  onError?: (error: Error) => void;
  onPointerUpdate?: (payload: { pointer: { x: number; y: number }; button: 'left' | 'none' | 'up' }) => void;
}

export interface CanvasPerformanceMetrics {
  fps: number;
  frameTime: number;
  averageFrameTime: number;
  totalRecords: number;
  renderedRecords: number;
}

export interface CanvasView {
  readonly canvas: HTMLCanvasElement;
  readonly engine: CanvasEngine;
  setTool(tool: string): void;
  fitToContent(): void;
  focusRecord(id: string): void;
  hitTest(point: { x: number; y: number }): ShapeRecord | null;
  getToolStyle(tool: string): Record<string, unknown>;
  setToolStyle(tool: string, patch: Record<string, unknown>): void;
  getPerformanceMetrics(): CanvasPerformanceMetrics;
  destroy(): void;
}

interface PointerInteractionBase {
  pointerId: number;
  group: string;
  startScreen: Point;
  startWorld: Point;
  viewport: CanvasViewState['viewport'];
}

interface PanInteraction extends PointerInteractionBase { kind: 'pan' }
interface DragInteraction extends PointerInteractionBase {
  kind: 'drag';
  records: Map<string, ShapeRecord>;
  bounds: ReturnType<typeof selectionBounds>;
}
interface DrawInteraction extends PointerInteractionBase { kind: 'draw'; drawingId: string; moved: boolean }
interface BoxSelectInteraction extends PointerInteractionBase { kind: 'box-select'; additive: boolean; initialIds: readonly string[] }
interface ResizeInteraction extends PointerInteractionBase { kind: 'resize'; record: ShapeRecord; handle: ResizeHandle }
interface ConnectorEndpointInteraction extends PointerInteractionBase { kind: 'connector-endpoint'; record: ShapeRecord; endpoint: 'start' | 'end' }
interface EraseInteraction extends PointerInteractionBase { kind: 'erase'; ids: Set<string> }
type PointerInteraction = PanInteraction | DragInteraction | DrawInteraction | BoxSelectInteraction | ResizeInteraction | ConnectorEndpointInteraction | EraseInteraction;

interface PinchInteraction { pointerIds: [number, number]; distance: number; midpoint: Point; viewport: CanvasViewState['viewport']; worldMidpoint: Point }

interface WorldRecord extends ShapeRecord {
  depth: number;
}

class ImageCache {
  readonly #images = new Map<string, HTMLImageElement>();
  readonly #resolve: (assetId: string) => string | Promise<string>;
  readonly #onLoad: () => void;
  readonly #onError: (error: Error) => void;
  constructor(resolve: (assetId: string) => string | Promise<string>, onLoad: () => void, onError: (error: Error) => void) { this.#resolve = resolve; this.#onLoad = onLoad; this.#onError = onError; }
  get(assetId: string): HTMLImageElement | null {
    const existing = this.#images.get(assetId);
    if (existing) return existing.complete && existing.naturalWidth > 0 ? existing : null;
    const image = new Image(); image.decoding = 'async'; image.onload = this.#onLoad; image.onerror = () => this.#onError(new Error(`Canvas asset '${assetId}' could not be decoded`));
    this.#images.set(assetId, image);
    void Promise.resolve(this.#resolve(assetId)).then((url) => { if (this.#images.get(assetId) === image) image.src = url; }).catch((error: unknown) => this.#onError(error instanceof Error ? error : new Error(String(error))));
    return null;
  }
  clear(): void { this.#images.forEach((image) => { image.onload = null; image.onerror = null; image.src = ''; }); this.#images.clear(); }
}

export class DomCanvasView implements CanvasView {
  readonly canvas: HTMLCanvasElement;
  readonly engine: CanvasEngine;
  readonly #root: HTMLElement;
  readonly #toolbar: HTMLElement;
  readonly #status: HTMLElement;
  readonly #index = new SpatialHashIndex();
  readonly #imageCache: ImageCache;
  readonly #resolveAssetUrl: (assetId: string) => string | Promise<string>;
  readonly #onPointerUpdate?: MountCanvasOptions['onPointerUpdate'];
  readonly #onEditRecord?: MountCanvasOptions['onEditRecord'];
  readonly #onPlaceTemplate?: MountCanvasOptions['onPlaceTemplate'];
  readonly #abort = new AbortController();
  readonly #unsubscribe: () => void;
  readonly #resizeObserver: ResizeObserver;
  #records: WorldRecord[] = [];
  #recordMap = new Map<string, WorldRecord>();
  #sourceMap = new Map<string, ShapeRecord>();
  #recordPositions = new Map<string, number>();
  #lastSnapshot: CanvasViewState['snapshot'] | null = null;
  #order = new Map<string, number>();
  #interaction: PointerInteraction | null = null;
  #touches = new Map<number, Point>();
  #pinch: PinchInteraction | null = null;
  #selectionBox: ReturnType<typeof normalizedBox> | null = null;
  #snapLines: SnapLine[] = [];
  #erasePath: Point[] = [];
  #hoveredRecordId: string | null = null;
  #hoveredPort: NearestConnectionPort | null = null;
  #spacePressed = false;
  #toolBeforeSpace: string | null = null;
  #polylineId: string | null = null;
  #polylineGroup: string | null = null;
  #toolStyles = new Map<string, Record<string, unknown>>();
  #renderFrame: number | null = null;
  #destroyed = false;
  #frameTimes: number[] = [];
  #metrics: CanvasPerformanceMetrics = { fps: 0, frameTime: 0, averageFrameTime: 0, totalRecords: 0, renderedRecords: 0 };

  constructor(options: MountCanvasOptions) {
    this.#root = options.root;
    this.engine = options.engine;
    this.#resolveAssetUrl = options.resolveAssetUrl ?? ((assetId) => `/api/canvas-assets/${encodeURIComponent(assetId)}`);
    this.#onPointerUpdate = options.onPointerUpdate;
    this.#onEditRecord = options.onEditRecord;
    this.#onPlaceTemplate = options.onPlaceTemplate;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tahta-canvas'; this.canvas.tabIndex = 0; this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute('aria-label', options.locale === 'tr' ? 'Etkileşimli tahta' : 'Interactive whiteboard');
    this.#toolbar = this.#createToolbar(options.locale ?? 'en');
    this.#status = document.createElement('div'); this.#status.className = 'tahta-status'; this.#status.setAttribute('role', 'status'); this.#status.setAttribute('aria-live', 'polite');
    this.#root.classList.add('tahta-root'); this.#root.append(this.canvas); if (options.toolbar ?? true) this.#root.append(this.#toolbar); this.#root.append(this.#status);
    this.#imageCache = new ImageCache(this.#resolveAssetUrl, () => this.#scheduleRender(), (error) => { this.#status.textContent = error.message; options.onError?.(error); });
    this.#resizeObserver = new ResizeObserver(() => this.#scheduleRender());
    this.#resizeObserver.observe(this.#root);
    this.#bindEvents();
    this.#unsubscribe = this.engine.subscribe((state) => state, (state) => this.#stateChanged(state));
    this.#stateChanged(this.engine.getViewState());
  }

  setTool(tool: string): void {
    if (tool.startsWith('template:') && !this.#onPlaceTemplate) throw new Error('Template placement requires an onPlaceTemplate handler');
    if (tool !== 'select' && tool !== 'hand' && tool !== 'eraser' && !SHAPE_TOOLS.has(tool) && !tool.startsWith('template:')) throw new Error(`Unknown canvas tool '${tool}'`);
    if (this.#polylineId && tool !== 'line') this.#finishPolyline();
    this.engine.setViewState({ activeTool: tool }); this.canvas.focus();
  }

  getToolStyle(tool: string): Record<string, unknown> {
    const definition = this.engine.registry.get(tool); if (!definition.tool) throw new Error(`Shape '${tool}' is not a canvas tool`);
    const existing = this.#toolStyles.get(tool); if (existing) return structuredClone(existing);
    const defaults = definition.defaults() as Record<string, unknown>; this.#toolStyles.set(tool, structuredClone(defaults)); return structuredClone(defaults);
  }

  setToolStyle(tool: string, patch: Record<string, unknown>): void {
    const definition = this.engine.registry.get(tool); if (!definition.tool) throw new Error(`Shape '${tool}' is not a canvas tool`);
    const value = definition.schema.parse({ ...this.getToolStyle(tool), ...patch }) as Record<string, unknown>; this.#toolStyles.set(tool, structuredClone(value));
  }

  fitToContent(): void {
    const records = this.#records.filter((record) => !this.#isEffectivelyHidden(record));
    if (!records.length) {
      this.engine.setViewState({ viewport: { x: 0, y: 0, zoom: 1 } });
      return;
    }
    const bounds = records.map((record) => this.engine.registry.get(record.type).geometry.getBounds(record));
    const left = Math.min(...bounds.map(({ x }) => x));
    const top = Math.min(...bounds.map(({ y }) => y));
    const right = Math.max(...bounds.map(({ x, width }) => x + width));
    const bottom = Math.max(...bounds.map(({ y, height }) => y + height));
    const rect = this.canvas.getBoundingClientRect();
    const padding = Math.min(120, Math.max(48, Math.min(rect.width, rect.height) * 0.08));
    const sidebarOffset = Number.parseFloat(getComputedStyle(this.#root).getPropertyValue('--ui-left-offset')) || 0;
    const safeLeft = Math.min(rect.width - 1, sidebarOffset + padding);
    const safeTop = Math.min(rect.height - 1, padding + 48);
    const safeRight = Math.max(safeLeft + 1, rect.width - padding);
    const safeBottom = Math.max(safeTop + 1, rect.height - Math.max(80, padding));
    const availableWidth = safeRight - safeLeft;
    const availableHeight = safeBottom - safeTop;
    const zoom = Math.min(2, Math.max(MIN_ZOOM, Math.min(availableWidth / Math.max(1, right - left), availableHeight / Math.max(1, bottom - top))));
    this.engine.setViewState({
      viewport: {
        x: (safeLeft + safeRight) / 2 - ((left + right) / 2) * zoom,
        y: (safeTop + safeBottom) / 2 - ((top + bottom) / 2) * zoom,
        zoom,
      },
    });
  }

  focusRecord(id: string): void {
    const record = this.#recordMap.get(id); if (!record) throw new Error(`Shape '${id}' does not exist`);
    const definition = this.engine.registry.get(record.type); const bounds = definition.geometry.getBounds(record);
    const rect = this.canvas.getBoundingClientRect();
    const zoom = Math.min(2, Math.max(MIN_ZOOM, Math.min(rect.width / Math.max(bounds.width + 120, 1), rect.height / Math.max(bounds.height + 120, 1))));
    this.engine.setViewState({ selectedIds: [id], viewport: { x: rect.width / 2 - (bounds.x + bounds.width / 2) * zoom, y: rect.height / 2 - (bounds.y + bounds.height / 2) * zoom, zoom } });
  }

  hitTest(point: { x: number; y: number }): ShapeRecord | null {
    const candidates = this.#index.query({ x: point.x - 8, y: point.y - 8, width: 16, height: 16 });
    const ordered = [...candidates].sort((a, b) => (this.#order.get(b) ?? 0) - (this.#order.get(a) ?? 0));
    for (const id of ordered) {
      const record = this.#recordMap.get(id); if (!record || this.#isEffectivelyHidden(record)) continue;
      if (this.engine.registry.get(record.type).geometry.containsPoint(record, point)) return record;
    }
    return null;
  }

  getPerformanceMetrics(): CanvasPerformanceMetrics { return { ...this.#metrics }; }

  destroy(): void {
    if (this.#destroyed) return; this.#destroyed = true;
    this.#abort.abort(); this.#unsubscribe(); this.#resizeObserver.disconnect(); this.#imageCache.clear(); this.#index.clear();
    this.#touches.clear(); this.#pinch = null; this.#interaction = null;
    if (this.#renderFrame !== null) cancelAnimationFrame(this.#renderFrame);
    this.canvas.remove(); this.#toolbar.remove(); this.#status.remove(); this.#root.classList.remove('tahta-root');
  }

  #bindEvents(): void {
    const options = { signal: this.#abort.signal };
    this.canvas.addEventListener('pointerdown', this.#onPointerDown, options);
    this.canvas.addEventListener('pointermove', this.#onPointerMove, options);
    this.canvas.addEventListener('pointerup', this.#onPointerUp, options);
    this.canvas.addEventListener('pointercancel', this.#onPointerUp, options);
    this.canvas.addEventListener('pointerleave', this.#onPointerLeave, options);
    this.canvas.addEventListener('wheel', this.#onWheel, { ...options, passive: false });
    this.canvas.addEventListener('keydown', this.#onKeyDown, options);
    this.canvas.addEventListener('keyup', this.#onKeyUp, options);
    this.canvas.addEventListener('dblclick', this.#onDoubleClick, options);
  }

  #stateChanged(state: CanvasViewState): void {
    const bindingsChanged = this.#lastSnapshot?.bindings !== state.snapshot.bindings;
    if (!this.#lastSnapshot || state.snapshot.records.length !== this.#sourceMap.size || state.changedRecordIds.length > 100 || bindingsChanged) this.#rebuildRecords(state.snapshot.records, state.snapshot.bindings);
    else if (state.snapshot !== this.#lastSnapshot && state.changedRecordIds.length) this.#updateRecords(state.snapshot.records, state.snapshot.bindings, state.changedRecordIds);
    this.#lastSnapshot = state.snapshot;
    this.#toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tool === state.activeTool)));
    this.#scheduleRender();
  }

  #rebuildRecords(records: readonly ShapeRecord[], bindings: CanvasViewState['snapshot']['bindings']): void {
    this.#sourceMap = new Map(records.map((record) => [record.id, record]));
    this.#records = this.#worldRecords(records, bindings); this.#recordMap = new Map(this.#records.map((record) => [record.id, record]));
    this.#order = new Map(this.#records.map((record, index) => [record.id, index])); this.#recordPositions = new Map(records.map((record, index) => [record.id, index]));
    this.#index.update(this.#records.map((record) => ({ id: record.id, ...this.engine.registry.get(record.type).geometry.getBounds(record) })));
  }

  #updateRecords(records: readonly ShapeRecord[], bindings: CanvasViewState['snapshot']['bindings'], changedIds: readonly string[]): void {
    for (const id of changedIds) {
      const position = this.#recordPositions.get(id); const next = position === undefined ? undefined : records[position]; const previous = this.#sourceMap.get(id);
      if (!next || next.id !== id || !previous || previous.index !== next.index || previous.parentId !== next.parentId) { this.#rebuildRecords(records, bindings); return; }
      this.#sourceMap.set(id, next);
    }
    const affected = new Set(changedIds); let expanded = true;
    while (expanded) { expanded = false; this.#sourceMap.forEach((record) => { if (affected.has(record.parentId) && !affected.has(record.id)) { affected.add(record.id); expanded = true; } }); }
    affected.forEach((id) => {
      const source = this.#sourceMap.get(id); const position = this.#order.get(id); if (!source || position === undefined) return;
      const world = getWorldTransform(id, this.#sourceMap); const record: WorldRecord = { ...source, ...world, depth: this.#recordMap.get(id)?.depth ?? 0 };
      this.#records[position] = record; this.#recordMap.set(id, record); this.#index.upsert({ id, ...this.engine.registry.get(record.type).geometry.getBounds(record) });
    });
    const affectedConnectors = new Set(bindings.filter((binding) => affected.has(binding.connectorId) || (binding.start && affected.has(binding.start.shapeId)) || (binding.end && affected.has(binding.end.shapeId))).map(({ connectorId }) => connectorId));
    if (affectedConnectors.size) {
      const resolved = resolveBindingGeometry(this.#records, bindings.filter(({ connectorId }) => affectedConnectors.has(connectorId)), this.engine.registry);
      affectedConnectors.forEach((id) => { const position = this.#order.get(id); const record = resolved.find((value) => value.id === id); if (position === undefined || !record) return; const world = record as WorldRecord; this.#records[position] = world; this.#recordMap.set(id, world); this.#index.upsert({ id, ...this.engine.registry.get(world.type).geometry.getBounds(world) }); });
    }
  }

  #worldRecords(records: readonly ShapeRecord[], bindings: CanvasViewState['snapshot']['bindings']): WorldRecord[] {
    const source = new Map(records.map((record) => [record.id, record]));
    const children = new Map<string, ShapeRecord[]>();
    records.forEach((record) => { const list = children.get(record.parentId) ?? []; list.push(record); children.set(record.parentId, list); });
    children.forEach((list) => list.sort((a, b) => compareFractionalIndex(a.index, b.index) || a.id.localeCompare(b.id)));
    const result: WorldRecord[] = [];
    const visit = (parentId: string, depth: number) => {
      for (const record of children.get(parentId) ?? []) {
        const world = getWorldTransform(record.id, source);
        result.push({ ...record, ...world, depth }); visit(record.id, depth + 1);
      }
    };
    visit(ROOT_PARENT_ID, 0); return resolveBindingGeometry(result, bindings, this.engine.registry) as WorldRecord[];
  }

  #scheduleRender(): void {
    if (this.#renderFrame !== null || this.#destroyed) return;
    this.#renderFrame = requestAnimationFrame(() => { this.#renderFrame = null; this.#render(); });
  }

  #render(): void {
    const started = performance.now(); const state = this.engine.getViewState(); const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1; const width = Math.max(1, Math.floor(rect.width * dpr)); const height = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    const context = this.canvas.getContext('2d'); if (!context) throw new Error('2D canvas context is unavailable');
    context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, rect.width, rect.height); context.fillStyle = state.snapshot.document.background; context.fillRect(0, 0, rect.width, rect.height);
    this.#renderGrid(context, state, rect); if (!this.#records.length) this.#renderWelcome(context, state, rect); context.save(); context.translate(state.viewport.x, state.viewport.y); context.scale(state.viewport.zoom, state.viewport.zoom);
    const visibleIds = this.#index.query({ x: -state.viewport.x / state.viewport.zoom, y: -state.viewport.y / state.viewport.zoom, width: rect.width / state.viewport.zoom, height: rect.height / state.viewport.zoom });
    let rendered = 0;
    const visibleRecords = [...visibleIds]
      .map((id) => this.#recordMap.get(id))
      .filter((record): record is WorldRecord => record !== undefined && !this.#isEffectivelyHidden(record))
      .sort((left, right) => (this.#order.get(left.id) ?? 0) - (this.#order.get(right.id) ?? 0));
    for (const record of visibleRecords) {
      const definition = this.engine.registry.get(record.type);
      definition.render({ context, record, selected: state.selectedIds.includes(record.id), theme: state.theme, getImage: (assetId) => this.#imageCache.get(assetId) });
      rendered++;
    }
    this.#renderInteractionOverlays(context, state);
    context.restore();
    const frameTime = performance.now() - started; this.#frameTimes.push(frameTime); if (this.#frameTimes.length > 120) this.#frameTimes.shift();
    const average = this.#frameTimes.reduce((sum, value) => sum + value, 0) / this.#frameTimes.length;
    this.#metrics = { fps: average ? Math.min(60, 1000 / average) : 60, frameTime, averageFrameTime: average, totalRecords: this.#records.length, renderedRecords: rendered };
  }

  #renderGrid(context: CanvasRenderingContext2D, state: CanvasViewState, rect: DOMRect): void {
    if (!state.snapshot.document.grid.enabled) return; const size = state.snapshot.document.grid.size * state.viewport.zoom; if (size < 6) return;
    context.save(); context.strokeStyle = state.theme === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(15,23,42,.08)'; context.lineWidth = 1;
    context.beginPath(); for (let x = state.viewport.x % size; x < rect.width; x += size) { context.moveTo(x, 0); context.lineTo(x, rect.height); }
    for (let y = state.viewport.y % size; y < rect.height; y += size) { context.moveTo(0, y); context.lineTo(rect.width, y); } context.stroke(); context.restore();
  }

  #renderWelcome(context: CanvasRenderingContext2D, state: CanvasViewState, rect: DOMRect): void {
    context.save(); context.textAlign = 'center'; context.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#0f172a'; context.font = "600 42px 'Architects Daughter', cursive"; context.fillText('Welcome to your whiteboard', rect.width / 2, rect.height / 2 - 10);
    context.globalAlpha = 0.6; context.font = "20px 'Architects Daughter', cursive"; context.fillText('Choose a tool and start drawing.', rect.width / 2, rect.height / 2 + 40); context.restore();
  }

  #renderInteractionOverlays(context: CanvasRenderingContext2D, state: CanvasViewState): void {
    const zoom = state.viewport.zoom;
    const selectedRecords = state.selectedIds.map((id) => this.#recordMap.get(id)).filter((record): record is WorldRecord => Boolean(record));
    context.save();
    if (selectedRecords.length) {
      const bounds = selectionBounds(selectedRecords, this.engine.registry);
      if (bounds) {
        context.strokeStyle = '#60a5fa'; context.lineWidth = 1 / zoom; context.setLineDash([]); context.globalAlpha = 0.85;
        context.strokeRect(bounds.x - 4 / zoom, bounds.y - 4 / zoom, bounds.width + 8 / zoom, bounds.height + 8 / zoom);
        if (selectedRecords.length === 1 && !selectedRecords[0]!.locked) {
          const selected = selectedRecords[0]!;
          if (selected.type === 'line' || selected.type === 'arrow') this.#renderConnectorHandles(context, selected, zoom);
          else if (this.#isResizable(selected)) {
            context.setLineDash([]); context.fillStyle = state.theme === 'dark' ? '#1e293b' : '#ffffff'; context.strokeStyle = '#3b82f6'; context.lineWidth = 1.8 / zoom; context.globalAlpha = 1;
            Object.entries(resizeHandlePoints(bounds)).forEach(([handle, point]) => { context.beginPath(); context.arc(point.x, point.y, (handle.length === 2 ? 4 : 3) / zoom, 0, Math.PI * 2); context.fill(); context.stroke(); });
          }
          getConnectionPorts(selected, this.engine.registry).forEach((port) => this.#renderPort(context, port, zoom, this.#hoveredPort?.shapeId === selected.id && this.#hoveredPort.id === port.id));
        }
      }
    }
    if (this.#hoveredRecordId && CONNECTOR_TOOLS.has(state.activeTool)) {
      const hovered = this.#recordMap.get(this.#hoveredRecordId);
      if (hovered) getConnectionPorts(hovered, this.engine.registry).forEach((port) => this.#renderPort(context, port, zoom, this.#hoveredPort?.id === port.id));
    }
    if (this.#selectionBox) {
      context.setLineDash([]); context.fillStyle = 'rgba(96,165,250,.08)'; context.strokeStyle = 'rgba(59,130,246,.65)'; context.lineWidth = 1 / zoom;
      context.fillRect(this.#selectionBox.x, this.#selectionBox.y, this.#selectionBox.width, this.#selectionBox.height); context.strokeRect(this.#selectionBox.x, this.#selectionBox.y, this.#selectionBox.width, this.#selectionBox.height);
    }
    if (this.#snapLines.length) {
      context.strokeStyle = '#f87171'; context.lineWidth = 1 / zoom; context.setLineDash([4 / zoom, 4 / zoom]); context.beginPath();
      this.#snapLines.forEach((line) => { context.moveTo(line.x1, line.y1); context.lineTo(line.x2, line.y2); }); context.stroke();
    }
    if (this.#erasePath.length > 1) {
      context.strokeStyle = 'rgba(139,147,158,.75)'; context.lineWidth = 4 / zoom; context.lineCap = 'round'; context.lineJoin = 'round'; context.setLineDash([]); context.beginPath(); context.moveTo(this.#erasePath[0]!.x, this.#erasePath[0]!.y); this.#erasePath.slice(1).forEach((point) => context.lineTo(point.x, point.y)); context.stroke();
    }
    context.restore();
  }

  #renderPort(context: CanvasRenderingContext2D, port: Point, zoom: number, active: boolean): void {
    const size = (active ? 8 : 5) / zoom; context.save(); context.setLineDash([]); context.beginPath(); context.moveTo(port.x, port.y - size); context.lineTo(port.x + size, port.y); context.lineTo(port.x, port.y + size); context.lineTo(port.x - size, port.y); context.closePath();
    context.fillStyle = active ? '#3b82f6' : '#ffffff'; context.strokeStyle = '#475569'; context.lineWidth = 1.2 / zoom; context.fill(); context.stroke(); context.restore();
  }

  #renderConnectorHandles(context: CanvasRenderingContext2D, record: ShapeRecord, zoom: number): void {
    const points = (record.props as { points: Point[] }).points; if (points.length < 2) return;
    const endpoint = (point: Point) => ({ x: record.x + point.x, y: record.y + point.y });
    context.save(); context.setLineDash([]); context.fillStyle = '#ffffff'; context.strokeStyle = '#6366f1'; context.lineWidth = 2 / zoom;
    [endpoint(points[0]!), endpoint(points.at(-1)!)].forEach((point) => { context.beginPath(); context.arc(point.x, point.y, 5 / zoom, 0, Math.PI * 2); context.fill(); context.stroke(); }); context.restore();
  }

  #isEffectivelyHidden(record: ShapeRecord): boolean {
    let current: ShapeRecord | undefined = record;
    while (current) {
      if (current.hidden) return true;
      current = current.parentId === ROOT_PARENT_ID ? undefined : this.#sourceMap.get(current.parentId);
    }
    return false;
  }

  #createToolbar(locale: 'en' | 'tr'): HTMLElement {
    const toolbar = document.createElement('div'); toolbar.className = 'tahta-toolbar'; toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', locale === 'tr' ? 'Tahta araçları' : 'Canvas tools');
    const labels: Record<string, string> = { select: 'Select', hand: 'Hand', rectangle: 'Rectangle', ellipse: 'Ellipse', diamond: 'Diamond', 'sticky-note': 'Sticky', frame: 'Frame', text: 'Text', arrow: 'Arrow', freehand: 'Draw' };
    Object.entries(labels).forEach(([tool, label]) => { const button = document.createElement('button'); button.type = 'button'; button.dataset.tool = tool; button.textContent = label; button.setAttribute('aria-pressed', 'false'); button.addEventListener('click', () => this.setTool(tool), { signal: this.#abort.signal }); toolbar.append(button); });
    return toolbar;
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 1) return;
    const state = this.engine.getViewState(); const screen = this.#screenPoint(event); const world = this.#snapPoint(this.#worldPoint(screen, state.viewport), state); const group = `pointer-${event.pointerId}-${crypto.randomUUID()}`;
    this.canvas.setPointerCapture(event.pointerId); this.canvas.focus();
    if (event.pointerType === 'touch') {
      this.#touches.set(event.pointerId, screen);
      if (this.#touches.size === 2) { this.#beginPinch(); return; }
    }
    if (state.readonly || state.activeTool === 'hand' || this.#spacePressed || event.button === 1 || event.altKey) {
      this.#interaction = { kind: 'pan', pointerId: event.pointerId, group, startScreen: screen, startWorld: world, viewport: state.viewport }; this.canvas.style.cursor = 'grabbing'; return;
    }
    if (state.activeTool === 'line') { this.#polylinePointerDown(world); return; }
    if (state.activeTool === 'eraser') {
      const target = this.hitTest(world); const ids = new Set<string>(); if (target && !target.locked) ids.add(target.id);
      this.#erasePath = [world]; this.#interaction = { kind: 'erase', pointerId: event.pointerId, group, startScreen: screen, startWorld: world, viewport: state.viewport, ids }; this.canvas.style.cursor = 'crosshair'; return;
    }
    if (state.activeTool === 'select') {
      const selectedRecord = state.selectedIds.length === 1 ? this.#recordMap.get(state.selectedIds[0]!) : undefined;
      if (selectedRecord && !selectedRecord.locked) {
        const endpoint = connectorEndpointAtPoint(selectedRecord, world, state.viewport.zoom);
        if (endpoint) { this.#interaction = { kind: 'connector-endpoint', pointerId: event.pointerId, group, startScreen: screen, startWorld: world, viewport: state.viewport, record: selectedRecord, endpoint }; return; }
        if (this.#isResizable(selectedRecord)) {
          const bounds = this.engine.registry.get(selectedRecord.type).geometry.getBounds(selectedRecord); const handle = resizeHandleAtPoint(bounds, world, state.viewport.zoom);
          if (handle) { this.#interaction = { kind: 'resize', pointerId: event.pointerId, group, startScreen: screen, startWorld: world, viewport: state.viewport, record: selectedRecord, handle }; return; }
        }
      }
      const hit = this.hitTest(world); const target = hit ? this.#selectionTarget(hit) : null;
      if (!target) {
        if (!event.shiftKey) this.engine.setViewState({ selectedIds: [] });
        this.#selectionBox = normalizedBox(world, world);
        this.#interaction = { kind: 'box-select', pointerId: event.pointerId, group, startScreen: screen, startWorld: world, viewport: state.viewport, additive: event.shiftKey, initialIds: state.selectedIds }; this.#scheduleRender(); return;
      }
      let selectedIds: string[];
      if (event.shiftKey) selectedIds = state.selectedIds.includes(target.id) ? state.selectedIds.filter((id) => id !== target.id) : [...state.selectedIds, target.id];
      else selectedIds = state.selectedIds.includes(target.id) ? [...state.selectedIds] : [target.id];
      this.engine.setViewState({ selectedIds });
      if (!selectedIds.includes(target.id)) return;
      const dragIds = new Set(selectedIds); const bindings = this.engine.getSnapshot().bindings;
      selectedIds.forEach((id) => { const record = this.#recordMap.get(id); if (record?.type !== 'arrow' && record?.type !== 'line') return; const binding = bindings.find(({ connectorId }) => connectorId === id); if (binding?.start) dragIds.add(binding.start.shapeId); if (binding?.end) dragIds.add(binding.end.shapeId); });
      const records = new Map([...dragIds].map((id): [string, WorldRecord | undefined] => [id, this.#recordMap.get(id)]).filter((entry): entry is [string, WorldRecord] => entry[1] !== undefined && !entry[1].locked && !this.#hasSelectedAncestor(entry[1], dragIds)));
      this.#interaction = { kind: 'drag', pointerId: event.pointerId, group, startScreen: screen, startWorld: world, viewport: state.viewport, records, bounds: selectionBounds([...records.values()], this.engine.registry) }; this.canvas.style.cursor = records.size ? 'move' : 'default'; return;
    }
    if (state.activeTool.startsWith('template:')) {
      this.#onPlaceTemplate?.(state.activeTool.slice('template:'.length), world);
      this.engine.setViewState({ activeTool: 'select' });
      return;
    }
    if (SHAPE_TOOLS.has(state.activeTool)) {
      const port = state.activeTool === 'arrow' && !event.ctrlKey && !event.metaKey ? findNearestConnectionPort(this.#records, world, this.engine.registry, { maximumDistance: 16 / state.viewport.zoom }) : null;
      this.#beginDraw(state.activeTool, port ? { x: port.x, y: port.y } : world, group, event.pointerId, screen, state.viewport, port ? { shapeId: port.shapeId, portId: port.id } : undefined);
    }
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    const liveState = this.engine.getViewState(); const screen = this.#screenPoint(event);
    if (event.pointerType === 'touch' && this.#touches.has(event.pointerId)) { this.#touches.set(event.pointerId, screen); if (this.#pinch) { this.#updatePinch(); return; } }
    const world = this.#snapPoint(this.#worldPoint(screen, liveState.viewport), liveState);
    this.#onPointerUpdate?.({ pointer: world, button: event.buttons === 1 ? 'left' : 'none' });
    if (this.#polylineId) this.#updatePolylinePreview(world);
    const interaction = this.#interaction;
    if (!interaction || interaction.pointerId !== event.pointerId) { this.#updateHover(world, liveState); return; }
    if (interaction.kind === 'pan') {
      this.engine.setViewState({ viewport: { ...interaction.viewport, x: interaction.viewport.x + screen.x - interaction.startScreen.x, y: interaction.viewport.y + screen.y - interaction.startScreen.y } }); return;
    }
    if (interaction.kind === 'drag') {
      let delta = { x: world.x - interaction.startWorld.x, y: world.y - interaction.startWorld.y };
      if (interaction.bounds && !event.metaKey && !event.ctrlKey) {
        const selectedIds = new Set(interaction.records.keys());
        const candidates = this.#records.filter((record) => !selectedIds.has(record.id) && !this.#hasSelectedAncestor(record, selectedIds)).map((record) => this.engine.registry.get(record.type).geometry.getBounds(record));
        const snapped = snapTranslation(interaction.bounds, delta, candidates, liveState.viewport.zoom); delta = snapped.delta; this.#snapLines = snapped.lines;
      } else this.#snapLines = [];
      const source = this.engine.getSnapshot().records; const sourceMap = new Map(source.map((record) => [record.id, record]));
      for (const [id, initialWorld] of interaction.records) {
        const record = sourceMap.get(id); if (!record) continue;
        const parentWorld = record.parentId === ROOT_PARENT_ID ? { x: 0, y: 0, rotation: 0 } : getWorldTransform(record.parentId, sourceMap);
        const local = toLocalTransform(parentWorld, { x: initialWorld.x + delta.x, y: initialWorld.y + delta.y, rotation: initialWorld.rotation });
        this.engine.dispatch({ type: 'shape.update', id, patch: { x: local.x, y: local.y } }, { undoGroup: interaction.group });
      }
      return;
    }
    if (interaction.kind === 'box-select') {
      this.#selectionBox = normalizedBox(interaction.startWorld, world); const found = [...new Set(this.#records.filter((record) => intersects(this.engine.registry.get(record.type).geometry.getBounds(record), this.#selectionBox!)).map((record) => this.#selectionTarget(record).id))];
      this.engine.setViewState({ selectedIds: interaction.additive ? [...new Set([...interaction.initialIds, ...found])] : found }); this.#scheduleRender(); return;
    }
    if (interaction.kind === 'resize') { this.#updateResize(interaction, world, event.shiftKey); return; }
    if (interaction.kind === 'connector-endpoint') { this.#updateConnectorEndpoint(interaction, world, event); return; }
    if (interaction.kind === 'erase') { this.#erasePath.push(world); const target = this.hitTest(world); if (target && !target.locked) interaction.ids.add(target.id); this.#scheduleRender(); return; }
    interaction.moved ||= Math.hypot(world.x - interaction.startWorld.x, world.y - interaction.startWorld.y) >= 2;
    this.#updateDrawing(interaction.drawingId, interaction.startWorld, world, interaction.group, event);
  };

  readonly #onPointerUp = (event: PointerEvent): void => {
    const liveState = this.engine.getViewState(); const screen = this.#screenPoint(event); const world = this.#snapPoint(this.#worldPoint(screen, liveState.viewport), liveState);
    this.#onPointerUpdate?.({ pointer: world, button: 'up' });
    if (event.pointerType === 'touch') { this.#touches.delete(event.pointerId); if (this.#pinch?.pointerIds.includes(event.pointerId)) this.#pinch = null; }
    const interaction = this.#interaction;
    if (interaction && interaction.pointerId === event.pointerId) {
      if (interaction.kind === 'draw') {
        interaction.moved ||= Math.hypot(world.x - interaction.startWorld.x, world.y - interaction.startWorld.y) >= 2;
        this.#updateDrawing(interaction.drawingId, interaction.startWorld, world, interaction.group, event);
        if (!interaction.moved && !['text', 'freehand'].includes(this.#sourceMap.get(interaction.drawingId)?.type ?? '')) {
          this.engine.dispatch({ type: 'shape.delete', ids: [interaction.drawingId], mode: 'only' }, { undoGroup: interaction.group }); this.engine.setViewState({ selectedIds: [] });
        } else {
          const type = this.engine.getSnapshot().records.find(({ id }) => id === interaction.drawingId)?.type;
          if (type === 'text') this.#onEditRecord?.(interaction.drawingId);
          if (type !== 'freehand') this.engine.setViewState({ activeTool: 'select' });
        }
      }
      if (interaction.kind === 'erase' && interaction.ids.size) this.engine.dispatch({ type: 'shape.delete', ids: [...interaction.ids], mode: 'only' }, { undoGroup: interaction.group });
      this.engine.completeUndoGroup(interaction.group);
      if (interaction.kind === 'drag' && interaction.records.size) this.#finishContainment([...interaction.records.keys()]);
      this.#interaction = null; this.#selectionBox = null; this.#snapLines = []; this.#erasePath = []; this.canvas.style.cursor = liveState.activeTool === 'hand' ? 'grab' : 'default'; this.#scheduleRender();
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  readonly #onPointerLeave = (event: PointerEvent): void => {
    if (event.buttons || this.#interaction) return; this.#hoveredPort = null; this.#hoveredRecordId = null; this.canvas.style.cursor = 'default'; this.#scheduleRender();
  };

  readonly #onWheel = (event: WheelEvent): void => {
    event.preventDefault(); const state = this.engine.getViewState();
    if (event.ctrlKey || event.metaKey) {
      const screen = this.#screenPoint(event); const world = this.#worldPoint(screen, state.viewport); const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.viewport.zoom * Math.exp(-event.deltaY * 0.002)));
      this.engine.setViewState({ viewport: { x: screen.x - world.x * zoom, y: screen.y - world.y * zoom, zoom } });
    } else if (event.shiftKey) this.engine.setViewState({ viewport: { ...state.viewport, x: state.viewport.x - (event.deltaX || event.deltaY) } });
    else this.engine.setViewState({ viewport: { ...state.viewport, x: state.viewport.x - event.deltaX, y: state.viewport.y - event.deltaY } });
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const state = this.engine.getViewState(); const modifier = event.metaKey || event.ctrlKey;
    if (event.key === ' ' && !event.repeat) {
      event.preventDefault(); this.#spacePressed = true; this.#toolBeforeSpace = state.activeTool; this.canvas.style.cursor = 'grab'; return;
    }
    if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (state.readonly) { this.#status.textContent = 'The canvas is read-only'; return; } if (event.shiftKey) this.engine.redo(); else this.engine.undo(); return; }
    if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); if (state.readonly) { this.#status.textContent = 'The canvas is read-only'; return; } this.engine.redo(); return; }
    if (modifier && event.key.toLowerCase() === 'a') { event.preventDefault(); this.engine.setViewState({ selectedIds: state.snapshot.records.filter(({ hidden }) => !hidden).map(({ id }) => id) }); return; }
    if (modifier && event.key.toLowerCase() === 'l' && state.selectedIds.length) {
      event.preventDefault(); if (state.readonly) { this.#announceReadonly(); return; }
      const selected = state.snapshot.records.filter(({ id }) => state.selectedIds.includes(id)); const locked = selected.some((record) => !record.locked);
      this.engine.dispatch({ type: 'batch', commands: selected.map(({ id }) => ({ type: 'shape.update', id, patch: { locked } })) }); this.#status.textContent = locked ? 'Selection locked' : 'Selection unlocked'; return;
    }
    if (modifier && event.key.toLowerCase() === 'g') {
      event.preventDefault(); if (state.readonly) { this.#announceReadonly(); return; }
      if (event.shiftKey) ungroupSelection(this.engine); else if (state.selectedIds.length >= 2) groupSelection(this.engine); return;
    }
    if (modifier && event.key === '0') { event.preventDefault(); this.engine.setViewState({ viewport: { x: 0, y: 0, zoom: 1 } }); return; }
    if (modifier && ['+', '=', '-'].includes(event.key)) { event.preventDefault(); this.#zoomAroundCenter(event.key === '-' ? 1 / 1.2 : 1.2); return; }
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedIds.length) {
      event.preventDefault(); if (state.readonly) { this.#announceReadonly(); return; }
      const selected = state.snapshot.records.filter((record) => state.selectedIds.includes(record.id) && !record.locked); const groups = selected.filter(({ type }) => type === 'group').map(({ id }) => id); const regular = selected.filter(({ type }) => type !== 'group').map(({ id }) => id); const commands: CanvasCommand[] = [];
      if (groups.length) commands.push({ type: 'shape.delete', ids: groups, mode: 'cascade' }); if (regular.length) commands.push({ type: 'shape.delete', ids: regular, mode: 'only' }); if (commands.length) this.engine.dispatch({ type: 'batch', commands }); return;
    }
    if (event.key === 'Escape') {
      event.preventDefault(); if (this.#polylineId) this.#finishPolyline(); else this.#cancelInteraction(); this.engine.setViewState({ selectedIds: [], activeTool: 'select' }); return;
    }
    if (event.key === 'Enter' && this.#polylineId) { event.preventDefault(); this.#finishPolyline(); return; }
    if (event.key === 'Tab') {
      event.preventDefault(); const records = this.#records.filter((record) => !this.#isEffectivelyHidden(record)); if (!records.length) return;
      const current = state.selectedIds.length === 1 ? records.findIndex(({ id }) => id === state.selectedIds[0]) : -1; const index = (current + (event.shiftKey ? -1 : 1) + records.length) % records.length; const record = records[index]!;
      this.engine.setViewState({ selectedIds: [record.id] }); this.#status.textContent = `${record.type} selected`; return;
    }
    if (!modifier && !event.altKey && state.selectedIds.length && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (state.readonly) { this.#status.textContent = 'The canvas is read-only'; return; }
      const distance = event.shiftKey ? 10 : 1;
      const delta = {
        x: event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0,
        y: event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0,
      };
      const selected = new Set(state.selectedIds);
      const recordMap = new Map(state.snapshot.records.map((record) => [record.id, record]));
      const records = state.snapshot.records.filter((record) => {
        if (!selected.has(record.id) || record.locked) return false;
        let parentId = record.parentId;
        while (parentId !== ROOT_PARENT_ID) {
          if (selected.has(parentId)) return false;
          parentId = recordMap.get(parentId)?.parentId ?? ROOT_PARENT_ID;
        }
        return true;
      });
      if (!records.length) { this.#status.textContent = 'Selected shapes are locked'; return; }
      const commands: CanvasCommand[] = records.map((record) => ({
        type: 'shape.update',
        id: record.id,
        patch: { x: record.x + delta.x, y: record.y + delta.y },
      }));
      this.engine.dispatch({ type: 'batch', commands });
      this.#status.textContent = `Moved ${records.length} ${records.length === 1 ? 'shape' : 'shapes'} ${distance} ${distance === 1 ? 'pixel' : 'pixels'}`;
      return;
    }
    const toolShortcuts = new Map<string, string>([['v', 'select'], ['h', 'hand'], ['x', 'eraser']]);
    this.engine.registry.list().forEach((definition) => { if (definition.tool?.shortcut) toolShortcuts.set(definition.tool.shortcut.toLowerCase(), definition.type); });
    const shortcut = toolShortcuts.get(event.key.toLowerCase()); if (!modifier && !event.altKey && shortcut) { event.preventDefault(); this.setTool(shortcut); }
  };

  readonly #onKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== ' ') return; event.preventDefault(); this.#spacePressed = false; this.canvas.style.cursor = this.#toolBeforeSpace === 'hand' ? 'grab' : 'default'; this.#toolBeforeSpace = null;
  };

  readonly #onDoubleClick = (event: MouseEvent): void => {
    if (this.#polylineId) { event.preventDefault(); this.#finishPolyline(); return; }
    const state = this.engine.getViewState(); const target = this.hitTest(this.#worldPoint(this.#screenPoint(event), state.viewport));
    if (state.readonly || !target || (!('text' in (target.props as Record<string, unknown>)) && !('label' in (target.props as Record<string, unknown>)) && target.type !== 'table' && !target.type.startsWith('db-'))) return;
    this.#onEditRecord?.(target.id);
  };

  #beginDraw(tool: string, world: Point, group: string, pointerId: number, screen: Point, viewport: CanvasViewState['viewport'], startBinding?: { shapeId: string; portId: string }): void {
    try {
      const definition = this.engine.registry.get(tool); const defaults = this.getToolStyle(tool);
      const frame = CONNECTOR_TOOLS.has(tool) ? undefined : [...this.#records].reverse().find((record) => record.type === 'frame' && this.engine.registry.get('frame').geometry.containsPoint(record, world));
      const parentId = frame?.id ?? ROOT_PARENT_ID; const siblings = this.engine.getSnapshot().records.filter((record) => record.parentId === parentId).sort((a, b) => compareFractionalIndex(a.index, b.index));
      const local = frame ? toLocalTransform(frame, { ...world, rotation: 0 }) : { ...world, rotation: 0 };
      const id = crypto.randomUUID(); const record: ShapeRecord = { id, type: tool, typeVersion: definition.version, parentId, index: generateKeyBetween(siblings.at(-1)?.index ?? null, null), x: local.x, y: local.y, rotation: 0, opacity: 1, locked: false, hidden: false, props: defaults };
      const commands: CanvasCommand[] = [{ type: 'shape.create', record }];
      if (CONNECTOR_TOOLS.has(tool)) commands.push({ type: 'binding.set', binding: { id: `binding-${id}`, connectorId: id, start: startBinding ?? null, end: null } });
      this.engine.dispatch({ type: 'batch', commands }, { undoGroup: group }); this.engine.setViewState({ selectedIds: [id] });
      this.#interaction = { kind: 'draw', pointerId, group, startScreen: screen, startWorld: world, viewport, drawingId: id, moved: false };
    } catch (error) {
      if (!(error instanceof CanvasReadonlyError)) throw error;
    }
  }

  #updateDrawing(id: string, start: Point, current: Point, group: string, event: Pick<PointerEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>): void {
    const record = this.engine.getSnapshot().records.find((candidate) => candidate.id === id); if (!record) return;
    if (record.type === 'freehand') {
      const props = record.props as { points: { x: number; y: number }[]; stroke: string; strokeWidth: number };
      this.engine.dispatch({ type: 'shape.update', id, patch: { props: { ...props, points: [...props.points, { x: current.x - record.x, y: current.y - record.y }] } } }, { undoGroup: group }); return;
    }
    if (record.type === 'line' || record.type === 'arrow') {
      const props = record.props as Record<string, unknown>; let end = current;
      let dx = end.x - start.x; let dy = end.y - start.y; if (event.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; end = { x: start.x + dx, y: start.y + dy }; }
      const port = event.ctrlKey || event.metaKey ? null : findNearestConnectionPort(this.#records, current, this.engine.registry, { excludeIds: new Set([id]), maximumDistance: 16 / this.engine.getViewState().viewport.zoom });
      if (port) end = { x: port.x, y: port.y };
      const binding = this.engine.getSnapshot().bindings.find(({ connectorId }) => connectorId === id) ?? { id: `binding-${id}`, connectorId: id, start: null, end: null };
      this.engine.dispatch({ type: 'batch', commands: [
        { type: 'shape.update', id, patch: { props: { ...props, points: [{ x: 0, y: 0 }, { x: end.x - start.x, y: end.y - start.y }] } } },
        { type: 'binding.set', binding: { ...binding, end: port ? { shapeId: port.shapeId, portId: port.id } : null } },
      ] }, { undoGroup: group }); this.#hoveredPort = port; this.#hoveredRecordId = port?.shapeId ?? null; return;
    }
    const props = record.props as Record<string, unknown>;
    const source = new Map(this.engine.getSnapshot().records.map((value) => [value.id, value]));
    const parentWorld = record.parentId === ROOT_PARENT_ID ? { x: 0, y: 0, rotation: 0 } : getWorldTransform(record.parentId, source);
    const local = toLocalTransform(parentWorld, { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), rotation: 0 });
    let width = Math.max(8, Math.abs(current.x - start.x)); let height = Math.max(8, Math.abs(current.y - start.y));
    if (event.shiftKey) { const size = Math.max(width, height); width = size; height = size; }
    this.engine.dispatch({ type: 'shape.update', id, patch: { x: local.x, y: local.y, props: { ...props, width, height } } }, { undoGroup: group });
  }

  #isResizable(record: ShapeRecord): boolean {
    const props = record.props as Record<string, unknown>; return typeof props.width === 'number' && Number.isFinite(props.width) && typeof props.height === 'number' && Number.isFinite(props.height) && record.type !== 'group';
  }

  #hasSelectedAncestor(record: ShapeRecord, selected: ReadonlySet<string>): boolean {
    let parentId = record.parentId;
    while (parentId !== ROOT_PARENT_ID) { if (selected.has(parentId)) return true; parentId = this.#sourceMap.get(parentId)?.parentId ?? ROOT_PARENT_ID; }
    return false;
  }

  #selectionTarget(record: ShapeRecord): ShapeRecord {
    let current = record; let parent = current.parentId === ROOT_PARENT_ID ? undefined : this.#recordMap.get(current.parentId);
    while (parent) { if (parent.type === 'group') current = parent; parent = parent.parentId === ROOT_PARENT_ID ? undefined : this.#recordMap.get(parent.parentId); }
    return current;
  }

  #snapPoint(point: Point, state: CanvasViewState): Point {
    if (!state.snapshot.document.grid.enabled) return point; const size = state.snapshot.document.grid.size;
    return { x: Math.round(point.x / size) * size, y: Math.round(point.y / size) * size };
  }

  #updateHover(world: Point, state: CanvasViewState): void {
    const selected = state.selectedIds.length === 1 ? this.#recordMap.get(state.selectedIds[0]!) : undefined;
    if (state.activeTool === 'hand' || this.#spacePressed) { this.canvas.style.cursor = 'grab'; return; }
    if (state.activeTool === 'eraser' || SHAPE_TOOLS.has(state.activeTool) && state.activeTool !== 'line') this.canvas.style.cursor = 'crosshair';
    else if (state.activeTool === 'select' && selected) {
      const endpoint = connectorEndpointAtPoint(selected, world, state.viewport.zoom); if (endpoint) this.canvas.style.cursor = 'crosshair';
      else if (this.#isResizable(selected)) {
        const handle = resizeHandleAtPoint(this.engine.registry.get(selected.type).geometry.getBounds(selected), world, state.viewport.zoom); this.canvas.style.cursor = handle ? cursorForResizeHandle(handle) : this.hitTest(world) ? 'move' : 'default';
      } else this.canvas.style.cursor = this.hitTest(world) ? 'move' : 'default';
    } else this.canvas.style.cursor = this.hitTest(world) ? 'move' : 'default';
    if (CONNECTOR_TOOLS.has(state.activeTool)) {
      this.#hoveredPort = findNearestConnectionPort(this.#records, world, this.engine.registry, { maximumDistance: 16 / state.viewport.zoom });
      this.#hoveredRecordId = this.#hoveredPort?.shapeId ?? this.hitTest(world)?.id ?? null;
    } else if (!(state.activeTool === 'select' && selected)) { this.#hoveredPort = null; this.#hoveredRecordId = null; }
    this.#scheduleRender();
  }

  #beginPinch(): void {
    const entries = [...this.#touches.entries()]; if (entries.length !== 2) return;
    if (this.#interaction) { this.engine.completeUndoGroup(this.#interaction.group); this.#interaction = null; }
    const [[firstId, first], [secondId, second]] = entries as [[number, Point], [number, Point]];
    const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }; const viewport = this.engine.getViewState().viewport;
    this.#pinch = { pointerIds: [firstId, secondId], distance: Math.hypot(second.x - first.x, second.y - first.y), midpoint, viewport, worldMidpoint: this.#worldPoint(midpoint, viewport) };
  }

  #updatePinch(): void {
    const pinch = this.#pinch; if (!pinch) return; const first = this.#touches.get(pinch.pointerIds[0]); const second = this.#touches.get(pinch.pointerIds[1]); if (!first || !second) return;
    const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }; const distance = Math.hypot(second.x - first.x, second.y - first.y);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.viewport.zoom * distance / Math.max(1, pinch.distance)));
    this.engine.setViewState({ viewport: { x: midpoint.x - pinch.worldMidpoint.x * zoom, y: midpoint.y - pinch.worldMidpoint.y * zoom, zoom } });
  }

  #updateResize(interaction: ResizeInteraction, world: Point, keepAspect: boolean): void {
    const initial = interaction.record; const props = initial.props as Record<string, unknown> & { width: number; height: number };
    const dx = world.x - initial.x; const dy = world.y - initial.y; const cosine = Math.cos(-initial.rotation); const sine = Math.sin(-initial.rotation); const localPointer = { x: dx * cosine - dy * sine, y: dx * sine + dy * cosine };
    let left = 0; let top = 0; let right = props.width; let bottom = props.height;
    if (interaction.handle.includes('w')) left = Math.min(localPointer.x, right - 8); if (interaction.handle.includes('e')) right = Math.max(localPointer.x, left + 8);
    if (interaction.handle.includes('n')) top = Math.min(localPointer.y, bottom - 8); if (interaction.handle.includes('s')) bottom = Math.max(localPointer.y, top + 8);
    if (keepAspect && interaction.handle.length === 2) {
      const ratio = props.width / props.height; const width = right - left; const height = bottom - top;
      if (width / height > ratio) { const nextHeight = width / ratio; if (interaction.handle.includes('n')) top = bottom - nextHeight; else bottom = top + nextHeight; }
      else { const nextWidth = height * ratio; if (interaction.handle.includes('w')) left = right - nextWidth; else right = left + nextWidth; }
    }
    const originOffset = { x: left * Math.cos(initial.rotation) - top * Math.sin(initial.rotation), y: left * Math.sin(initial.rotation) + top * Math.cos(initial.rotation) };
    const sourceMap = new Map(this.engine.getSnapshot().records.map((record) => [record.id, record])); const source = sourceMap.get(initial.id); if (!source) return;
    const parentWorld = source.parentId === ROOT_PARENT_ID ? { x: 0, y: 0, rotation: 0 } : getWorldTransform(source.parentId, sourceMap); const local = toLocalTransform(parentWorld, { x: initial.x + originOffset.x, y: initial.y + originOffset.y, rotation: initial.rotation });
    this.engine.dispatch({ type: 'shape.update', id: initial.id, patch: { x: local.x, y: local.y, props: { ...props, width: right - left, height: bottom - top } } }, { undoGroup: interaction.group });
  }

  #updateConnectorEndpoint(interaction: ConnectorEndpointInteraction, world: Point, event: Pick<PointerEvent, 'ctrlKey' | 'metaKey'>): void {
    const sourceMap = new Map(this.engine.getSnapshot().records.map((record) => [record.id, record])); const source = sourceMap.get(interaction.record.id); if (!source) return;
    const port = event.ctrlKey || event.metaKey ? null : findNearestConnectionPort(this.#records, world, this.engine.registry, { excludeIds: new Set([source.id]), maximumDistance: 16 / this.engine.getViewState().viewport.zoom });
    const endpoint = port ? { x: port.x, y: port.y } : world; const rendered = this.#recordMap.get(source.id) ?? interaction.record; const renderedPoints = (rendered.props as { points: Point[] }).points; const sourcePoints = (source.props as { points: Point[] }).points;
    const worldPoints = sourcePoints.length === 2 ? [{ x: rendered.x + renderedPoints[0]!.x, y: rendered.y + renderedPoints[0]!.y }, { x: rendered.x + renderedPoints.at(-1)!.x, y: rendered.y + renderedPoints.at(-1)!.y }] : sourcePoints.map((point) => ({ x: source.x + point.x, y: source.y + point.y }));
    if (interaction.endpoint === 'start') worldPoints[0] = endpoint; else worldPoints[worldPoints.length - 1] = endpoint;
    const parentWorld = source.parentId === ROOT_PARENT_ID ? { x: 0, y: 0, rotation: 0 } : getWorldTransform(source.parentId, sourceMap); const localPoints = worldPoints.map((point) => toLocalTransform(parentWorld, { ...point, rotation: 0 })); const origin = localPoints[0]!;
    const props = source.props as Record<string, unknown>; const binding = this.engine.getSnapshot().bindings.find(({ connectorId }) => connectorId === source.id) ?? { id: `binding-${source.id}`, connectorId: source.id, start: null, end: null };
    this.engine.dispatch({ type: 'batch', commands: [
      { type: 'shape.update', id: source.id, patch: { x: origin.x, y: origin.y, rotation: 0, props: { ...props, points: localPoints.map((point) => ({ x: point.x - origin.x, y: point.y - origin.y })) } } },
      { type: 'binding.set', binding: { ...binding, [interaction.endpoint]: port ? { shapeId: port.shapeId, portId: port.id } : null } },
    ] }, { undoGroup: interaction.group }); this.#hoveredPort = port; this.#hoveredRecordId = port?.shapeId ?? null;
  }

  #polylinePointerDown(world: Point): void {
    if (!this.#polylineId) {
      const group = `polyline-${crypto.randomUUID()}`; const port = findNearestConnectionPort(this.#records, world, this.engine.registry, { maximumDistance: 16 / this.engine.getViewState().viewport.zoom }); const start = port ? { x: port.x, y: port.y } : world;
      const definition = this.engine.registry.get('line'); const siblings = this.engine.getSnapshot().records.filter(({ parentId }) => parentId === ROOT_PARENT_ID).sort((a, b) => compareFractionalIndex(a.index, b.index)); const id = crypto.randomUUID();
      const record: ShapeRecord = { id, type: 'line', typeVersion: definition.version, parentId: ROOT_PARENT_ID, index: generateKeyBetween(siblings.at(-1)?.index ?? null, null), x: start.x, y: start.y, rotation: 0, opacity: 1, locked: false, hidden: false, props: { ...this.getToolStyle('line'), points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] } };
      this.engine.dispatch({ type: 'batch', commands: [{ type: 'shape.create', record }, { type: 'binding.set', binding: { id: `binding-${id}`, connectorId: id, start: port ? { shapeId: port.shapeId, portId: port.id } : null, end: null } }] }, { undoGroup: group });
      this.#polylineId = id; this.#polylineGroup = group; this.engine.setViewState({ selectedIds: [id] }); return;
    }
    const record = this.engine.getSnapshot().records.find(({ id }) => id === this.#polylineId); if (!record || !this.#polylineGroup) return; const props = record.props as Record<string, unknown> & { points: Point[] }; const point = { x: world.x - record.x, y: world.y - record.y };
    this.engine.dispatch({ type: 'shape.update', id: record.id, patch: { props: { ...props, points: [...props.points.slice(0, -1), point, point] } } }, { undoGroup: this.#polylineGroup });
  }

  #updatePolylinePreview(world: Point): void {
    if (!this.#polylineId || !this.#polylineGroup) return; const record = this.engine.getSnapshot().records.find(({ id }) => id === this.#polylineId); if (!record) return; const props = record.props as Record<string, unknown> & { points: Point[] }; const point = { x: world.x - record.x, y: world.y - record.y };
    this.engine.dispatch({ type: 'shape.update', id: record.id, patch: { props: { ...props, points: [...props.points.slice(0, -1), point] } } }, { undoGroup: this.#polylineGroup });
  }

  #finishPolyline(): void {
    const id = this.#polylineId; const group = this.#polylineGroup; if (!id || !group) return; const record = this.engine.getSnapshot().records.find((candidate) => candidate.id === id);
    if (record) {
      const props = record.props as Record<string, unknown> & { points: Point[] }; const points = props.points.slice(0, -1);
      if (points.length < 2) this.engine.dispatch({ type: 'shape.delete', ids: [id], mode: 'only' }, { undoGroup: group });
      else {
        const endPoint = { x: record.x + points.at(-1)!.x, y: record.y + points.at(-1)!.y }; const port = findNearestConnectionPort(this.#records, endPoint, this.engine.registry, { excludeIds: new Set([id]), maximumDistance: 16 / this.engine.getViewState().viewport.zoom }); const binding = this.engine.getSnapshot().bindings.find(({ connectorId }) => connectorId === id)!;
        if (port) points[points.length - 1] = { x: port.x - record.x, y: port.y - record.y };
        this.engine.dispatch({ type: 'batch', commands: [{ type: 'shape.update', id, patch: { props: { ...props, points } } }, { type: 'binding.set', binding: { ...binding, end: port ? { shapeId: port.shapeId, portId: port.id } : null } }] }, { undoGroup: group });
      }
    }
    this.engine.completeUndoGroup(group); this.#polylineId = null; this.#polylineGroup = null; this.engine.setViewState({ activeTool: 'select' }); this.#hoveredPort = null; this.#hoveredRecordId = null;
  }

  #cancelInteraction(): void {
    const interaction = this.#interaction; if (!interaction) return;
    if (interaction.kind === 'draw') this.engine.dispatch({ type: 'shape.delete', ids: [interaction.drawingId], mode: 'only' }, { undoGroup: interaction.group });
    else if (!['pan', 'box-select', 'erase'].includes(interaction.kind)) { this.engine.completeUndoGroup(interaction.group); this.engine.undo(); }
    this.engine.completeUndoGroup(interaction.group); this.#interaction = null; this.#selectionBox = null; this.#snapLines = []; this.#scheduleRender();
  }

  #zoomAroundCenter(factor: number): void {
    const state = this.engine.getViewState(); const rect = this.canvas.getBoundingClientRect(); const screen = { x: rect.width / 2, y: rect.height / 2 }; const world = this.#worldPoint(screen, state.viewport); const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.viewport.zoom * factor));
    this.engine.setViewState({ viewport: { x: screen.x - world.x * zoom, y: screen.y - world.y * zoom, zoom } });
  }

  #announceReadonly(): void { this.#status.textContent = 'The canvas is read-only'; }

  #finishContainment(ids: string[]): void {
    const snapshot = this.engine.getSnapshot(); const source = new Map(snapshot.records.map((record) => [record.id, record]));
    const first = source.get(ids[0]!); if (!first) return; const world = getWorldTransform(first.id, source); const bounds = this.engine.registry.get(first.type).geometry.getBounds({ ...first, ...world });
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const candidates = [...this.#records].reverse().filter((record) => record.type === 'frame' && !ids.includes(record.id) && this.engine.registry.get('frame').geometry.containsPoint(record, center));
    const parentId = candidates[0]?.id ?? ROOT_PARENT_ID;
    if (ids.some((id) => source.get(id)?.parentId !== parentId)) this.engine.dispatch({ type: 'shape.reparent', ids, parentId });
  }

  #screenPoint(event: MouseEvent | PointerEvent | WheelEvent): { x: number; y: number } { const rect = this.canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  #worldPoint(screen: { x: number; y: number }, viewport: CanvasViewState['viewport']): { x: number; y: number } { return { x: (screen.x - viewport.x) / viewport.zoom, y: (screen.y - viewport.y) / viewport.zoom }; }
}

export function mountCanvas(options: MountCanvasOptions): CanvasView { return new DomCanvasView(options); }
