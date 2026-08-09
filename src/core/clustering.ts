import type { CanvasEngine } from './CanvasEngine.js';
import { CanvasValidationError, compareFractionalIndex, ROOT_PARENT_ID, type ShapeRecord } from './model.js';
import { plainText, richTextFromString } from '../shapes/builtins.js';
import { generateKeyBetween } from 'fractional-indexing';

export interface StickyCluster { id: string; title: string; stickyIds: string[]; score: number }

function terms(record: ShapeRecord): Set<string> {
  const props = record.props as { text?: Parameters<typeof plainText>[0]; tags?: string };
  const text = props.text ? plainText(props.text) : '';
  const tags = (props.tags ?? '').split(',').map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean).slice(0, 32);
  return new Set([...(text.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []), ...tags.map((tag) => `tag:${tag}`)]);
}

export function previewStickyClusters(engine: CanvasEngine, requestedCount?: number): StickyCluster[] {
  const stickies = engine.getSnapshot().records.filter(({ type, hidden }) => type === 'sticky-note' && !hidden);
  if (stickies.length < 2) return [];
  const count = Math.max(1, Math.min(requestedCount ?? Math.round(Math.sqrt(stickies.length)), 12, stickies.length));
  const vectors = stickies.map((record) => ({ record, terms: terms(record) }));
  const seeds = [...vectors].sort((a, b) => a.record.id.localeCompare(b.record.id)).slice(0, count);
  const clusters = seeds.map((seed, index) => ({ id: `cluster-${index + 1}`, title: [...seed.terms].slice(0, 3).join(' / ') || `Cluster ${index + 1}`, stickyIds: [] as string[], score: 0, seed }));
  vectors.forEach((vector) => {
    let best = clusters[0]!; let bestScore = -Infinity;
    clusters.forEach((cluster) => {
      const intersection = [...vector.terms].filter((term) => cluster.seed.terms.has(term)).length;
      const union = new Set([...vector.terms, ...cluster.seed.terms]).size || 1;
      const semantic = intersection / union;
      const vectorTags = [...vector.terms].filter((term) => term.startsWith('tag:')); const seedTags = new Set([...cluster.seed.terms].filter((term) => term.startsWith('tag:')));
      const tag = vectorTags.length ? vectorTags.filter((term) => seedTags.has(term)).length / new Set([...vectorTags, ...seedTags]).size : 0;
      const spatial = 1 / (1 + Math.hypot(vector.record.x - cluster.seed.record.x, vector.record.y - cluster.seed.record.y) / 800);
      const color = (vector.record.props as { fill?: string }).fill === (cluster.seed.record.props as { fill?: string }).fill ? 1 : 0;
      const score = semantic * 0.5 + tag * 0.2 + spatial * 0.2 + color * 0.1;
      if (score > bestScore) { best = cluster; bestScore = score; }
    });
    best.stickyIds.push(vector.record.id); best.score += bestScore;
  });
  return clusters.map((cluster) => ({ id: cluster.id, title: cluster.title, stickyIds: cluster.stickyIds, score: cluster.score }));
}

export function applyStickyClusters(engine: CanvasEngine, clusters: readonly StickyCluster[]): void {
  const snapshot = engine.getSnapshot(); const map = new Map(snapshot.records.map((record) => [record.id, record]));
  let index = snapshot.records.filter(({ parentId }) => parentId === ROOT_PARENT_ID).sort((a, b) => compareFractionalIndex(a.index, b.index)).at(-1)?.index ?? null;
  const commands: Parameters<CanvasEngine['dispatch']>[0][] = [];
  clusters.forEach((cluster) => {
    const members = cluster.stickyIds.map((id) => map.get(id)).filter((value): value is ShapeRecord => Boolean(value));
    if (!members.length) return;
    if (members.some(({ locked }) => locked)) throw new CanvasValidationError('Locked sticky notes cannot be clustered', 'SHAPE_LOCKED');
    const bounds = members.map((record) => engine.registry.get(record.type).geometry.getBounds(record));
    const minX = Math.min(...bounds.map(({ x }) => x)) - 40; const minY = Math.min(...bounds.map(({ y }) => y)) - 64;
    const maxX = Math.max(...bounds.map(({ x, width }) => x + width)) + 40; const maxY = Math.max(...bounds.map(({ y, height }) => y + height)) + 40;
    const definition = engine.registry.get('frame'); index = generateKeyBetween(index, null); const frameId = crypto.randomUUID();
    const frame = engine.registry.validate({ id: frameId, type: 'frame', typeVersion: definition.version, parentId: ROOT_PARENT_ID, index, x: minX, y: minY, rotation: 0, opacity: 1, locked: false, hidden: false, props: { ...(definition.defaults() as Record<string, unknown>), width: maxX - minX, height: maxY - minY, text: richTextFromString(cluster.title) } });
    commands.push({ type: 'shape.create', record: frame });
    commands.push({ type: 'shape.reparent', ids: members.map(({ id }) => id), parentId: frameId });
  });
  if (commands.length) engine.dispatch({ type: 'batch', commands });
}
