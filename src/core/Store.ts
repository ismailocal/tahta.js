import { generateKeyBetween } from 'fractional-indexing';
import { EventBus } from '../canvas/EventBus.js';
import { createShapeSpatialIndex, ShapeSpatialIndex } from '../geometry/SpatialIndex.js';
import { getArrowClippedEndpoints } from '../geometry/lineUtils.js';
import { cacheStyle, STYLE_PROPERTY_KEYS } from './constants.js';
import type { CanvasCommand } from './commands.js';
import { CanvasValidationError, ROOT_PARENT_ID } from './model.js';
import type { CanvasEngine, CanvasViewState } from './CanvasEngine.js';
import {
  shapePatchToRecordPatch,
  commandsForShapeReplacement,
  shapeToBindingRecord,
  shapeToRecord,
} from './projection.js';
import { CanvasShapeProjection } from './CanvasShapeProjection.js';
import type { CanvasState, Shape } from './types.js';
import type { ShapeRegistry } from './registry.js';

const VARIANT_CACHE_KEYS: Record<string, (shape: Shape) => string | null> = {
  arrow: () => null,
};

const DEFAULT_STATE: CanvasState = {
  shapes: [],
  selectedIds: [],
  activeTool: 'select',
  viewport: { x: 0, y: 0, zoom: 1 },
  hoveredShapeId: null,
  drawingShapeId: null,
  isDraggingSelection: false,
  resizingShapeId: null,
  frameDropTargetId: null,
  laserTrail: [],
  isPanning: false,
  isSpacePanning: false,
  showGrid: false,
  gridSize: 20,
  editingShapeId: null,
  theme: 'light',
  version: 0,
};

/**
 * DOM araçlarının mevcut sözleşmesini Yjs motoruna yansıtan instance-scope adaptör.
 * Belge verisi bu sınıfta tutulmaz; her shape okuması engine snapshot'ından üretilir.
 */
export class WhiteboardStore {
  readonly bus: EventBus;
  readonly engine: CanvasEngine;
  readonly registry: ShapeRegistry;
  private readonly subscribers = new Set<(state: CanvasState) => void>();
  private readonly unsubscribeEngine: () => void;
  private readonly projection: CanvasShapeProjection;
  private state: CanvasState;
  private spatialIndex: ShapeSpatialIndex | null = null;
  private indexedShapes: Shape[] | null = null;
  private version = 0;
  private uiRevision = 0;
  private activeUndoGroup: string | null = null;
  private batchDepth = 0;
  private queuedCommands: CanvasCommand[] = [];

  constructor(
    engine: CanvasEngine,
    initialState: Partial<CanvasState> = {},
    bus = new EventBus(),
    registry = engine.registry,
  ) {
    this.bus = bus;
    this.engine = engine;
    this.registry = registry;
    this.projection = new CanvasShapeProjection(registry);
    if (initialState.viewport || initialState.theme || initialState.activeTool) {
      this.engine.setViewState({
        ...(initialState.viewport ? { viewport: initialState.viewport } : {}),
        ...(initialState.theme ? { theme: initialState.theme } : {}),
        ...(initialState.activeTool ? { activeTool: initialState.activeTool } : {}),
      });
    }
    this.state = this.project(initialState);
    this.unsubscribeEngine = this.engine.subscribe((view) => view, () => {
      this.state = this.project();
      this.notify();
    });
  }

  getState(): CanvasState { return this.state; }
  get canUndo(): boolean { return this.engine.canUndo(); }
  get canRedo(): boolean { return this.engine.canRedo(); }

  commitState(): void {
    if (!this.activeUndoGroup) return;
    this.engine.completeUndoGroup(this.activeUndoGroup);
    this.activeUndoGroup = null;
  }

  beginUndoGroup(group: string): void {
    if (this.activeUndoGroup && this.activeUndoGroup !== group) this.commitState();
    this.activeUndoGroup = group;
  }

  endUndoGroup(group: string): void {
    if (this.activeUndoGroup !== group) return;
    this.commitState();
  }

  undo(): void {
    this.commitState();
    this.engine.undo();
    this.engine.setViewState({ selectedIds: [] });
  }

