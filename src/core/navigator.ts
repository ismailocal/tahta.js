import { compareFractionalIndex, type CanvasSnapshotV2, type ShapeRecord } from './model.js';

export interface NavigatorNode { record: ShapeRecord; children: NavigatorNode[] }

export function buildNavigatorTree(snapshot: CanvasSnapshotV2): NavigatorNode[] {
  const children = new Map<string, NavigatorNode[]>();
  snapshot.records.forEach((record) => { const list = children.get(record.parentId) ?? []; list.push({ record, children: [] }); children.set(record.parentId, list); });
  children.forEach((list) => list.sort((a, b) => compareFractionalIndex(a.record.index, b.record.index)));
  const attach = (parentId: string): NavigatorNode[] => (children.get(parentId) ?? []).map((node) => ({ ...node, children: attach(node.record.id) }));
  return attach('root');
}

export class CanvasSearchIndex {
  readonly #tokens = new Map<string, Set<string>>();
  readonly #records = new Map<string, ShapeRecord>();
  update(records: readonly ShapeRecord[]): void {
    const incoming = new Set(records.map(({ id }) => id));
    this.#records.forEach((_, id) => { if (!incoming.has(id)) this.#remove(id); });
    records.forEach((record) => { if (this.#records.get(record.id) !== record) { this.#remove(record.id); this.#records.set(record.id, record); this.#record(record); } });
  }
  search(query: string): ShapeRecord[] {
    const terms = query.toLocaleLowerCase().match(/[\p{L}\p{N}._:/-]+/gu) ?? [];
    if (!terms.length) return [...this.#records.values()];
    const ids = terms.map((term) => new Set([...this.#tokens.entries()].filter(([token]) => token.includes(term)).flatMap(([, values]) => [...values])));
    return [...(ids[0] ?? [])].filter((id) => ids.every((set) => set.has(id))).map((id) => this.#records.get(id)!).filter(Boolean);
  }
  #record(record: ShapeRecord): void {
    const content = `${record.id} ${record.type} ${JSON.stringify(record.props)}`.toLocaleLowerCase();
    (content.match(/[\p{L}\p{N}._:/-]+/gu) ?? []).forEach((token) => { const ids = this.#tokens.get(token) ?? new Set(); ids.add(record.id); this.#tokens.set(token, ids); });
  }
  #remove(id: string): void { this.#records.delete(id); this.#tokens.forEach((ids, token) => { ids.delete(id); if (!ids.size) this.#tokens.delete(token); }); }
}
