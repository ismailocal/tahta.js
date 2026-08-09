import type { ShapeBounds } from '../core/registry.js';

interface IndexedBounds extends ShapeBounds { id: string }

export class SpatialHashIndex {
  readonly #cellSize: number;
  readonly #cells = new Map<string, Set<string>>();
  readonly #bounds = new Map<string, ShapeBounds>();

  constructor(cellSize = 512) { this.#cellSize = cellSize; }

  update(items: readonly IndexedBounds[]): void {
    const incoming = new Map(items.map(({ id, ...bounds }) => [id, bounds]));
    for (const id of this.#bounds.keys()) if (!incoming.has(id)) this.remove(id);
    for (const [id, bounds] of incoming) this.upsert({ id, ...bounds });
  }

  upsert({ id, ...bounds }: IndexedBounds): void {
    const current = this.#bounds.get(id);
    if (current && current.x === bounds.x && current.y === bounds.y && current.width === bounds.width && current.height === bounds.height) return;
    this.remove(id); this.#bounds.set(id, bounds);
    for (const key of this.#keys(bounds)) { const cell = this.#cells.get(key) ?? new Set<string>(); cell.add(id); this.#cells.set(key, cell); }
  }

  query(bounds: ShapeBounds): Set<string> {
    const result = new Set<string>();
    for (const key of this.#keys(bounds)) {
      for (const id of this.#cells.get(key) ?? []) {
        const item = this.#bounds.get(id);
        if (item && intersects(item, bounds)) result.add(id);
      }
    }
    return result;
  }

  clear(): void { this.#cells.clear(); this.#bounds.clear(); }

  remove(id: string): void {
    const bounds = this.#bounds.get(id);
    if (!bounds) return;
    for (const key of this.#keys(bounds)) {
      const cell = this.#cells.get(key);
      cell?.delete(id);
      if (cell?.size === 0) this.#cells.delete(key);
    }
    this.#bounds.delete(id);
  }

  #keys(bounds: ShapeBounds): string[] {
    const left = Math.floor(bounds.x / this.#cellSize);
    const right = Math.floor((bounds.x + Math.max(1, bounds.width)) / this.#cellSize);
    const top = Math.floor(bounds.y / this.#cellSize);
    const bottom = Math.floor((bounds.y + Math.max(1, bounds.height)) / this.#cellSize);
    const keys: string[] = [];
    for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) keys.push(`${x}:${y}`);
    return keys;
  }
}

function intersects(a: ShapeBounds, b: ShapeBounds): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}
