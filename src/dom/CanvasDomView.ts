import { generateKeyBetween } from 'fractional-indexing';
import type { CanvasEngine, CanvasViewState } from '../core/CanvasEngine.js';
import { resolveBindingGeometry } from '../core/bindings.js';
import type { CanvasCommand } from '../core/commands.js';
import { CanvasReadonlyError, compareFractionalIndex, ROOT_PARENT_ID, type ShapeRecord } from '../core/model.js';
import type { ShapeDefinition } from '../core/registry.js';
import { getWorldTransform, toLocalTransform } from '../core/transforms.js';
import { SpatialHashIndex } from './SpatialHashIndex.js';

const SHAPE_TOOLS = new Set(['rectangle', 'ellipse', 'diamond', 'triangle', 'sticky-note', 'frame', 'text', 'line', 'arrow', 'freehand']);

export interface MountCanvasOptions {
  root: HTMLElement;
  engine: CanvasEngine;
  resolveAssetUrl?: (assetId: string) => string | Promise<string>;
  locale?: 'en' | 'tr';
  toolbar?: boolean;
  onEditRecord?: (recordId: string) => void;
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
  focusRecord(id: string): void;
  hitTest(point: { x: number; y: number }): ShapeRecord | null;
  getPerformanceMetrics(): CanvasPerformanceMetrics;
  destroy(): void;
}

