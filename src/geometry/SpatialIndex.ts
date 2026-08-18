import type { Point, Shape } from '../core/types.js';
import type { ShapeRegistry } from '../core/registry.js';
import { ROOT_PARENT_ID } from '../core/model.js';
import { getShapeBounds } from './Geometry.js';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface IndexedShape {
  shape: Shape;
  bounds: Bounds;
  cells: readonly string[] | null;
}

export interface SpatialIndexChange {
  readonly id: string;
  readonly shape?: Shape;
}

const CELL_SIZE = 512;
const MAX_CELLS_PER_SHAPE = 256;

function intersects(left: Bounds, right: Bounds): boolean {
  return left.x <= right.x + right.width
    && left.x + left.width >= right.x
    && left.y <= right.y + right.height
    && left.y + left.height >= right.y;
}

function containsPoint(bounds: Bounds, point: Point): boolean {
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

function cellCoordinate(value: number): number {
  return Math.floor(value / CELL_SIZE);
}

function cellKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function cellsForBounds(bounds: Bounds): readonly string[] | null {
  const minX = cellCoordinate(bounds.x);
  const minY = cellCoordinate(bounds.y);
  const maxX = cellCoordinate(bounds.x + bounds.width);
  const maxY = cellCoordinate(bounds.y + bounds.height);
  const count = (maxX - minX + 1) * (maxY - minY + 1);
  if (count > MAX_CELLS_PER_SHAPE) return null;
  const keys = new Array<string>(count);
  let index = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) keys[index++] = cellKey(x, y);
  }
  return keys;
}

/**
 * Incremental, unbounded spatial hash used by hit testing and rendering.
 * A record change only reindexes that record; very large shapes are kept in a
 * bounded overflow set instead of allocating an unbounded number of cells.
 */
export class ShapeSpatialIndex {
  readonly #registry: ShapeRegistry;
  readonly #entries = new Map<string, IndexedShape>();
  readonly #cells = new Map<string, Set<string>>();
  readonly #oversized = new Set<string>();
  readonly #connections = new Map<string, Set<string>>();
  readonly #connectorTargets = new Map<string, readonly string[]>();
  readonly #childrenByParent = new Map<string, Set<string>>();
  readonly #parentByChild = new Map<string, string>();

  constructor(shapes: readonly Shape[], registry: ShapeRegistry) {
    this.#registry = registry;
    shapes.forEach((shape) => this.#insert(shape));
  }

  update(changes: readonly SpatialIndexChange[]): void {
    for (const change of changes) {
      this.#remove(change.id);
      if (change.shape) this.#insert(change.shape);
    }
  }

  queryPoint(point: Point): Shape[] {
    return this.#queryCandidates([cellKey(cellCoordinate(point.x), cellCoordinate(point.y))])
      .filter(({ bounds }) => containsPoint(bounds, point))
      .map(({ shape }) => shape);
  }

  queryBounds(bounds: Bounds): Shape[] {
    const keys = cellsForBounds(bounds);
    const candidates = keys === null
      ? [...this.#entries.values()]
      : this.#queryCandidates(keys);
    return candidates.filter((entry) => intersects(entry.bounds, bounds)).map(({ shape }) => shape);
  }

  expandConnected(shapeIds: ReadonlySet<string>, maximumDepth = 2): Set<string> {
    const expanded = new Set(shapeIds);
    let frontier = [...shapeIds];
    for (let depth = 0; depth < maximumDepth && frontier.length > 0; depth += 1) {
      const next: string[] = [];
      frontier.forEach((id) => this.#connections.get(id)?.forEach((connectedId) => {
        if (expanded.has(connectedId)) return;
        expanded.add(connectedId);
        next.push(connectedId);
      }));
      frontier = next;
    }
    return expanded;
  }

