import ELK from 'elkjs/lib/elk-api.js';
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker';
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api.js';
import type { LayoutRequest, LayoutResult } from './layoutTypes.js';

function graph(request: LayoutRequest): ElkNode {
  const byParent = new Map<string, LayoutRequest['nodes']>();
  request.nodes.forEach((node) => { const list = byParent.get(node.parentId) ?? []; list.push(node); byParent.set(node.parentId, list); });
  const horizontal = request.direction === 'LR' || request.direction === 'RL';
  const alignment = request.alignment === 'automatic' ? 'AUTOMATIC' : request.alignment === 'center' ? 'CENTER' : request.alignment === 'start' ? (horizontal ? 'TOP' : 'LEFT') : horizontal ? 'BOTTOM' : 'RIGHT';
  const build = (parentId: string): ElkNode[] => (byParent.get(parentId) ?? []).map((node) => ({
    id: node.id, width: node.width, height: node.height, x: node.x, y: node.y,
    children: build(node.id),
    ports: [
      { id: `${node.id}:west`, x: 0, y: node.height / 2, width: 1, height: 1, layoutOptions: { 'org.eclipse.elk.port.side': 'WEST' } },
      { id: `${node.id}:east`, x: node.width, y: node.height / 2, width: 1, height: 1, layoutOptions: { 'org.eclipse.elk.port.side': 'EAST' } },
      { id: `${node.id}:north`, x: node.width / 2, y: 0, width: 1, height: 1, layoutOptions: { 'org.eclipse.elk.port.side': 'NORTH' } },
      { id: `${node.id}:south`, x: node.width / 2, y: node.height, width: 1, height: 1, layoutOptions: { 'org.eclipse.elk.port.side': 'SOUTH' } },
    ],
    layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE', 'org.eclipse.elk.alignment': alignment },
  }));
  const sourceSide = request.direction === 'RL' ? 'west' : request.direction === 'BT' ? 'north' : horizontal ? 'east' : 'south';
  const targetSide = request.direction === 'RL' ? 'east' : request.direction === 'BT' ? 'south' : horizontal ? 'west' : 'north';
  return {
    id: 'root', children: build('root'),
    edges: request.edges.map((edge) => ({ id: edge.id, sources: [`${edge.source}:${sourceSide}`], targets: [`${edge.target}:${targetSide}`] })),
    layoutOptions: {
      'org.eclipse.elk.algorithm': 'layered', 'org.eclipse.elk.direction': request.direction,
      'org.eclipse.elk.spacing.nodeNode': String(request.spacing), 'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': String(request.spacing),
      'org.eclipse.elk.edgeRouting': 'ORTHOGONAL', 'org.eclipse.elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
  };
}

function flatten(node: ElkNode, output: LayoutResult['nodes']): void {
  (node.children ?? []).forEach((child) => { output.push({ id: child.id, x: child.x ?? 0, y: child.y ?? 0 }); flatten(child, output); });
}

function edgePoints(edge: ElkExtendedEdge): { x: number; y: number }[] {
  const section = edge.sections?.[0]; if (!section) return [];
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(({ x, y }) => ({ x, y }));
}

export async function runElkLayout(request: LayoutRequest, signal?: AbortSignal): Promise<LayoutResult> {
  if (signal?.aborted) throw new DOMException('Layout cancelled', 'AbortError');
  const browser = typeof window !== 'undefined' && typeof document !== 'undefined' && !globalThis.navigator?.userAgent.includes('jsdom');
  if (browser && typeof Worker === 'undefined') throw new Error('Auto layout requires Web Worker support');
  const elk = browser
    ? new ELK({ workerFactory: () => new ElkWorker() })
    : new (await import('elkjs/lib/elk.bundled.js')).default();
  const abort = () => { if (browser) elk.terminateWorker(); }; signal?.addEventListener('abort', abort, { once: true });
  try {
    const result = await elk.layout(graph(request));
    if (signal?.aborted) throw new DOMException('Layout cancelled', 'AbortError');
    const nodes: LayoutResult['nodes'] = []; flatten(result, nodes);
    const connectorByEdge = new Map(request.edges.map((edge) => [edge.id, edge.connectorId]));
    const edges = (result.edges ?? []).map((edge) => ({ connectorId: connectorByEdge.get(edge.id)!, points: edgePoints(edge) })).filter(({ connectorId, points }) => Boolean(connectorId) && points.length >= 2);
    return { nodes, edges };
  } finally { signal?.removeEventListener('abort', abort); if (browser) elk.terminateWorker(); }
}
