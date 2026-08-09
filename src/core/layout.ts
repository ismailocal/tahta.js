import type { CanvasEngine } from './CanvasEngine.js';
import { CanvasValidationError, ROOT_PARENT_ID, type ShapeRecord } from './model.js';
import type { LayoutAlignment, LayoutDirection, LayoutRequest, LayoutResult } from './layoutTypes.js';
import { getWorldTransform, toLocalTransform } from './transforms.js';

export interface AutoLayoutOptions {
  scope?: 'selection' | 'frame' | 'board';
  frameId?: string;
  direction?: LayoutDirection;
  alignment?: LayoutAlignment;
  spacing?: number;
  signal?: AbortSignal;
}

export interface LayoutPreview { positions: ReadonlyMap<string, { x: number; y: number }>; connectorPoints: ReadonlyMap<string, { x: number; y: number }[]> }

function layoutRecords(engine: CanvasEngine, options: AutoLayoutOptions): ShapeRecord[] {
  const state = engine.getViewState(); const records = state.snapshot.records;
  if (options.scope === 'selection') {
    if (state.selectedIds.length < 2) throw new CanvasValidationError('Select at least two shapes to run layout', 'LAYOUT_SCOPE_EMPTY');
    return records.filter(({ id }) => state.selectedIds.includes(id));
  }
  if (options.scope === 'frame') {
    if (!options.frameId) throw new CanvasValidationError('frameId is required for frame layout');
    const frame = records.find(({ id, type }) => id === options.frameId && type === 'frame');
    if (!frame) throw new CanvasValidationError('Layout frame does not exist', 'LAYOUT_FRAME_MISSING');
    const included = new Set([frame.id]);
    let changed = true;
    while (changed) {
      changed = false;
      records.forEach((record) => {
        if (!included.has(record.id) && included.has(record.parentId)) { included.add(record.id); changed = true; }
      });
    }
    included.delete(frame.id);
    return records.filter(({ id, hidden }) => included.has(id) && !hidden);
  }
  return records.filter(({ hidden }) => !hidden);
}

export function runLayoutRequest(request: LayoutRequest, signal?: AbortSignal): Promise<LayoutResult> {
  if (signal?.aborted) return Promise.reject(new DOMException('Layout cancelled', 'AbortError'));
  return import('./elkLayout.js').then(({ runElkLayout }) => runElkLayout(request, signal));
}