  expandDescendants(shapeIds: ReadonlySet<string>): Set<string> {
    const expanded = new Set(shapeIds);
    const descendants = [...shapeIds];
    for (let index = 0; index < descendants.length; index += 1) {
      this.#childrenByParent.get(descendants[index])?.forEach((childId) => {
        if (expanded.has(childId)) return;
        expanded.add(childId);
        descendants.push(childId);
      });
    }
    return expanded;
  }

  /**
   * Expands transient renderer membership without walking through the entire
   * connected graph: selected frames include all descendants and connectors
   * bound to those descendants, while external connector targets stay static.
   */
  expandRenderDependencies(shapeIds: ReadonlySet<string>): Set<string> {
    const expanded = this.expandDescendants(shapeIds);

    [...expanded].forEach((id) => {
      const directTargets = this.#connectorTargets.get(id);
      if (directTargets) directTargets.forEach((targetId) => expanded.add(targetId));
      this.#connections.get(id)?.forEach((connectedId) => {
        if (this.#connectorTargets.has(connectedId)) expanded.add(connectedId);
      });
    });
    return expanded;
  }

  getShape(id: string): Shape | undefined {
    return this.#entries.get(id)?.shape;
  }

  get size(): number {
    return this.#entries.size;
  }

  clear(): void {
    this.#entries.clear();
    this.#cells.clear();
    this.#oversized.clear();
    this.#connections.clear();
    this.#connectorTargets.clear();
    this.#childrenByParent.clear();
    this.#parentByChild.clear();
  }

  #queryCandidates(keys: readonly string[]): IndexedShape[] {
    const ids = new Set(this.#oversized);
    keys.forEach((key) => this.#cells.get(key)?.forEach((id) => ids.add(id)));
    const results: IndexedShape[] = [];
    ids.forEach((id) => {
      const entry = this.#entries.get(id);
      if (entry) results.push(entry);
    });
    return results;
  }

  #insert(shape: Shape): void {
    const bounds = getShapeBounds(shape, this.#registry);
    const cells = cellsForBounds(bounds);
    this.#entries.set(shape.id, { shape, bounds, cells });
    const targets = [shape.startBinding?.elementId, shape.endBinding?.elementId]
      .filter((id): id is string => typeof id === 'string');
    if (targets.length > 0) {
      this.#connectorTargets.set(shape.id, targets);
      targets.forEach((targetId) => this.#connect(shape.id, targetId));
    }
    if (shape.parentId && shape.parentId !== ROOT_PARENT_ID) {
      this.#parentByChild.set(shape.id, shape.parentId);
      let children = this.#childrenByParent.get(shape.parentId);
      if (!children) {
        children = new Set();
        this.#childrenByParent.set(shape.parentId, children);
      }
      children.add(shape.id);
    }
    if (cells === null) {
      this.#oversized.add(shape.id);
      return;
    }
    cells.forEach((key) => {
      let ids = this.#cells.get(key);
      if (!ids) {
        ids = new Set();
        this.#cells.set(key, ids);
      }
      ids.add(shape.id);
    });
  }

  #remove(id: string): void {
    const entry = this.#entries.get(id);
    if (!entry) return;
    this.#connectorTargets.get(id)?.forEach((targetId) => this.#disconnect(id, targetId));
    this.#connectorTargets.delete(id);
    const parentId = this.#parentByChild.get(id);
    if (parentId) {
      const children = this.#childrenByParent.get(parentId);
      children?.delete(id);
      if (children?.size === 0) this.#childrenByParent.delete(parentId);
      this.#parentByChild.delete(id);
    }
    this.#entries.delete(id);
    if (entry.cells === null) {
      this.#oversized.delete(id);
      return;
    }
    entry.cells.forEach((key) => {
      const ids = this.#cells.get(key);
      if (!ids) return;
      ids.delete(id);
      if (ids.size === 0) this.#cells.delete(key);
    });
  }

  #connect(left: string, right: string): void {
    for (const [source, target] of [[left, right], [right, left]] as const) {
      let connections = this.#connections.get(source);
      if (!connections) {
        connections = new Set();
        this.#connections.set(source, connections);
      }
      connections.add(target);
    }
  }

  #disconnect(left: string, right: string): void {
    for (const [source, target] of [[left, right], [right, left]] as const) {
      const connections = this.#connections.get(source);
      if (!connections) continue;
      connections.delete(target);
      if (connections.size === 0) this.#connections.delete(source);
    }
  }
}

export function createShapeSpatialIndex(shapes: readonly Shape[], registry: ShapeRegistry): ShapeSpatialIndex {
  return new ShapeSpatialIndex(shapes, registry);
}