  redo(): void {
    this.commitState();
    this.engine.redo();
    this.engine.setViewState({ selectedIds: [] });
  }

  reorderShape(shapeId: string, direction: 'forward' | 'backward' | 'front' | 'back'): void {
    const shapes = this.state.shapes;
    const position = shapes.findIndex(({ id }) => id === shapeId);
    if (position < 0) return;
    let beforeId: string | undefined;
    if (direction === 'backward') beforeId = shapes[position - 1]?.id;
    if (direction === 'back') beforeId = shapes[0]?.id;
    if (direction === 'forward') beforeId = shapes[position + 2]?.id;
    this.execute({ type: 'shape.reorder', id: shapeId, ...(beforeId ? { beforeId } : {}) });
  }

  subscribe(listener: (state: CanvasState) => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  batchUpdate(fn: () => void): void {
    const queueStart = this.queuedCommands.length;
    let completed = false;
    this.batchDepth += 1;
    try {
      fn();
      completed = true;
    } finally {
      this.batchDepth -= 1;
      if (!completed) this.queuedCommands.splice(queueStart);
      if (this.batchDepth === 0 && this.queuedCommands.length > 0) {
        const commands = this.queuedCommands;
        this.queuedCommands = [];
        if (completed) this.dispatch({ type: 'batch', commands });
      }
    }
  }

  getSpatialIndex(): ShapeSpatialIndex {
    if (this.spatialIndex) return this.spatialIndex;
    this.spatialIndex = createShapeSpatialIndex(this.state.shapes, this.registry);
    this.indexedShapes = this.state.shapes;
    return this.spatialIndex;
  }

  setState(updater: Partial<CanvasState> | ((state: CanvasState) => CanvasState)): void {
    const current = this.state;
    const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    const documentChanged = next.shapes !== current.shapes;
    if (documentChanged) {
      const commands = this.commandsForShapes(next.shapes);
      if (commands.length > 0) this.execute(commands.length === 1 ? commands[0] : { type: 'batch', commands });
    }
    if (next.canvasBackground !== current.canvasBackground || next.showGrid !== current.showGrid || next.gridSize !== current.gridSize) {
      this.dispatch({
        type: 'document.update',
        patch: {
          background: next.canvasBackground ?? this.engine.getSnapshot().document.background,
          grid: {
            enabled: next.showGrid ?? this.engine.getSnapshot().document.grid.enabled,
            size: next.gridSize ?? this.engine.getSnapshot().document.grid.size,
          },
        },
      });
    }
    const viewPatch = this.toViewPatch(current, next);
    if (Object.keys(viewPatch).length > 0) this.engine.setViewState(viewPatch);
  }

  setTool(tool: string, keepSelection = false): void {
    this.engine.setViewState({ activeTool: tool, selectedIds: keepSelection ? this.state.selectedIds : [] });
    this.bus.emit('tool:changed', { tool });
  }

  setViewport(viewport: CanvasState['viewport']): void {
    this.engine.setViewState({ viewport });
    this.bus.emit('viewport:changed', { viewport });
  }

  addShape(shape: Shape): void {
    const records = this.engine.getSnapshot().records;
    const index = generateKeyBetween(records.at(-1)?.index ?? null, null);
    const record = shapeToRecord(shape, index, this.registry);
    const commands: CanvasCommand[] = [{ type: 'shape.create', record }];
    if (shape.startBinding || shape.endBinding) commands.push({ type: 'binding.set', binding: shapeToBindingRecord(shape) });
    this.execute(commands.length === 1 ? commands[0] : { type: 'batch', commands });
    this.bus.emit('shape:created', { shape: { ...shape, zIndex: records.length } });
  }

  updateShape(shapeId: string, patch: Partial<Shape>, force = false): void {
    const current = this.state.shapes.find(({ id }) => id === shapeId);
    if (!current) return;
    if (!force && current.locked && patch.locked === undefined) return;
    const next = { ...current, ...patch };
    const records = new Map(this.engine.getSnapshot().records.map((record) => [record.id, record]));
    const currentRecord = records.get(shapeId);
    if (!currentRecord) throw new CanvasValidationError(`Shape '${shapeId}' is missing from the canvas document`, 'SHAPE_NOT_FOUND');
    const commands: CanvasCommand[] = [];
    const onlyUnlock = current.locked && Object.keys(patch).every((key) => key === 'locked');
    if (force && current.locked && !onlyUnlock) commands.push({ type: 'shape.update', id: shapeId, patch: { locked: false } });
    commands.push({
      type: 'shape.update',
      id: shapeId,
      patch: onlyUnlock ? { locked: next.locked ?? false } : shapePatchToRecordPatch(next, currentRecord, records),
    });
    const hadBinding = Boolean(current.startBinding || current.endBinding);
    const hasBinding = Boolean(next.startBinding || next.endBinding);
    if (hasBinding) commands.push({ type: 'binding.set', binding: shapeToBindingRecord(next) });
    else if (hadBinding) commands.push({ type: 'binding.delete', ids: [`${shapeId}:binding`] });
    if (force && current.locked && !onlyUnlock) commands.push({ type: 'shape.update', id: shapeId, patch: { locked: true } });
    this.cacheShapeStyle(next, patch);
    this.execute(commands.length === 1 ? commands[0] : { type: 'batch', commands });
    this.bus.emit('shape:updated', { shape: next });
  }

  appendShapePoints(shapeId: string, points: readonly { x: number; y: number; pressure?: number }[]): void {
    if (points.length === 0) return;
    this.execute({ type: 'shape.points.append', id: shapeId, points: [...points] });
    this.bus.emit('shape:updated', { shape: this.state.shapes.find(({ id }) => id === shapeId) });
  }

  replaceShape(shapeId: string, shape: Shape): void {
    const snapshot = this.engine.getSnapshot();
    const current = snapshot.records.find(({ id }) => id === shapeId);
    if (!current) return;
    const projectedParent = current.parentId === ROOT_PARENT_ID
      ? undefined
      : this.state.shapes.find(({ id }) => id === current.parentId);
    if (current.parentId !== ROOT_PARENT_ID && !projectedParent) {
      throw new CanvasValidationError(`Parent '${current.parentId}' is missing from the renderer projection`, 'PARENT_NOT_FOUND');
    }
    const record = shapeToRecord(
      { ...shape, id: shapeId, parentId: current.parentId },
      current.index,
      this.registry,
      projectedParent && {
        x: projectedParent.x,
        y: projectedParent.y,
        rotation: projectedParent.rotation ?? 0,
      },
    );
    const commands: CanvasCommand[] = [
      { type: 'shape.delete', ids: [shapeId], mode: 'only' },
      { type: 'shape.create', record },
    ];
    if (shape.startBinding || shape.endBinding) commands.push({ type: 'binding.set', binding: shapeToBindingRecord(shape) });
    this.execute({ type: 'batch', commands });
    this.bus.emit('shape:updated', { shape });
  }

  deleteShape(shapeId: string): void {
    const shape = this.state.shapes.find(({ id }) => id === shapeId);
    if (!shape || shape.locked) return;
    const commands: CanvasCommand[] = [];
    const records = new Map(this.engine.getSnapshot().records.map((record) => [record.id, record]));
    const connectedIds = this.getSpatialIndex().expandConnected(new Set([shapeId]), 1);
    for (const connectedId of connectedIds) {
      if (connectedId === shapeId) continue;
      const connector = this.getSpatialIndex().getShape(connectedId);
      if (!connector) continue;
      if (connector.startBinding?.elementId !== shapeId && connector.endBinding?.elementId !== shapeId) continue;
      const { p1, p2 } = getArrowClippedEndpoints(connector, this.state.shapes, this.registry);
      const detached: Shape = {
        ...connector,
        x: p1.x,
        y: p1.y,
        points: [{ x: 0, y: 0 }, { x: p2.x - p1.x, y: p2.y - p1.y }],
        startBinding: connector.startBinding?.elementId === shapeId ? undefined : connector.startBinding,
        endBinding: connector.endBinding?.elementId === shapeId ? undefined : connector.endBinding,
      };
      const connectorRecord = records.get(connector.id);
      if (!connectorRecord) throw new CanvasValidationError(`Connector '${connector.id}' is missing from the canvas document`, 'SHAPE_NOT_FOUND');
      commands.push({
        type: 'shape.update',
        id: connector.id,
        patch: shapePatchToRecordPatch(detached, connectorRecord, records),
      });
      if (detached.startBinding || detached.endBinding) commands.push({ type: 'binding.set', binding: shapeToBindingRecord(detached) });
      else commands.push({ type: 'binding.delete', ids: [`${connector.id}:binding`] });
    }
    commands.push({ type: 'shape.delete', ids: [shapeId], mode: 'only' });
    this.execute(commands.length === 1 ? commands[0] : { type: 'batch', commands });
    this.bus.emit('shape:deleted', { shapeId });
  }

  reparentShapes(shapeIds: readonly string[], parentId: string): void {
    const records = new Map(this.engine.getSnapshot().records.map((record) => [record.id, record]));
    const ids = [...new Set(shapeIds)].filter((id) => records.get(id)?.parentId !== parentId);
    if (ids.length === 0) return;
    this.execute({ type: 'shape.reparent', ids, parentId });
  }

  resizeFrame(shapeId: string, patch: Partial<Shape>): void {
    const current = this.state.shapes.find(({ id }) => id === shapeId);
    if (!current) return;
    const records = new Map(this.engine.getSnapshot().records.map((record) => [record.id, record]));
    const currentRecord = records.get(shapeId);
    if (!currentRecord) throw new CanvasValidationError(`Frame '${shapeId}' is missing from the canvas document`, 'SHAPE_NOT_FOUND');
    this.execute({
      type: 'frame.resize',
      id: shapeId,
      patch: shapePatchToRecordPatch({ ...current, ...patch }, currentRecord, records),
    });
  }

  setSelection(ids: string[]): void {
    this.engine.setViewState({ selectedIds: ids });
    this.bus.emit('selection:changed', { ids });
  }

  forceNotify(): void {
    this.uiRevision += 1;
    this.notify();
  }

  destroy(): void {
    this.commitState();
    this.unsubscribeEngine();
    this.projection.clear();
    this.spatialIndex?.clear();
    this.spatialIndex = null;
    this.indexedShapes = null;
    this.subscribers.clear();
  }

  private execute(command: CanvasCommand): void {
    if (this.batchDepth > 0) {
      if (command.type === 'batch') this.queuedCommands.push(...command.commands);
      else this.queuedCommands.push(command);
      return;
    }
    this.dispatch(command);
  }

  private dispatch(command: CanvasCommand): void {
    if (!this.activeUndoGroup) this.activeUndoGroup = crypto.randomUUID();
    this.engine.dispatch(command, { undoGroup: this.activeUndoGroup });
  }

  private project(initial: Partial<CanvasState> = {}): CanvasState {
    const view = this.engine.getViewState();
    const snapshot = view.snapshot;
    const shapes = this.projection.project(view);
    if (this.spatialIndex && this.indexedShapes !== shapes) {
      this.spatialIndex.update(this.projection.changes);
      this.indexedShapes = shapes;
    }
    return {
      ...DEFAULT_STATE,
      ...initial,
      shapes,
      selectedIds: [...view.selectedIds],
      activeTool: view.activeTool,
      viewport: { ...view.viewport },
      collaborators: new Map(view.collaborators),
      userToFollow: view.followingId ? { socketId: view.followingId, username: view.collaborators.get(view.followingId)?.name ?? '' } : null,
      hoveredShapeId: view.hoveredShapeId,
      hoveredPortShapeId: view.hoveredPortShapeId,
      hoveredPortId: view.hoveredPortId,
      drawingShapeId: view.drawingShapeId,
      isDraggingSelection: view.isDraggingSelection,
      resizingShapeId: view.resizingShapeId,
      frameDropTargetId: view.frameDropTargetId,
      laserTrail: [...view.laserTrail],
      isPanning: view.isPanning,
      isSpacePanning: view.isSpacePanning,
      selectionBox: view.selectionBox,
      erasingPath: view.erasingPath ? [...view.erasingPath] : null,
      erasingShapeIds: [...view.erasingShapeIds],
      editingShapeId: view.editingShapeId,
      snapLines: [...view.snapLines],
      showGrid: snapshot.document.grid.enabled,
      gridSize: snapshot.document.grid.size,
      canvasBackground: snapshot.document.background,
      theme: view.theme,
      readOnly: view.readonly,
      changedShapeIds: this.projection.changedShapeIds,
      uiRevision: this.uiRevision,
      version: this.version,
    };
  }

  private notify(): void {
    this.version += 1;
    this.state = { ...this.state, version: this.version };
    if (this.indexedShapes !== this.state.shapes && !this.spatialIndex) {
      this.spatialIndex = null;
      this.indexedShapes = null;
    }
    this.subscribers.forEach((listener) => listener(this.state));
    this.bus.emit('document:changed', { state: this.state });
  }

  private toViewPatch(current: CanvasState, next: CanvasState): Partial<Omit<CanvasViewState, 'snapshot' | 'readonly' | 'changedRecordIds'>> {
    const patch: Partial<Omit<CanvasViewState, 'snapshot' | 'readonly' | 'changedRecordIds'>> = {};
    if (next.selectedIds !== current.selectedIds) patch.selectedIds = next.selectedIds;
    if (next.activeTool !== current.activeTool) patch.activeTool = next.activeTool;
    if (next.viewport !== current.viewport) patch.viewport = next.viewport;
    if (next.theme !== current.theme && next.theme) patch.theme = next.theme;
    if (next.collaborators !== current.collaborators && next.collaborators) patch.collaborators = next.collaborators as Map<string, CanvasViewState['collaborators'] extends ReadonlyMap<string, infer T> ? T : never>;
    if (next.userToFollow !== current.userToFollow) patch.followingId = next.userToFollow?.socketId ?? null;
    if (next.hoveredShapeId !== current.hoveredShapeId) patch.hoveredShapeId = next.hoveredShapeId;
    if (next.hoveredPortShapeId !== current.hoveredPortShapeId) patch.hoveredPortShapeId = next.hoveredPortShapeId ?? null;
    if (next.hoveredPortId !== current.hoveredPortId) patch.hoveredPortId = next.hoveredPortId ?? null;
    if (next.drawingShapeId !== current.drawingShapeId) patch.drawingShapeId = next.drawingShapeId;
    if (next.isDraggingSelection !== current.isDraggingSelection) patch.isDraggingSelection = next.isDraggingSelection;
    if (next.resizingShapeId !== current.resizingShapeId) patch.resizingShapeId = next.resizingShapeId ?? null;
    if (next.frameDropTargetId !== current.frameDropTargetId) patch.frameDropTargetId = next.frameDropTargetId ?? null;
    if (next.laserTrail !== current.laserTrail) patch.laserTrail = next.laserTrail ?? [];
    if (next.isPanning !== current.isPanning) patch.isPanning = next.isPanning;
    if (next.isSpacePanning !== current.isSpacePanning) patch.isSpacePanning = next.isSpacePanning;
    if (next.selectionBox !== current.selectionBox) patch.selectionBox = next.selectionBox ?? null;
    if (next.erasingPath !== current.erasingPath) patch.erasingPath = next.erasingPath ?? null;
    if (next.erasingShapeIds !== current.erasingShapeIds) patch.erasingShapeIds = next.erasingShapeIds ?? [];
    if (next.editingShapeId !== current.editingShapeId) patch.editingShapeId = next.editingShapeId ?? null;
    if (next.snapLines !== current.snapLines) patch.snapLines = next.snapLines ?? [];
    return patch;
  }

  private cacheShapeStyle(shape: Shape, patch: Partial<Shape>): void {
    if (!STYLE_PROPERTY_KEYS.some((property) => property in patch)) return;
    const style: Partial<Shape> = {};
    const styleRecord = style as Record<string, unknown>;
    const shapeRecord = shape as unknown as Record<string, unknown>;
    STYLE_PROPERTY_KEYS.forEach((property) => {
      if (property in shape) styleRecord[property] = shapeRecord[property];
    });
    cacheStyle(shape.type, style);
    const variant = VARIANT_CACHE_KEYS[shape.type]?.(shape);
    if (variant) cacheStyle(variant, style);
  }

  private commandsForShapes(shapes: readonly Shape[]): CanvasCommand[] {
    return commandsForShapeReplacement(this.engine.getSnapshot(), shapes, this.registry);
  }
}
