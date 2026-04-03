import { EventBus } from '../canvas/EventBus';
import type { CanvasState, Shape } from './types';
import { HistoryManager } from '../canvas/HistoryManager';
import { Quadtree } from '../geometry/SpatialIndex';
import { getShapeBounds } from '../geometry/Geometry';
import { ShapeManager } from '../geometry/ShapeManager';
import { getArrowClippedEndpoints } from '../geometry/lineUtils';
import { PluginRegistry } from '../plugins/PluginRegistry';

/** Default initial state for a new canvas. */
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
  theme: 'light',
  version: 0,
};

/**
 * Central state container for the whiteboard engine.
 * Handles state updates, history (undo/redo), spatial indexing, and event broadcasting.
 */
export class WhiteboardStore {
  /** The event bus used for internal and external communication. */
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

  /** Returns the current snapshot of the canvas state. */
  getState(): CanvasState { return this.state; }
  
  /** Commits the current shapes to the history manager for undo/redo. */
  commitState(): void { this.historyManager.commit(this.state.shapes); }
  
  get canUndo(): boolean { return this.historyManager.canUndo; }
  get canRedo(): boolean { return this.historyManager.canRedo; }

  /** Reverts the last committed state transition. */
  undo(): void {
    const nextShapes = this.historyManager.undo();
    if (nextShapes) {
      this.state = { ...this.state, shapes: nextShapes, selectedIds: [] };
      this.notify();
    }
  }

  /** Re-applies the last undone state transition. */
  redo(): void {
    const nextShapes = this.historyManager.redo();
    if (nextShapes) {
      this.state = { ...this.state, shapes: nextShapes, selectedIds: [] };
      this.notify();
    }
  }

  /** 
   * Changes the stack order of a shape.
   * @param direction 'forward' | 'backward' | 'front' | 'back'
   */
  reorderShape(shapeId: string, direction: 'forward' | 'backward' | 'front' | 'back'): void {
    this.state = { 
      ...this.state, 
      shapes: ShapeManager.reorder(this.state.shapes, shapeId, direction)
    };
    this.notify();
  }

  /** Registers a listener for state changes. Returns an unbsubscribe function. */
  subscribe(listener: (state: CanvasState) => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  /** 
   * Triggers a re-render and broadcasts 'document:changed' through the event bus.
   * Automatically increments state version unless forceVersion is specified.
   */
  notify(forceVersion?: number): void {
    if (this.batchDepth > 0) return;
    
    if (forceVersion !== undefined) {
      this.state.version = forceVersion;
    } else {
      this.state.version++;
    }

    this.spatialIndex = null;
    this.subscribers.forEach((listener) => listener(this.state));
    this.bus.emit('document:changed', { state: this.state });
  }

  /** Groups multiple operations into a single notification. */
  batchUpdate(fn: () => void): void {
    this.batchDepth++;
    try { fn(); } finally {
      this.batchDepth--;
      if (this.batchDepth === 0) this.notify();
    }
  }

  /** Returns built-in spatial index (Quadtree) for fast bounding-box queries. */
  getSpatialIndex(): Quadtree {
    if (this.spatialIndex) return this.spatialIndex;
    const b = this.state.shapes.reduce((acc, s) => {
      const sb = getShapeBounds(s);
      return { 
        x: Math.min(acc.x, sb.x), y: Math.min(acc.y, sb.y), 
        x2: Math.max(acc.x2, sb.x + sb.width), y2: Math.max(acc.y2, sb.y + sb.height) 
      };
    }, { x: -1000, y: -1000, x2: 2000, y2: 2000 });
    const tree = new Quadtree({ x: b.x - 100, y: b.y - 100, width: (b.x2 - b.x) + 200, height: (b.y2 - b.y) + 200 });
    this.state.shapes.forEach(s => tree.insert(s, getShapeBounds(s)));
    this.spatialIndex = tree;
    return tree;
  }

  /** Directly patches or calculates the new state. */
  setState(updater: Partial<CanvasState> | ((state: CanvasState) => CanvasState)): void {
    const nextState = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater };
    
    // Quick shallow equality check to avoid unnecessary notifies (Rule 8.1)
    const hasChanged = Object.keys(nextState).some(
      (key) => (nextState as any)[key] !== (this.state as any)[key]
    );

    if (hasChanged) {
      this.state = nextState;
      this.notify();
    }
  }

  /** Updates tool with optional selection preservation. */
  setTool(tool: string, keepSelection = false): void {
    this.state = { ...this.state, activeTool: tool, selectedIds: keepSelection ? this.state.selectedIds : [] };
    this.notify();
    this.bus.emit('tool:changed', { tool });
  }

  /** Pan and zoom the viewport. */
  setViewport(viewport: CanvasState['viewport']): void {
    this.state = { ...this.state, viewport };
    this.notify();
    this.bus.emit('viewport:changed', { viewport });
  }

  /** Add a shape to the world. */
  addShape(shape: Shape): void {
    this.state = { ...this.state, shapes: ShapeManager.add(this.state.shapes, shape) };
    const newShape = this.state.shapes[this.state.shapes.length - 1];
    this.notify();
    this.bus.emit('shape:created', { shape: newShape });
  }

  /** Partial update of a shape by ID. */
  updateShape(shapeId: string, patch: Partial<Shape>, force = false): void {
    const { shapes, updated } = ShapeManager.update(this.state.shapes, shapeId, patch, force);
    this.state = { ...this.state, shapes };
    this.notify();
    if (updated) this.bus.emit('shape:updated', { shape: updated });
  }

  /** Full substitution of a shape. */
  replaceShape(shapeId: string, nextShape: Shape): void {
    this.state = { ...this.state, shapes: ShapeManager.replace(this.state.shapes, shapeId, nextShape) };
    this.notify();
    this.bus.emit('shape:updated', { shape: nextShape });
  }

  /** Deletes a shape and resolves its connector bindings. */
  deleteShape(shapeId: string): void {
    const shapes = this.state.shapes;
    const shapeToDelete = shapes.find(s => s.id === shapeId);
    if (!shapeToDelete || shapeToDelete.locked) return;

    const nextShapes = ShapeManager.delete(shapes, shapeId).map(s => {
      const p = PluginRegistry.getPlugin(s.type);
      if (p?.isConnector && (s.startBinding?.elementId === shapeId || s.endBinding?.elementId === shapeId)) {
        const { p1, p2 } = getArrowClippedEndpoints(s, shapes);
        return {
          ...s,
          x: p1.x, y: p1.y,
          points: [{ x: 0, y: 0 }, { x: p2.x - p1.x, y: p2.y - p1.y }],
          startBinding: s.startBinding?.elementId === shapeId ? undefined : s.startBinding,
          endBinding: s.endBinding?.elementId === shapeId ? undefined : s.endBinding
        };
      }
      return s;
    });

    this.state = { ...this.state, shapes: nextShapes, selectedIds: this.state.selectedIds.filter(id => id !== shapeId) };
    this.notify();
    this.bus.emit('shape:deleted', { shapeId });
  }

  /** Updates the selection set. */
  setSelection(ids: string[]): void {
    this.state = { ...this.state, selectedIds: ids };
    this.notify();
    this.bus.emit('selection:changed', { ids });
  }
}
