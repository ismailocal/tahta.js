import { z } from 'zod';
import type { ShapeRecord } from './model.js';
import { CanvasValidationError, canvasPointSchema } from './model.js';
import { ShapeRegistry, type ShapeDefinition } from './registry.js';

type BuiltinProps = Record<string, unknown>;
type SvgExporter = ShapeDefinition<BuiltinProps>['exportSvg'];

function escapeXml(value: unknown): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function numeric(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function exportValues(record: ShapeRecord<BuiltinProps>, offsetX: number, offsetY: number) {
  const x = record.x - offsetX;
  const y = record.y - offsetY;
  const width = numeric(record.props.width);
  const height = numeric(record.props.height);
  const left = width < 0 ? x + width : x;
  const top = height < 0 ? y + height : y;
  const stroke = escapeXml(record.props.stroke || '#64748b');
  const fill = escapeXml(record.props.fill && record.props.fill !== 'transparent' ? record.props.fill : 'none');
  const strokeWidth = Math.max(0, numeric(record.props.strokeWidth, 2));
  const opacity = Math.min(1, Math.max(0, record.opacity));
  const dash = record.props.strokeStyle === 'dashed' ? ' stroke-dasharray="10 8"' : record.props.strokeStyle === 'dotted' ? ' stroke-dasharray="2 7"' : '';
  return { x, y, width: Math.abs(width), height: Math.abs(height), left, top, stroke, fill, strokeWidth, opacity, dash };
}

function withText(body: string, record: ShapeRecord<BuiltinProps>, offsetX: number, offsetY: number): string {
  if (typeof record.props.text !== 'string' || record.props.text.length === 0) return body;
  const value = exportValues(record, offsetX, offsetY);
  const fontSize = Math.max(8, numeric(record.props.fontSize, 18));
  const textX = record.props.textAlign === 'center' ? value.left + value.width / 2 : record.props.textAlign === 'right' ? value.left + value.width - 12 : value.left + 12;
  const anchor = record.props.textAlign === 'center' ? 'middle' : record.props.textAlign === 'right' ? 'end' : 'start';
  const textY = record.type === 'text' ? value.top + fontSize : value.top + Math.max(fontSize + 10, value.height / 2);
  const tspans = record.props.text.split('\n').slice(0, 100).map((line, index) => `<tspan x="${textX}" dy="${index === 0 ? 0 : fontSize * 1.25}">${escapeXml(line)}</tspan>`).join('');
  return `${body}<text x="${textX}" y="${textY}" text-anchor="${anchor}" fill="${escapeXml(record.props.textColor || record.props.stroke || '#0f172a')}" font-family="${escapeXml(record.props.fontFamily || 'Inter, sans-serif')}" font-size="${fontSize}" opacity="${value.opacity}">${tspans}</text>`;
}

const rectangleExporter: SvgExporter = ({ record, offsetX, offsetY }) => {
  const v = exportValues(record, offsetX, offsetY);
  const radius = record.type === 'sticky-note' ? 4 : numeric(record.props.cornerRadius, 8);
  return withText(`<rect x="${v.left}" y="${v.top}" width="${v.width}" height="${v.height}" rx="${radius}" stroke="${v.stroke}" fill="${v.fill}" stroke-width="${v.strokeWidth}" opacity="${v.opacity}"${v.dash}/>`, record, offsetX, offsetY);
};
const ellipseExporter: SvgExporter = ({ record, offsetX, offsetY }) => {
  const v = exportValues(record, offsetX, offsetY);
  return withText(`<ellipse cx="${v.left + v.width / 2}" cy="${v.top + v.height / 2}" rx="${v.width / 2}" ry="${v.height / 2}" stroke="${v.stroke}" fill="${v.fill}" stroke-width="${v.strokeWidth}" opacity="${v.opacity}"${v.dash}/>`, record, offsetX, offsetY);
};
const diamondExporter: SvgExporter = ({ record, offsetX, offsetY }) => {
  const v = exportValues(record, offsetX, offsetY);
  return withText(`<polygon points="${v.left + v.width / 2},${v.top} ${v.left + v.width},${v.top + v.height / 2} ${v.left + v.width / 2},${v.top + v.height} ${v.left},${v.top + v.height / 2}" stroke="${v.stroke}" fill="${v.fill}" stroke-width="${v.strokeWidth}" opacity="${v.opacity}"${v.dash}/>`, record, offsetX, offsetY);
};
const triangleExporter: SvgExporter = ({ record, offsetX, offsetY }) => {
  const v = exportValues(record, offsetX, offsetY);
  return withText(`<polygon points="${v.left + v.width / 2},${v.top} ${v.left + v.width},${v.top + v.height} ${v.left},${v.top + v.height}" stroke="${v.stroke}" fill="${v.fill}" stroke-width="${v.strokeWidth}" opacity="${v.opacity}"${v.dash}/>`, record, offsetX, offsetY);
};
const pathExporter: SvgExporter = ({ record, offsetX, offsetY }) => {
  const v = exportValues(record, offsetX, offsetY);
  const points = Array.isArray(record.props.points) ? record.props.points as Array<{ x: number; y: number }> : [];
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${v.x + point.x} ${v.y + point.y}`).join(' ');
  const body = path ? `<path d="${path}" stroke="${v.stroke}" fill="none" stroke-width="${v.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${v.opacity}"${v.dash}/>` : '';
  return withText(body, record, offsetX, offsetY);
};
const textExporter: SvgExporter = ({ record, offsetX, offsetY }) => withText('', record, offsetX, offsetY);
const imageExporter: SvgExporter = ({ record, offsetX, offsetY, resolveAssetHref }) => {
  const v = exportValues(record, offsetX, offsetY);
  const source = typeof record.props.assetId === 'string' ? resolveAssetHref(record.props.assetId) : typeof record.props.imageSrc === 'string' ? record.props.imageSrc : '';
  if (!/^(?:data:image\/(?:png|jpeg|webp|gif);base64,|blob:)/i.test(source)) {
    throw new CanvasValidationError(`Image shape '${record.id}' has no exportable asset`, 'MISSING_ASSET');
  }
  return `<image x="${v.left}" y="${v.top}" width="${v.width}" height="${v.height}" href="${escapeXml(source)}" preserveAspectRatio="xMidYMid meet" opacity="${v.opacity}"/>`;
};

const exporters: Record<keyof typeof schemas, SvgExporter> = {
  rectangle: rectangleExporter,
  ellipse: ellipseExporter,
  diamond: diamondExporter,
  triangle: triangleExporter,
  'sticky-note': rectangleExporter,
  frame: rectangleExporter,
  text: textExporter,
  line: pathExporter,
  arrow: pathExporter,
  freehand: pathExporter,
  image: imageExporter,
  'db-table': rectangleExporter,
  'db-view': rectangleExporter,
  'db-enum': rectangleExporter,
};

const finite = z.number().finite();
const common = {
  seed: z.number().int().optional(),
  width: finite.optional(),
  height: finite.optional(),
  points: z.array(canvasPointSchema).max(100_000).optional(),
  text: z.string().max(1_000_000).optional(),
  imageSrc: z.string().max(25 * 1024 * 1024).optional(),
  stroke: z.string().max(256).optional(),
  fill: z.string().max(256).optional(),
  strokeWidth: finite.min(0).max(1_000).optional(),
  fontSize: finite.min(1).max(1_000).optional(),
  fontFamily: z.string().max(256).optional(),
  roughness: finite.min(0).max(100).optional(),
  fillStyle: z.string().max(100).optional(),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  edgeStyle: z.enum(['straight', 'elbow', 'curved']).optional(),
  startArrowhead: z.enum(['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar']).optional(),
  endArrowhead: z.enum(['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar']).optional(),
  roundness: z.enum(['sharp', 'round']).optional(),
  cornerRadius: finite.min(0).max(10_000).optional(),
  groupId: z.string().min(1).max(255).optional(),
  textColor: z.string().max(256).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  textVerticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  textPaddingX: finite.optional(),
  textPaddingY: finite.optional(),
};

const dbColumn = z.object({
  name: z.string().max(500),
  type: z.string().max(500),
  pk: z.boolean().optional(),
  fk: z.boolean().optional(),
  nullable: z.boolean().optional(),
}).strict();

const schemas = {
  rectangle: z.object(common).strict(),
  ellipse: z.object(common).strict(),
  diamond: z.object(common).strict(),
  triangle: z.object(common).strict(),
  'sticky-note': z.object(common).strict(),
  frame: z.object(common).strict(),
  text: z.object(common).strict(),
  line: z.object(common).strict(),
  arrow: z.object(common).strict(),
  freehand: z.object(common).strict(),
  image: z.object({
    ...common,
    assetId: z.string().uuid().optional(),
    dataURL: z.string().max(25 * 1024 * 1024).optional(),
    fileId: z.string().max(255).optional(),
  }).strict(),
  'db-table': z.object({ ...common, data: z.object({ tableName: z.string().max(500), columns: z.array(dbColumn).max(5_000) }).strict() }).strict(),
  'db-view': z.object({ ...common, data: z.object({ viewName: z.string().max(500), columns: z.array(dbColumn.pick({ name: true, type: true })).max(5_000) }).strict() }).strict(),
  'db-enum': z.object({ ...common, data: z.object({ enumName: z.string().max(500), values: z.array(z.string().max(500)).max(5_000) }).strict() }).strict(),
} as const;

function bounds(record: ShapeRecord<Record<string, unknown>>) {
  const width = typeof record.props.width === 'number' ? record.props.width : 0;
  const height = typeof record.props.height === 'number' ? record.props.height : 0;
  return { x: Math.min(record.x, record.x + width), y: Math.min(record.y, record.y + height), width: Math.abs(width), height: Math.abs(height) };
}

function connectionPorts(record: ShapeRecord<BuiltinProps>) {
  if (record.type === 'line' || record.type === 'arrow' || record.type === 'freehand' || record.type === 'text') return [];
  const box = bounds(record);
  if (record.type === 'db-table' || record.type === 'db-view' || record.type === 'db-enum') {
    const data = record.props.data as { columns?: unknown[]; values?: unknown[] } | undefined;
    const count = record.type === 'db-enum' ? data?.values?.length ?? 0 : data?.columns?.length ?? 0;
    return Array.from({ length: count }, (_, index) => {
      const y = record.y + 36 + index * 28 + 14;
      return [
        { id: `row-${index}-left`, x: box.x, y, direction: 'left' as const },
        { id: `row-${index}-right`, x: box.x + box.width, y, direction: 'right' as const },
      ];
    }).flat();
  }
  return [
    { id: 'top', x: box.x + box.width / 2, y: box.y, direction: 'up' as const },
    { id: 'right', x: box.x + box.width, y: box.y + box.height / 2, direction: 'right' as const },
    { id: 'bottom', x: box.x + box.width / 2, y: box.y + box.height, direction: 'down' as const },
    { id: 'left', x: box.x, y: box.y + box.height / 2, direction: 'left' as const },
  ];
}

function registerSchema(registry: ShapeRegistry, type: keyof typeof schemas): void {
  const definition: ShapeDefinition = {
    type,
    version: 1,
    schema: schemas[type],
    defaults: () => ({}),
    geometry: {
      getBounds: bounds,
      containsPoint: (record, candidate) => {
        const box = bounds(record as ShapeRecord<Record<string, unknown>>);
        return candidate.x >= box.x && candidate.x <= box.x + box.width && candidate.y >= box.y && candidate.y <= box.y + box.height;
      },
      getConnectionPorts: connectionPorts,
    },
    render: () => { throw new Error(`Shape '${type}' must be rendered through tahta.js/dom`); },
    exportSvg: exporters[type] as ShapeDefinition['exportSvg'],
  };
  registry.register(definition);
}

export function createBuiltinShapeRegistry(): ShapeRegistry {
  const registry = new ShapeRegistry();
  (Object.keys(schemas) as Array<keyof typeof schemas>).forEach((type) => registerSchema(registry, type));
  return registry;
}
