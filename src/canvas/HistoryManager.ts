import type { Shape } from '../core/types';

const cloneShape = (shape: Shape): Shape => structuredClone(shape);

export const clone = (shapes: Shape[]): Shape[] => shapes.map(cloneShape);

interface ShapeChange {
  id: string;
  before?: Shape;
  after?: Shape;
}

interface HistoryEntry {
  changes: ShapeChange[];
  beforeOrder: string[];
  afterOrder: string[];
}

function sameShape(left: Shape, right: Shape): boolean {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

function createEntry(before: Shape[], after: Shape[]): HistoryEntry | null {
  const beforeById = new Map(before.map((shape) => [shape.id, shape]));
  const afterById = new Map(after.map((shape) => [shape.id, shape]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  const changes: ShapeChange[] = [];

  for (const id of ids) {
    const previous = beforeById.get(id);
    const next = afterById.get(id);
    if (previous && next && sameShape(previous, next)) continue;
    changes.push({
      id,
      before: previous ? cloneShape(previous) : undefined,
      after: next ? cloneShape(next) : undefined,
    });
  }

  const beforeOrder = before.map(({ id }) => id);
  const afterOrder = after.map(({ id }) => id);
  const orderChanged = beforeOrder.length !== afterOrder.length
    || beforeOrder.some((id, index) => afterOrder[index] !== id);
  if (changes.length === 0 && !orderChanged) return null;
  return { changes, beforeOrder, afterOrder };
}

function applyEntry(current: Shape[], entry: HistoryEntry, direction: 'undo' | 'redo'): Shape[] {
  const nextById = new Map(current.map((shape) => [shape.id, shape]));
  for (const change of entry.changes) {
    const value = direction === 'undo' ? change.before : change.after;
    if (value) nextById.set(change.id, cloneShape(value));
    else nextById.delete(change.id);
  }

  const order = direction === 'undo' ? entry.beforeOrder : entry.afterOrder;
  return order.flatMap((id) => {
    const shape = nextById.get(id);
    return shape ? [shape] : [];
  });
}

/** Delta-based undo history: each commit stores only changed shapes and ordering. */
export class HistoryManager {
  private entries: HistoryEntry[] = [];
  private historyIndex = 0;
  private readonly maxHistory: number;
  private current: Shape[];

  constructor(initialShapes: Shape[] = [], maxHistory = 100) {
    this.current = clone(initialShapes);
    this.maxHistory = maxHistory;
  }

  commit(shapes: Shape[]): void {
    const entry = createEntry(this.current, shapes);
    if (!entry) return;

    if (this.historyIndex < this.entries.length) {
      this.entries = this.entries.slice(0, this.historyIndex);
    }
    this.entries.push(entry);
    if (this.entries.length > this.maxHistory) this.entries.shift();
    this.historyIndex = this.entries.length;
    this.current = clone(shapes);
  }

  undo(): Shape[] | null {
    if (!this.canUndo) return null;
    this.current = applyEntry(this.current, this.entries[this.historyIndex - 1], 'undo');
    this.historyIndex--;
    return clone(this.current);
  }

  redo(): Shape[] | null {
    if (!this.canRedo) return null;
    this.current = applyEntry(this.current, this.entries[this.historyIndex], 'redo');
    this.historyIndex++;
    return clone(this.current);
  }

  get canUndo(): boolean { return this.historyIndex > 0; }
  get canRedo(): boolean { return this.historyIndex < this.entries.length; }
  get currentShapes(): Shape[] { return clone(this.current); }
}
