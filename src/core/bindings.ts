import type { BindingRecord, ShapeRecord } from './model.js';
import type { ShapeRegistry } from './registry.js';
import { rotatePoint } from './transforms.js';

function center(record: ShapeRecord, registry: ShapeRegistry): { x: number; y: number } {
  const bounds = registry.get(record.type).geometry.getBounds(record); return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function resolveBindingGeometry(records: readonly ShapeRecord[], bindings: readonly BindingRecord[], registry: ShapeRegistry): ShapeRecord[] {
  const map = new Map(records.map((record) => [record.id, record]));
  bindings.forEach((binding) => {
    const connector = map.get(binding.connectorId); if (!connector || (connector.type !== 'line' && connector.type !== 'arrow')) return;
    const props = connector.props as Record<string, unknown> & { points: { x: number; y: number; pressure?: number }[] }; if (props.points.length < 2) return;
    const originalWorld = props.points.map((point) => { const rotated = rotatePoint(point, connector.rotation); return { ...point, x: connector.x + rotated.x, y: connector.y + rotated.y }; });
    const startShape = binding.start ? map.get(binding.start.shapeId) : undefined; const endShape = binding.end ? map.get(binding.end.shapeId) : undefined;
    const start = startShape ? center(startShape, registry) : originalWorld[0]!; const end = endShape ? center(endShape, registry) : originalWorld.at(-1)!;
    const points = originalWorld.map((point) => ({ ...point, x: point.x - start.x, y: point.y - start.y })); points[0] = { ...points[0]!, x: 0, y: 0 }; points[points.length - 1] = { ...points.at(-1)!, x: end.x - start.x, y: end.y - start.y };
    map.set(connector.id, { ...connector, x: start.x, y: start.y, rotation: 0, props: { ...props, points } });
  });
  return records.map((record) => map.get(record.id)!);
}