interface PointerInteraction {
  kind: 'pan' | 'drag' | 'draw';
  pointerId: number;
  group: string;
  startScreen: { x: number; y: number };
  startWorld: { x: number; y: number };
  viewport: CanvasViewState['viewport'];
  records: Map<string, ShapeRecord>;
  drawingId?: string;
}

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
    if (tool !== 'select' && tool !== 'hand' && !SHAPE_TOOLS.has(tool)) throw new Error(`Unknown canvas tool '${tool}'`);
    this.engine.setViewState({ activeTool: tool }); this.canvas.focus();
  }

  focusRecord(id: string): void {
    const record = this.#recordMap.get(id); if (!record) throw new Error(`Shape '${id}' does not exist`);
    const definition = this.engine.registry.get(record.type); const bounds = definition.geometry.getBounds(record);
    const rect = this.canvas.getBoundingClientRect();
    const zoom = Math.min(2, Math.max(0.1, Math.min(rect.width / Math.max(bounds.width + 120, 1), rect.height / Math.max(bounds.height + 120, 1))));
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
    if (this.#renderFrame !== null) cancelAnimationFrame(this.#renderFrame);
    this.canvas.remove(); this.#toolbar.remove(); this.#status.remove(); this.#root.classList.remove('tahta-root');
  }

  #bindEvents(): void {
    const options = { signal: this.#abort.signal };
    this.canvas.addEventListener('pointerdown', this.#onPointerDown, options);
    this.canvas.addEventListener('pointermove', this.#onPointerMove, options);
    this.canvas.addEventListener('pointerup', this.#onPointerUp, options);
    this.canvas.addEventListener('pointercancel', this.#onPointerUp, options);
    this.canvas.addEventListener('wheel', this.#onWheel, { ...options, passive: false });
    this.canvas.addEventListener('keydown', this.#onKeyDown, options);
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
    this.#renderGrid(context, state, rect); context.save(); context.translate(state.viewport.x, state.viewport.y); context.scale(state.viewport.zoom, state.viewport.zoom);
    const visibleIds = this.#index.query({ x: -state.viewport.x / state.viewport.zoom, y: -state.viewport.y / state.viewport.zoom, width: rect.width / state.viewport.zoom, height: rect.height / state.viewport.zoom });
    let rendered = 0;
    const visibleRecords = [...visibleIds]
      .map((id) => this.#recordMap.get(id))
      .filter((record): record is WorldRecord => record !== undefined && !this.#isEffectivelyHidden(record))
      .sort((left, right) => (this.#order.get(left.id) ?? 0) - (this.#order.get(right.id) ?? 0));
    for (const record of visibleRecords) {
      const definition = this.engine.registry.get(record.type);
      definition.render({ context, record, selected: state.selectedIds.includes(record.id), theme: state.theme, getImage: (assetId) => this.#imageCache.get(assetId) });
      if (state.selectedIds.includes(record.id)) this.#renderSelection(context, definition, record, state.viewport.zoom);
      rendered++;
    }
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

  #renderSelection(context: CanvasRenderingContext2D, definition: ShapeDefinition, record: ShapeRecord, zoom: number): void {
    const bounds = definition.geometry.getBounds(record); context.save(); context.strokeStyle = '#6366f1'; context.lineWidth = 1.5 / zoom; context.setLineDash([6 / zoom, 4 / zoom]); context.strokeRect(bounds.x - 4 / zoom, bounds.y - 4 / zoom, bounds.width + 8 / zoom, bounds.height + 8 / zoom); context.restore();
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
    if (event.button !== 0 && event.button !== 1) return; this.canvas.setPointerCapture(event.pointerId); this.canvas.focus();
    const state = this.engine.getViewState(); const screen = this.#screenPoint(event); const world = this.#worldPoint(screen, state.viewport); const group = `pointer-${event.pointerId}-${crypto.randomUUID()}`;
    if (state.activeTool === 'hand' || event.button === 1 || event.altKey) {
      this.#interaction = { kind: 'pan', pointerId: event.pointerId, group, startScreen: screen, startWorld: world, viewport: state.viewport, records: new Map() }; return;
    }
    if (state.activeTool === 'select') {
      const target = this.hitTest(world); const selectedIds = target ? (event.shiftKey ? [...new Set([...state.selectedIds, target.id])] : [target.id]) : [];
      this.engine.setViewState({ selectedIds });
      if (state.readonly) { this.#interaction = null; return; }
      const records = new Map(selectedIds.map((id): [string, WorldRecord | undefined] => [id, this.#recordMap.get(id)]).filter((entry): entry is [string, WorldRecord] => entry[1] !== undefined && !entry[1].locked));
      this.#interaction = { kind: 'drag', pointerId: event.pointerId, group, startScreen: screen, startWorld: world, viewport: state.viewport, records }; return;
    }
    if (SHAPE_TOOLS.has(state.activeTool)) this.#beginDraw(state.activeTool, world, group, event.pointerId, screen, state.viewport);
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    const liveState = this.engine.getViewState();
    this.#onPointerUpdate?.({ pointer: this.#worldPoint(this.#screenPoint(event), liveState.viewport), button: event.buttons === 1 ? 'left' : 'none' });
    const interaction = this.#interaction; if (!interaction || interaction.pointerId !== event.pointerId) return;
    const screen = this.#screenPoint(event); const world = this.#worldPoint(screen, this.engine.getViewState().viewport);
    if (interaction.kind === 'pan') {
      this.engine.setViewState({ viewport: { ...interaction.viewport, x: interaction.viewport.x + screen.x - interaction.startScreen.x, y: interaction.viewport.y + screen.y - interaction.startScreen.y } }); return;
    }
    if (interaction.kind === 'drag') {
      for (const [id, initialWorld] of interaction.records) {
        const source = this.engine.getSnapshot().records; const sourceMap = new Map(source.map((record) => [record.id, record])); const record = sourceMap.get(id); if (!record) continue;
        const parentWorld = record.parentId === ROOT_PARENT_ID ? { x: 0, y: 0, rotation: 0 } : getWorldTransform(record.parentId, sourceMap);
        const local = toLocalTransform(parentWorld, { x: initialWorld.x + world.x - interaction.startWorld.x, y: initialWorld.y + world.y - interaction.startWorld.y, rotation: initialWorld.rotation });
        this.engine.dispatch({ type: 'shape.update', id, patch: { x: local.x, y: local.y } }, { undoGroup: interaction.group });
      }
      return;
    }
    if (interaction.drawingId) this.#updateDrawing(interaction.drawingId, interaction.startWorld, world, interaction.group);
  };

  readonly #onPointerUp = (event: PointerEvent): void => {
    const liveState = this.engine.getViewState();
    this.#onPointerUpdate?.({ pointer: this.#worldPoint(this.#screenPoint(event), liveState.viewport), button: 'up' });
    const interaction = this.#interaction; if (!interaction || interaction.pointerId !== event.pointerId) return;
    this.engine.completeUndoGroup(interaction.group);
    if (interaction.kind === 'drag' && interaction.records.size) this.#finishContainment([...interaction.records.keys()]);
    this.#interaction = null; if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  readonly #onWheel = (event: WheelEvent): void => {
    event.preventDefault(); const state = this.engine.getViewState();
    if (event.ctrlKey || event.metaKey) {
      const screen = this.#screenPoint(event); const world = this.#worldPoint(screen, state.viewport); const zoom = Math.min(8, Math.max(0.1, state.viewport.zoom * Math.exp(-event.deltaY * 0.002)));
      this.engine.setViewState({ viewport: { x: screen.x - world.x * zoom, y: screen.y - world.y * zoom, zoom } });
    } else this.engine.setViewState({ viewport: { ...state.viewport, x: state.viewport.x - event.deltaX, y: state.viewport.y - event.deltaY } });
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const state = this.engine.getViewState(); const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (state.readonly) { this.#status.textContent = 'The canvas is read-only'; return; } if (event.shiftKey) this.engine.redo(); else this.engine.undo(); return; }
    if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); if (state.readonly) { this.#status.textContent = 'The canvas is read-only'; return; } this.engine.redo(); return; }
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedIds.length) { event.preventDefault(); if (state.readonly) { this.#status.textContent = 'The canvas is read-only'; return; } this.engine.dispatch({ type: 'shape.delete', ids: [...state.selectedIds], mode: 'only' }); return; }
    if (event.key === 'Escape') { this.engine.setViewState({ selectedIds: [], activeTool: 'select' }); return; }
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
    const toolShortcuts: Record<string, string> = { v: 'select', h: 'hand', r: 'rectangle', o: 'ellipse', d: 'diamond', s: 'sticky-note', f: 'frame', t: 'text', a: 'arrow', p: 'freehand' };
    if (!modifier && !event.altKey && toolShortcuts[event.key.toLowerCase()]) this.setTool(toolShortcuts[event.key.toLowerCase()]!);
  };

  readonly #onDoubleClick = (event: MouseEvent): void => {
    const state = this.engine.getViewState(); const target = this.hitTest(this.#worldPoint(this.#screenPoint(event), state.viewport));
    if (state.readonly || !target || (!('text' in (target.props as Record<string, unknown>)) && !('label' in (target.props as Record<string, unknown>)))) return;
    this.#onEditRecord?.(target.id);
  };

  #beginDraw(tool: string, world: { x: number; y: number }, group: string, pointerId: number, screen: { x: number; y: number }, viewport: CanvasViewState['viewport']): void {
    try {
      const definition = this.engine.registry.get(tool); const defaults = definition.defaults();
      const frame = [...this.#records].reverse().find((record) => record.type === 'frame' && this.engine.registry.get('frame').geometry.containsPoint(record, world));
      const parentId = frame?.id ?? ROOT_PARENT_ID; const siblings = this.engine.getSnapshot().records.filter((record) => record.parentId === parentId).sort((a, b) => compareFractionalIndex(a.index, b.index));
      const local = frame ? toLocalTransform(frame, { ...world, rotation: 0 }) : { ...world, rotation: 0 };
      const id = crypto.randomUUID(); const record: ShapeRecord = { id, type: tool, typeVersion: definition.version, parentId, index: generateKeyBetween(siblings.at(-1)?.index ?? null, null), x: local.x, y: local.y, rotation: 0, opacity: 1, locked: false, hidden: false, props: defaults };
      this.engine.dispatch({ type: 'shape.create', record }, { undoGroup: group }); this.engine.setViewState({ selectedIds: [id] });
      this.#interaction = { kind: 'draw', pointerId, group, startScreen: screen, startWorld: world, viewport, records: new Map(), drawingId: id };
    } catch (error) {
      if (!(error instanceof CanvasReadonlyError)) throw error;
    }
  }

  #updateDrawing(id: string, start: { x: number; y: number }, current: { x: number; y: number }, group: string): void {
    const record = this.engine.getSnapshot().records.find((candidate) => candidate.id === id); if (!record) return;
    if (record.type === 'freehand') {
      const props = record.props as { points: { x: number; y: number }[]; stroke: string; strokeWidth: number };
      this.engine.dispatch({ type: 'shape.update', id, patch: { props: { ...props, points: [...props.points, { x: current.x - record.x, y: current.y - record.y }] } } }, { undoGroup: group }); return;
    }
    if (record.type === 'line' || record.type === 'arrow') {
      const props = record.props as Record<string, unknown>;
      this.engine.dispatch({ type: 'shape.update', id, patch: { props: { ...props, points: [{ x: 0, y: 0 }, { x: current.x - start.x, y: current.y - start.y }] } } }, { undoGroup: group }); return;
    }
    const props = record.props as Record<string, unknown>;
    const source = new Map(this.engine.getSnapshot().records.map((value) => [value.id, value]));
    const parentWorld = record.parentId === ROOT_PARENT_ID ? { x: 0, y: 0, rotation: 0 } : getWorldTransform(record.parentId, source);
    const local = toLocalTransform(parentWorld, { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), rotation: 0 });
    this.engine.dispatch({ type: 'shape.update', id, patch: { x: local.x, y: local.y, props: { ...props, width: Math.max(8, Math.abs(current.x - start.x)), height: Math.max(8, Math.abs(current.y - start.y)) } } }, { undoGroup: group });
  }

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