export function previewAutoLayout(engine: CanvasEngine, options: AutoLayoutOptions = {}): Promise<LayoutPreview> {
  const records = layoutRecords(engine, options);
  const nodeIds = new Set(records.filter(({ type }) => type !== 'arrow' && type !== 'line' && type !== 'freehand').map(({ id }) => id));
  const nodeRecords = records.filter(({ id }) => nodeIds.has(id));
  if (nodeRecords.length < 2) throw new CanvasValidationError('Layout requires at least two visible shapes', 'LAYOUT_SCOPE_EMPTY');
  if (options.scope === 'selection' && new Set(nodeRecords.map(({ parentId }) => parentId)).size > 1) {
    throw new CanvasValidationError('Selected shapes must share a parent for layout', 'LAYOUT_MIXED_PARENTS');
  }
  const requestedSpacing = options.spacing ?? 80;
  if (!Number.isFinite(requestedSpacing)) throw new CanvasValidationError('Layout spacing must be a finite number', 'LAYOUT_SPACING_INVALID');
  const request: LayoutRequest = {
    direction: options.direction ?? 'LR', alignment: options.alignment ?? 'automatic', spacing: Math.max(20, Math.min(500, requestedSpacing)),
    nodes: nodeRecords.map((record) => { const bounds = engine.registry.get(record.type).geometry.getBounds(record); return { id: record.id, parentId: nodeIds.has(record.parentId) ? record.parentId : ROOT_PARENT_ID, x: record.x, y: record.y, width: Math.max(1, bounds.width), height: Math.max(1, bounds.height), locked: record.locked }; }),
    edges: engine.getSnapshot().bindings.filter((binding) => binding.start && binding.end && nodeIds.has(binding.start.shapeId) && nodeIds.has(binding.end.shapeId)).map((binding) => ({ id: binding.id, source: binding.start!.shapeId, target: binding.end!.shapeId, connectorId: binding.connectorId })),
  };
  return runLayoutRequest(request, options.signal).then((result) => {
      const original = new Map(nodeRecords.map((record) => [record.id, record]));
      const raw = new Map(result.nodes.map(({ id, x, y }) => [id, { x, y }]));
      const offsets = new Map<string, { x: number; y: number }>();
      new Set(nodeRecords.map(({ parentId }) => parentId)).forEach((parentId) => {
        const siblings = nodeRecords.filter((record) => record.parentId === parentId && raw.has(record.id));
        if (!siblings.length) return;
        const originalX = Math.min(...siblings.map(({ x }) => x)); const originalY = Math.min(...siblings.map(({ y }) => y));
        const resultX = Math.min(...siblings.map(({ id }) => raw.get(id)!.x)); const resultY = Math.min(...siblings.map(({ id }) => raw.get(id)!.y));
        offsets.set(parentId, { x: originalX - resultX, y: originalY - resultY });
      });
      const positions = new Map(result.nodes.map((value) => {
        const record = original.get(value.id)!; const offset = offsets.get(record.parentId) ?? { x: 0, y: 0 };
        return [value.id, record.locked ? { x: record.x, y: record.y } : { x: value.x + offset.x, y: value.y + offset.y }] as const;
      }));
      const allRecords = new Map(engine.getSnapshot().records.map((record) => [record.id, positions.has(record.id) ? { ...record, ...positions.get(record.id)! } : record]));
      const connectorPoints = new Map<string, { x: number; y: number }[]>();
      engine.getSnapshot().bindings.forEach((binding) => {
        if (!binding.start || !binding.end || !nodeIds.has(binding.start.shapeId) || !nodeIds.has(binding.end.shapeId)) return;
        const connector = allRecords.get(binding.connectorId); const startRecord = allRecords.get(binding.start.shapeId); const endRecord = allRecords.get(binding.end.shapeId);
        if (!connector || !startRecord || !endRecord || connector.locked) return;
        const startWorld = getWorldTransform(startRecord.id, allRecords); const endWorld = getWorldTransform(endRecord.id, allRecords);
        const startBounds = engine.registry.get(startRecord.type).geometry.getBounds({ ...startRecord, ...startWorld });
        const endBounds = engine.registry.get(endRecord.type).geometry.getBounds({ ...endRecord, ...endWorld });
        const parentWorld = connector.parentId === ROOT_PARENT_ID ? { x: 0, y: 0, rotation: 0 } : getWorldTransform(connector.parentId, allRecords);
        const start = toLocalTransform(parentWorld, { x: startBounds.x + startBounds.width / 2, y: startBounds.y + startBounds.height / 2, rotation: 0 });
        const end = toLocalTransform(parentWorld, { x: endBounds.x + endBounds.width / 2, y: endBounds.y + endBounds.height / 2, rotation: 0 });
        const points = request.direction === 'LR' || request.direction === 'RL'
          ? [{ x: start.x, y: start.y }, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, { x: end.x, y: end.y }]
          : [{ x: start.x, y: start.y }, { x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }, { x: end.x, y: end.y }];
        connectorPoints.set(connector.id, points);
      });
      return {
        positions,
        connectorPoints,
      };
  });
}

export function applyAutoLayout(engine: CanvasEngine, preview: LayoutPreview): void {
  const records = new Map(engine.getSnapshot().records.map((record) => [record.id, record]));
  const commands: Parameters<CanvasEngine['dispatch']>[0][] = [];
  preview.positions.forEach((position, id) => { const record = records.get(id); if (record && !record.locked) commands.push({ type: 'shape.update', id, patch: position }); });
  preview.connectorPoints.forEach((points, id) => {
    const record = records.get(id); if (!record || record.locked || (record.type !== 'arrow' && record.type !== 'line')) return;
    const start = points[0]!; commands.push({ type: 'shape.update', id, patch: { x: start.x, y: start.y, props: { ...(record.props as Record<string, unknown>), edgeStyle: 'elbow', points: points.map((point) => ({ x: point.x - start.x, y: point.y - start.y })) } } });
  });
  if (commands.length) engine.dispatch({ type: 'batch', commands });
}
