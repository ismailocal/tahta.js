import { EventBus } from './EventBus';
import type { CanvasState, Shape, ICanvasAPI } from './types';
import { HistoryManager } from './HistoryManager';
import { Quadtree } from './SpatialIndex';
import { getShapeBounds } from './Geometry';
import { ShapeManager } from './ShapeManager';
import { getArrowClippedEndpoints } from './lineUtils';
import { PluginRegistry } from '../plugins/PluginRegistry';

export const DEFAULT_STATE: CanvasState = {
  shapes: [],
  selectedIds: [],
  activeTool: 'select',
  viewport: { x: 0, y: 0, zoom: 1 },
  hoveredShapeId: null,
  drawingShapeId: null,
  isDraggingSelection: false,
  isPanning: false,
  isSpacePanning: false,
  showGrid: false,
  gridSize: 20,
  editingShapeId: null,
};

export class WhiteboardStore {
  public bus: EventBus;
  private subscribers = new Set<(state: CanvasState) => void>();
  private state: CanvasState;
  private historyManager: HistoryManager;
  private spatialIndex: Quadtree | null = null;
  private batchDepth = 0;

  constructor(initialState: Partial<CanvasState> = {}, bus = new EventBus()) {
    this.bus = bus;
    this.state = { ...DEFAULT_STATE, ...initialState };
    this.historyManager = new HistoryManager(this.state.shapes);
  }

  getState() { return this.state; }
  commitState() { this.historyManager.commit(this.state.shapes); }
  get canUndo() { return this.historyManager.canUndo; }
  get canRedo() { return this.historyManager.canRedo; }

  undo() {
    const nextShapes = this.historyManager.undo();
    if (nextShapes) {
      this.state = { ...this.state, shapes: nextShapes, selectedIds: [] };
      this.notify();
    }
  }

  redo() {
    const nextShapes = this.historyManager.redo();
    if (nextShapes) {
      this.state = { ...this.state, shapes: nextShapes, selectedIds: [] };
      this.notify();
    }
  }

  reorderShape(shapeId: string, direction: 'forward' | 'backward' | 'front' | 'back') {
    this.state = { ...this.state, shapes: ShapeManager.reorder(this.state.shapes, shapeId, direction) };
    this.notify();
  }

  subscribe(listener: (state: CanvasState) => void) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    if (this.batchDepth > 0) return;
    this.spatialIndex = null;
    this.subscribers.forEach((listener) => listener(this.state));
    this.bus.emit('document:changed', { state: this.state });
  }

  batchUpdate(fn: () => void) {
    this.batchDepth++;
    try { fn(); } finally {
      this.batchDepth--;
      if (this.batchDepth === 0) this.notify();
    }
  }

  getSpatialIndex(): Quadtree {
    if (this.spatialIndex) return this.spatialIndex;
    const b = this.state.shapes.reduce((acc, s) => {
      const sb = getShapeBounds(s);
      return { x: Math.min(acc.x, sb.x), y: Math.min(acc.y, sb.y), x2: Math.max(acc.x2, sb.x + sb.width), y2: Math.max(acc.y2, sb.y + sb.height) };
    }, { x: -1000, y: -1000, x2: 2000, y2: 2000 });
    const tree = new Quadtree({ x: b.x - 100, y: b.y - 100, width: (b.x2 - b.x) + 200, height: (b.y2 - b.y) + 200 });
    this.state.shapes.forEach(s => tree.insert(s, getShapeBounds(s)));
    this.spatialIndex = tree;
    return tree;
  }

  setState(updater: Partial<CanvasState> | ((state: CanvasState) => CanvasState)) {
    this.state = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater };
    this.notify();
  }

  setTool(tool: string) {
    this.state = { ...this.state, activeTool: tool, selectedIds: [] };
    this.notify();
    this.bus.emit('tool:changed', { tool });
  }

  setViewport(viewport: CanvasState['viewport']) {
    this.state = { ...this.state, viewport };
    this.notify();
    this.bus.emit('viewport:changed', { viewport });
  }

  addShape(shape: Shape) {
    this.state = { ...this.state, shapes: ShapeManager.add(this.state.shapes, shape) };
    const newShape = this.state.shapes[this.state.shapes.length - 1];
    this.notify();
    this.bus.emit('shape:created', { shape: newShape });
  }

  updateShape(shapeId: string, patch: Partial<Shape>, force = false) {
    const { shapes, updated } = ShapeManager.update(this.state.shapes, shapeId, patch, force);
    this.state = { ...this.state, shapes };
    this.notify();
    if (updated) this.bus.emit('shape:updated', { shape: updated });
  }

  replaceShape(shapeId: string, nextShape: Shape) {
    this.state = { ...this.state, shapes: ShapeManager.replace(this.state.shapes, shapeId, nextShape) };
    this.notify();
    this.bus.emit('shape:updated', { shape: nextShape });
  }

  deleteShape(shapeId: string) {
    const shapes = this.state.shapes;
    const shapeToDelete = shapes.find(s => s.id === shapeId);
    if (!shapeToDelete || shapeToDelete.locked) return;

    // DETACH & BAKE: Capture visual endpoints before the bound shape is removed from the array
    const nextShapes = ShapeManager.delete(shapes, shapeId).map(s => {
      if (PluginRegistry.hasPlugin(s.type) && PluginRegistry.getPlugin(s.type).isConnector && (s.startBinding?.elementId === shapeId || s.endBinding?.elementId === shapeId)) {
        const { p1, p2 } = getArrowClippedEndpoints(s, shapes);
        return {
          ...s,
          x: p1.x,
          y: p1.y,
          points: [{ x: 0, y: 0 }, { x: p2.x - p1.x, y: p2.y - p1.y }],
          startBinding: s.startBinding?.elementId === shapeId ? undefined : s.startBinding,
          endBinding: s.endBinding?.elementId === shapeId ? undefined : s.endBinding
        };
      }
      return s;
    });

    this.state = { 
      ...this.state, 
      shapes: nextShapes,
      selectedIds: this.state.selectedIds.filter(id => id !== shapeId)
    };
    this.notify();
    this.bus.emit('shape:deleted', { shapeId });
  }

  setSelection(ids: string[]) {
    this.state = { ...this.state, selectedIds: ids };
    this.notify();
    this.bus.emit('selection:changed', { ids });
  }

  createAPI(): ICanvasAPI {
    return {
      getState: () => this.getState(),
      setState: (updater) => this.setState(updater),
      addShape: (shape) => this.addShape(shape),
      updateShape: (id, patch, force) => this.updateShape(id, patch, force),
      replaceShape: (id, shape) => this.replaceShape(id, shape),
      deleteShape: (id) => this.deleteShape(id),
      setSelection: (ids) => this.setSelection(ids),
      setViewport: (viewport) => this.setViewport(viewport),
      setTool: (tool) => this.setTool(tool),
      reorderShape: (id, direction) => { this.reorderShape(id, direction); this.commitState(); },
      commitState: () => this.commitState(),
      undo: () => this.undo(),
      redo: () => this.redo(),
      batchUpdate: (fn: () => void) => this.batchUpdate(fn),
      getSpatialIndex: () => this.getSpatialIndex()
    };
  }
}
