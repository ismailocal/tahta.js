import type { BindingRecord, ShapeRecord } from './model.js';
import { CanvasValidationError } from './model.js';
import type { ConnectionPort, ShapeRegistry } from './registry.js';
import { rotatePoint } from './transforms.js';
import { elbowPath } from './connectorGeometry.js';

export interface NearestConnectionPort extends ConnectionPort {
  shapeId: string;
  distance: number;
}

function center(record: ShapeRecord, registry: ShapeRegistry): { x: number; y: number } {
  const bounds = registry.get(record.type).geometry.getBounds(record); return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function getConnectionPorts(record: ShapeRecord, registry: ShapeRegistry): readonly ConnectionPort[] {
  return registry.get(record.type).geometry.getConnectionPorts?.(record) ?? [];
}

export function getBindingPoint(record: ShapeRecord, portId: string | undefined, registry: ShapeRegistry): { x: number; y: number } {
  if (!portId) return center(record, registry);
  const port = getConnectionPorts(record, registry).find(({ id }) => id === portId);
  if (!port) throw new CanvasValidationError(`Port '${portId}' does not exist on shape '${record.id}'`, 'UNKNOWN_CONNECTION_PORT');
  return { x: port.x, y: port.y };
}

export function findNearestConnectionPort(
  records: readonly ShapeRecord[],
  point: { x: number; y: number },
  registry: ShapeRegistry,
  options: { excludeIds?: ReadonlySet<string>; maximumDistance?: number } = {},
): NearestConnectionPort | null {
  const excluded = options.excludeIds ?? new Set<string>();
  const maximumDistance = options.maximumDistance ?? 16;
  let nearest: NearestConnectionPort | null = null;
  for (const record of records) {
    if (excluded.has(record.id) || record.hidden || record.type === 'line' || record.type === 'arrow' || record.type === 'freehand') continue;
    for (const port of getConnectionPorts(record, registry)) {
      const distance = Math.hypot(point.x - port.x, point.y - port.y);
      if (distance > maximumDistance || (nearest && distance >= nearest.distance)) continue;
      nearest = { ...port, shapeId: record.id, distance };
    }
  }
  return nearest;
}

export function resolveBindingGeometry(records: readonly ShapeRecord[], bindings: readonly BindingRecord[], registry: ShapeRegistry): ShapeRecord[] {
  const map = new Map(records.map((record) => [record.id, record]));
  bindings.forEach((binding) => {
    const connector = map.get(binding.connectorId); if (!connector || (connector.type !== 'line' && connector.type !== 'arrow')) return;
    const props = connector.props as Record<string, unknown> & { points: { x: number; y: number; pressure?: number }[] }; if (props.points.length < 2) return;
    const originalWorld = props.points.map((point) => { const rotated = rotatePoint(point, connector.rotation); return { ...point, x: connector.x + rotated.x, y: connector.y + rotated.y }; });
    const startShape = binding.start ? map.get(binding.start.shapeId) : undefined; const endShape = binding.end ? map.get(binding.end.shapeId) : undefined;
    const start = startShape ? getBindingPoint(startShape, binding.start?.portId, registry) : originalWorld[0]!; const end = endShape ? getBindingPoint(endShape, binding.end?.portId, registry) : originalWorld.at(-1)!;
    let worldPoints = originalWorld.map((point) => ({ ...point })); worldPoints[0] = { ...worldPoints[0]!, ...start }; worldPoints[worldPoints.length - 1] = { ...worldPoints.at(-1)!, ...end };
    if (props.edgeStyle === 'elbow' && worldPoints.length === 2) worldPoints = elbowPath(start, end, startShape ? registry.get(startShape.type).geometry.getBounds(startShape) : undefined, endShape ? registry.get(endShape.type).geometry.getBounds(endShape) : undefined);
    const points = worldPoints.map((point) => ({ ...point, x: point.x - start.x, y: point.y - start.y })); points[0] = { ...points[0]!, x: 0, y: 0 }; points[points.length - 1] = { ...points.at(-1)!, x: end.x - start.x, y: end.y - start.y };
    map.set(connector.id, { ...connector, x: start.x, y: start.y, rotation: 0, props: { ...props, points } });
  });
  return records.map((record) => map.get(record.id)!);
}
