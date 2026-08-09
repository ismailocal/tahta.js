import { z } from 'zod';
import type { ShapeRecord } from '../core/model.js';
import { ShapeRegistry, type ShapeDefinition, type ShapeGeometry } from '../core/registry.js';
import { connectorRoute, connectorRouteBounds, connectorRouteMidpoint, connectorRouteSvgPath, pointToConnectorDistance, pointToSegmentDistance } from '../core/connectorGeometry.js';
import { richTextDocumentSchema, richTextFromString, type RichTextDocument } from '../core/richText.js';

const color = z.string().min(1).max(64);
const dimension = z.number().finite().positive().max(100_000);
const point = z.object({ x: z.number().finite(), y: z.number().finite(), pressure: z.number().min(0).max(1).optional() });

export { plainText, richTextDocumentSchema, richTextFromString, type RichTextDocument } from '../core/richText.js';

const baseBoxSchema = z.object({
  width: dimension,
  height: dimension,
  stroke: color,
  fill: color,
  strokeWidth: z.number().finite().min(0.5).max(32),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']),
  cornerRadius: z.number().finite().min(0).max(256),
  text: richTextDocumentSchema,
  textColor: color,
  fontSize: z.number().finite().min(8).max(256),
  textVerticalAlign: z.enum(['top', 'middle', 'bottom']),
  textPaddingX: z.number().finite().min(0).max(256),
  textPaddingY: z.number().finite().min(0).max(256),
});

type BoxProps = z.infer<typeof baseBoxSchema>;

const connectorSchema = z.object({
  points: z.array(point).min(2).max(100_000),
  stroke: color,
  strokeWidth: z.number().finite().min(0.5).max(32),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']),
  edgeStyle: z.enum(['straight', 'elbow', 'curved']),
  startArrowhead: z.enum(['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar']),
  endArrowhead: z.enum(['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar']),
  label: richTextDocumentSchema,
});

type ConnectorProps = z.infer<typeof connectorSchema>;

const freehandSchema = z.object({
  points: z.array(point).min(1).max(100_000),
  stroke: color,
  strokeWidth: z.number().finite().min(0.5).max(64),
});

type FreehandProps = z.infer<typeof freehandSchema>;

const imageSchema = z.object({
  width: dimension,
  height: dimension,
  assetId: z.uuid(),
  alt: z.string().max(1_000),
});

type ImageProps = z.infer<typeof imageSchema>;

const dbColumnSchema = z.object({
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  dataType: z.string().min(1).max(255),
  primaryKey: z.boolean(),
  nullable: z.boolean(),
});

const databaseSchema = baseBoxSchema.extend({
  name: z.string().min(1).max(255),
  columns: z.array(dbColumnSchema).max(500),
});

type DatabaseProps = z.infer<typeof databaseSchema>;

function databaseGeometry(): ShapeGeometry<DatabaseProps> {
  const base = boxGeometry<DatabaseProps>(); return { ...base, getConnectionPorts: (record) => record.props.columns.flatMap((column, index) => {
    void column; const localY = 40 + index * 24 + 12; if (localY > record.props.height) return [];
    const points = [{ id: `row-${index}-left`, x: 0, direction: 'left' as const }, { id: `row-${index}-right`, x: record.props.width, direction: 'right' as const }];
    return points.map((port) => { const rotated = { x: port.x * Math.cos(record.rotation) - localY * Math.sin(record.rotation), y: port.x * Math.sin(record.rotation) + localY * Math.cos(record.rotation) }; return { ...port, y: record.y + rotated.y, x: record.x + rotated.x }; });
  }) };
}

const tableSchema = z.object({
  width: dimension,
  height: dimension,
  columns: z.array(z.object({ id: z.string().min(1).max(255), title: z.string().max(1_000), width: z.number().min(40).max(2_000) })).max(100),
  rows: z.array(z.object({ id: z.string().min(1).max(255), cells: z.record(z.string(), z.string().max(20_000)) })).max(5_000),
  header: z.boolean(),
  stroke: color,
  fill: color,
  textColor: color,
  fontSize: z.number().min(8).max(72),
});

type TableProps = z.infer<typeof tableSchema>;

const linkCardSchema = z.object({
  width: dimension,
  height: dimension,
  url: z.url().max(2_048).refine((value) => { const protocol = new URL(value).protocol; return protocol === 'http:' || protocol === 'https:'; }, 'Only HTTP and HTTPS links are allowed'),
  title: z.string().max(1_000),
  description: z.string().max(5_000),
  siteName: z.string().max(500),
  imageAssetId: z.uuid().nullable(),
  faviconAssetId: z.uuid().nullable(),
  fetchedAt: z.number().int().nonnegative(),
});

type LinkCardProps = z.infer<typeof linkCardSchema>;

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character] ?? character);
}

function dash(style: BoxProps['strokeStyle'] | ConnectorProps['strokeStyle']): number[] {
  if (style === 'dashed') return [10, 7];
  if (style === 'dotted') return [2, 6];
  return [];
}

function withRecordTransform<Props>(
  context: CanvasRenderingContext2D,
  record: ShapeRecord<Props>,
  render: () => void,
): void {
  context.save();
  context.globalAlpha *= record.opacity;
  context.translate(record.x, record.y);
  context.rotate(record.rotation);
  render();
  context.restore();
}

function inversePoint<Props>(record: ShapeRecord<Props>, value: { x: number; y: number }) {
  const dx = value.x - record.x;
  const dy = value.y - record.y;
  const cosine = Math.cos(-record.rotation);
  const sine = Math.sin(-record.rotation);
  return { x: dx * cosine - dy * sine, y: dx * sine + dy * cosine };
}

function rotatedBoxBounds<Props extends { width: number; height: number }>(record: ShapeRecord<Props>) {
  const corners = [
    { x: 0, y: 0 }, { x: record.props.width, y: 0 },
    { x: record.props.width, y: record.props.height }, { x: 0, y: record.props.height },
  ].map((point) => {
    const rotated = { x: point.x * Math.cos(record.rotation) - point.y * Math.sin(record.rotation), y: point.x * Math.sin(record.rotation) + point.y * Math.cos(record.rotation) };
    return { x: record.x + rotated.x, y: record.y + rotated.y };
  });
  const xs = corners.map(({ x }) => x); const ys = corners.map(({ y }) => y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function cardinalPorts<Props extends { width: number; height: number }>(record: ShapeRecord<Props>) {
  return [
    { id: 'top', x: record.props.width / 2, y: 0, direction: 'up' as const },
    { id: 'right', x: record.props.width, y: record.props.height / 2, direction: 'right' as const },
    { id: 'bottom', x: record.props.width / 2, y: record.props.height, direction: 'down' as const },
    { id: 'left', x: 0, y: record.props.height / 2, direction: 'left' as const },
  ].map((port) => {
    const rotated = { x: port.x * Math.cos(record.rotation) - port.y * Math.sin(record.rotation), y: port.x * Math.sin(record.rotation) + port.y * Math.cos(record.rotation) };
    return { ...port, x: record.x + rotated.x, y: record.y + rotated.y };
  });
}

function boxGeometry<Props extends { width: number; height: number }>(): ShapeGeometry<Props> {
  return {
    getBounds: rotatedBoxBounds,
    containsPoint: (record, value) => {
      const local = inversePoint(record, value);
      return local.x >= 0 && local.y >= 0 && local.x <= record.props.width && local.y <= record.props.height;
    },
    getConnectionPorts: cardinalPorts,
  };
}

function ellipseGeometry<Props extends { width: number; height: number }>(): ShapeGeometry<Props> {
  return { getBounds: rotatedBoxBounds, containsPoint: (record, value) => { const local = inversePoint(record, value); const x = (local.x - record.props.width / 2) / (record.props.width / 2); const y = (local.y - record.props.height / 2) / (record.props.height / 2); return x * x + y * y <= 1; }, getConnectionPorts: cardinalPorts };
}

function diamondGeometry<Props extends { width: number; height: number }>(): ShapeGeometry<Props> {
  return { getBounds: rotatedBoxBounds, containsPoint: (record, value) => { const local = inversePoint(record, value); return Math.abs(local.x - record.props.width / 2) / (record.props.width / 2) + Math.abs(local.y - record.props.height / 2) / (record.props.height / 2) <= 1; }, getConnectionPorts: cardinalPorts };
}

function triangleGeometry<Props extends { width: number; height: number }>(): ShapeGeometry<Props> {
  return {
    getBounds: rotatedBoxBounds,
    containsPoint: (record, value) => { const point = inversePoint(record, value); const first = { x: record.props.width / 2, y: 0 }; const second = { x: record.props.width, y: record.props.height }; const third = { x: 0, y: record.props.height }; const denominator = (second.y - third.y) * (first.x - third.x) + (third.x - second.x) * (first.y - third.y); const a = ((second.y - third.y) * (point.x - third.x) + (third.x - second.x) * (point.y - third.y)) / denominator; const b = ((third.y - first.y) * (point.x - third.x) + (first.x - third.x) * (point.y - third.y)) / denominator; const c = 1 - a - b; return a >= 0 && b >= 0 && c >= 0; },
    getConnectionPorts: (record) => {
      const points = [
        { id: 'top', x: record.props.width / 2, y: 0, direction: 'up' as const }, { id: 'right', x: record.props.width * 0.75, y: record.props.height / 2, direction: 'right' as const },
        { id: 'bottom', x: record.props.width / 2, y: record.props.height, direction: 'down' as const }, { id: 'left', x: record.props.width * 0.25, y: record.props.height / 2, direction: 'left' as const },
      ]; return points.map((port) => { const rotated = { x: port.x * Math.cos(record.rotation) - port.y * Math.sin(record.rotation), y: port.x * Math.sin(record.rotation) + port.y * Math.cos(record.rotation) }; return { ...port, x: record.x + rotated.x, y: record.y + rotated.y }; });
    },
  };
}

function svgTransform(record: ShapeRecord): string {
  return `translate(${record.x} ${record.y}) rotate(${record.rotation * 180 / Math.PI})`;
}

function renderText(
  context: CanvasRenderingContext2D,
  text: RichTextDocument,
  options: { x: number; y: number; width: number; height?: number; color: string; fontSize: number; align?: CanvasTextAlign; verticalAlign?: 'top' | 'middle' | 'bottom' },
): void {
  context.fillStyle = options.color;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  const lineCount = Math.max(1, text.content.reduce((count, block) => count + Math.max(1, block.content.reduce((lines, run) => lines + run.text.split('\n').length - 1, 1)), 0));
  const lineHeight = options.fontSize * 1.3; const totalHeight = lineCount * lineHeight; const availableHeight = options.height ?? totalHeight;
  const startY = options.verticalAlign === 'bottom' ? options.y + availableHeight - totalHeight : options.verticalAlign === 'middle' ? options.y + (availableHeight - totalHeight) / 2 : options.y;
  let visualLine = 0;
  let orderedItemNumber = 0;
  text.content.forEach((block) => {
    orderedItemNumber = block.type === 'ordered-item' ? orderedItemNumber + 1 : 0;
    const prefix = block.type === 'bullet-item' ? '• ' : block.type === 'ordered-item' ? `${orderedItemNumber}. ` : '';
    const lines: typeof block.content[] = [[]];
    block.content.forEach((run) => run.text.split('\n').forEach((value, index) => { if (value) lines.at(-1)!.push({ ...run, text: value }); if (index < run.text.split('\n').length - 1) lines.push([]); }));
    if (prefix) lines[0]!.unshift({ text: prefix, marks: [] });
    lines.forEach((runs) => {
      const widths = runs.map((run) => { const bold = run.marks.some(({ type }) => type === 'bold'); const italic = run.marks.some(({ type }) => type === 'italic'); const code = run.marks.some(({ type }) => type === 'code'); context.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${options.fontSize}px ${code ? 'ui-monospace, monospace' : 'Inter, system-ui, sans-serif'}`; return context.measureText(run.text).width; });
      const totalWidth = widths.reduce((sum, width) => sum + width, 0); const align = block.align ?? options.align ?? 'left'; let x = align === 'center' ? options.x + (options.width - totalWidth) / 2 : align === 'right' ? options.x + options.width - totalWidth : options.x;
      runs.forEach((run, runIndex) => { const bold = run.marks.some(({ type }) => type === 'bold'); const italic = run.marks.some(({ type }) => type === 'italic'); const code = run.marks.some(({ type }) => type === 'code'); context.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${options.fontSize}px ${code ? 'ui-monospace, monospace' : 'Inter, system-ui, sans-serif'}`; const y = startY + visualLine * lineHeight; context.fillText(run.text, x, y, Math.max(0, options.x + options.width - x)); if (run.marks.some(({ type }) => type === 'strike')) { context.beginPath(); context.moveTo(x, y + options.fontSize * .55); context.lineTo(x + widths[runIndex]!, y + options.fontSize * .55); context.stroke(); } x += widths[runIndex]!; });
      visualLine++;
    });
  });
}

function richTextSvg(text: RichTextDocument, options: { x: number; y: number; width: number; height?: number; color: string; fontSize: number; verticalAlign?: 'top' | 'middle' | 'bottom' }): string {
  let visualLine = 0;
  let orderedItemNumber = 0;
  const lineCount = Math.max(1, text.content.reduce((count, block) => count + Math.max(1, block.content.reduce((lines, run) => lines + run.text.split('\n').length - 1, 1)), 0)); const lineHeight = options.fontSize * 1.3; const totalHeight = lineCount * lineHeight; const availableHeight = options.height ?? totalHeight; const startY = options.verticalAlign === 'bottom' ? options.y + availableHeight - totalHeight : options.verticalAlign === 'middle' ? options.y + (availableHeight - totalHeight) / 2 : options.y;
  return text.content.flatMap((block) => {
    const anchor = block.align === 'center' ? 'middle' : block.align === 'right' ? 'end' : 'start'; const x = block.align === 'center' ? options.x + options.width / 2 : block.align === 'right' ? options.x + options.width : options.x;
    orderedItemNumber = block.type === 'ordered-item' ? orderedItemNumber + 1 : 0;
    const prefix = block.type === 'bullet-item' ? '• ' : block.type === 'ordered-item' ? `${orderedItemNumber}. ` : '';
    const lines: typeof block.content[] = [[]];
    block.content.forEach((run) => { const parts = run.text.split('\n'); parts.forEach((value, index) => { if (value) lines.at(-1)!.push({ ...run, text: value }); if (index < parts.length - 1) lines.push([]); }); });
    if (prefix) lines[0]!.unshift({ text: prefix, marks: [] });
    return lines.map((line) => {
      const runs = line.map((run) => { const attributes = [`fill="${escapeXml(options.color)}"`]; if (run.marks.some(({ type }) => type === 'bold')) attributes.push('font-weight="700"'); if (run.marks.some(({ type }) => type === 'italic')) attributes.push('font-style="italic"'); if (run.marks.some(({ type }) => type === 'strike')) attributes.push('text-decoration="line-through"'); if (run.marks.some(({ type }) => type === 'code')) attributes.push('font-family="ui-monospace, monospace"'); const value = `<tspan ${attributes.join(' ')}>${escapeXml(run.text)}</tspan>`; const link = run.marks.find(({ type }) => type === 'link'); return link?.type === 'link' ? `<a href="${escapeXml(link.href)}" rel="noopener noreferrer">${value}</a>` : value; }).join('');
      return `<text x="${x}" y="${startY + visualLine++ * lineHeight}" text-anchor="${anchor}" dominant-baseline="hanging" font-size="${options.fontSize}">${runs}</text>`;
    });
  }).join('');
}

function boxSvg(record: ShapeRecord<BoxProps>, element: string): string {
  const text = richTextSvg(record.props.text, { x: record.props.textPaddingX, y: record.props.textPaddingY, width: Math.max(0, record.props.width - record.props.textPaddingX * 2), height: Math.max(0, record.props.height - record.props.textPaddingY * 2), color: record.props.textColor, fontSize: record.props.fontSize, verticalAlign: record.props.textVerticalAlign });
  return `<g transform="${svgTransform(record)}" opacity="${record.opacity}">${element}${text}</g>`;
}

function createBoxDefinition<Props extends BoxProps>(
  type: string,
  schema: z.ZodType<Props>,
  defaults: () => Props,
  path: (context: CanvasRenderingContext2D, props: Props) => void,
  svgElement: (props: Props) => string,
  extraProperties: ShapeDefinition<Props>['properties'] = [],
  geometry: ShapeGeometry<Props> = boxGeometry(),
): ShapeDefinition<Props> {
  return {
    type,
    version: 1,
    schema,
    defaults,
    geometry,
    render: ({ context, record }) => withRecordTransform(context, record, () => {
      context.beginPath();
      path(context, record.props);
      context.fillStyle = record.props.fill;
      context.strokeStyle = record.props.stroke;
      context.lineWidth = record.props.strokeWidth;
      context.setLineDash(dash(record.props.strokeStyle));
      context.fill();
      context.stroke();
      renderText(context, record.props.text, {
        x: record.props.textPaddingX, y: record.props.textPaddingY, width: Math.max(0, record.props.width - record.props.textPaddingX * 2), height: Math.max(0, record.props.height - record.props.textPaddingY * 2),
        color: record.props.textColor, fontSize: record.props.fontSize, align: 'center', verticalAlign: record.props.textVerticalAlign,
      });
    }),
    exportSvg: ({ record }) => boxSvg(record, svgElement(record.props)),
    properties: [
      { key: 'width', label: 'Width', control: 'number' }, { key: 'height', label: 'Height', control: 'number' },
      { key: 'fill', label: 'Fill', control: 'color' }, { key: 'stroke', label: 'Stroke', control: 'color' },
      { key: 'strokeWidth', label: 'Stroke width', control: 'number' },
      { key: 'strokeStyle', label: 'Stroke style', control: 'select', options: ['solid', 'dashed', 'dotted'] },
      { key: 'opacity', label: 'Opacity', control: 'number', scope: 'record' },
      ...extraProperties,
    ],
  };
}

const baseBoxDefaults = (): BoxProps => ({
  width: 180,
  height: 100,
  stroke: '#64748b',
  fill: 'transparent',
  strokeWidth: 1.8,
  strokeStyle: 'solid',
  cornerRadius: 12,
  text: richTextFromString('', 'center'),
  textColor: '#475569',
  fontSize: 20,
  textVerticalAlign: 'middle',
  textPaddingX: 8,
  textPaddingY: 8,
});

const rectangle = createBoxDefinition(
  'rectangle',
  baseBoxSchema,
  baseBoxDefaults,
  (context, props) => context.roundRect(0, 0, props.width, props.height, Math.min(props.cornerRadius, props.width / 2, props.height / 2)),
  (props) => `<rect width="${props.width}" height="${props.height}" rx="${props.cornerRadius}" fill="${escapeXml(props.fill)}" stroke="${escapeXml(props.stroke)}" stroke-width="${props.strokeWidth}" />`,
);

const ellipse = createBoxDefinition(
  'ellipse',
  baseBoxSchema,
  baseBoxDefaults,
  (context, props) => context.ellipse(props.width / 2, props.height / 2, props.width / 2, props.height / 2, 0, 0, Math.PI * 2),
  (props) => `<ellipse cx="${props.width / 2}" cy="${props.height / 2}" rx="${props.width / 2}" ry="${props.height / 2}" fill="${escapeXml(props.fill)}" stroke="${escapeXml(props.stroke)}" stroke-width="${props.strokeWidth}" />`, [], ellipseGeometry(),
);

const diamond = createBoxDefinition(
  'diamond',
  baseBoxSchema,
  baseBoxDefaults,
  (context, props) => {
    context.moveTo(props.width / 2, 0); context.lineTo(props.width, props.height / 2);
    context.lineTo(props.width / 2, props.height); context.lineTo(0, props.height / 2); context.closePath();
  },
  (props) => `<path d="M ${props.width / 2} 0 L ${props.width} ${props.height / 2} L ${props.width / 2} ${props.height} L 0 ${props.height / 2} Z" fill="${escapeXml(props.fill)}" stroke="${escapeXml(props.stroke)}" stroke-width="${props.strokeWidth}" />`, [], diamondGeometry(),
);

const triangle = createBoxDefinition(
  'triangle',
  baseBoxSchema,
  baseBoxDefaults,
  (context, props) => { context.moveTo(props.width / 2, 0); context.lineTo(props.width, props.height); context.lineTo(0, props.height); context.closePath(); },
  (props) => `<path d="M ${props.width / 2} 0 L ${props.width} ${props.height} L 0 ${props.height} Z" fill="${escapeXml(props.fill)}" stroke="${escapeXml(props.stroke)}" stroke-width="${props.strokeWidth}" />`, [], triangleGeometry(),
);

const stickySchema = baseBoxSchema.extend({ tags: z.string().max(2_048) });
const sticky = createBoxDefinition(
  'sticky-note',
  stickySchema,
  () => ({ ...baseBoxDefaults(), width: 200, height: 200, fill: '#fde047', stroke: '#ca8a04', strokeWidth: 1, cornerRadius: 4, textPaddingX: 16, textPaddingY: 16, tags: '' }),
  (context, props) => context.roundRect(0, 0, props.width, props.height, 8),
  (props) => `<rect width="${props.width}" height="${props.height}" rx="8" fill="${escapeXml(props.fill)}" stroke="${escapeXml(props.stroke)}" stroke-width="${props.strokeWidth}" />`,
  [{ key: 'tags', label: 'Tags (comma separated)', control: 'text' }],
);

const frame = createBoxDefinition(
  'frame',
  baseBoxSchema,
  () => ({ ...baseBoxDefaults(), width: 720, height: 405, fill: 'transparent', stroke: '#94a3b8', strokeWidth: 1.5, strokeStyle: 'dashed', text: richTextFromString('Yeni bölüm', 'left'), textVerticalAlign: 'top' }),
  (context, props) => context.roundRect(0, 0, props.width, props.height, 8),
  (props) => `<rect width="${props.width}" height="${props.height}" rx="8" fill="${escapeXml(props.fill)}" stroke="${escapeXml(props.stroke)}" stroke-width="${props.strokeWidth}" stroke-dasharray="10 7" />`,
);

const groupSchema = z.object({ width: dimension, height: dimension });
const group: ShapeDefinition<z.infer<typeof groupSchema>> = {
  type: 'group', version: 1, schema: groupSchema, defaults: () => ({ width: 1, height: 1 }), geometry: boxGeometry(),
  render: () => undefined,
  exportSvg: ({ record }) => `<g transform="${svgTransform(record)}" data-tahta-group="${escapeXml(record.id)}"></g>`,
};

const textDefinition: ShapeDefinition<BoxProps> = {
  ...createBoxDefinition(
    'text',
    baseBoxSchema,
    () => ({ ...baseBoxDefaults(), width: 240, height: 60, stroke: 'transparent', fill: 'transparent', fontSize: 24, text: richTextFromString('', 'left'), textVerticalAlign: 'top', textPaddingX: 0, textPaddingY: 0 }),
    (context, props) => context.rect(0, 0, props.width, props.height),
    () => '',
  ),
  render: ({ context, record }) => withRecordTransform(context, record, () => renderText(context, record.props.text, {
    x: 0, y: 0, width: record.props.width, color: record.props.textColor, fontSize: record.props.fontSize,
  })),
  exportSvg: ({ record }) => `<g transform="${svgTransform(record)}" opacity="${record.opacity}">${richTextSvg(record.props.text, { x: 0, y: 0, width: record.props.width, color: record.props.textColor, fontSize: record.props.fontSize })}</g>`,
};

function connectorPath(context: CanvasRenderingContext2D, props: ConnectorProps): void {
  const route = connectorRoute(props.points, props.edgeStyle);
  const first = route.points[0]; if (!first) return;
  context.moveTo(first.x, first.y);
  if (route.kind === 'quadratic' && route.control) context.quadraticCurveTo(route.control.x, route.control.y, route.points[1]!.x, route.points[1]!.y);
  else route.points.slice(1).forEach((value) => context.lineTo(value.x, value.y));
}

function drawArrowhead(context: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, style: ConnectorProps['endArrowhead']): void {
  if (style === 'none') return;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  context.save(); context.translate(to.x, to.y); context.rotate(angle);
  context.beginPath();
  if (style === 'circle') context.arc(-6, 0, 5, 0, Math.PI * 2);
  else if (style === 'bar') { context.moveTo(0, -7); context.lineTo(0, 7); }
  else if (style === 'diamond') { context.moveTo(0, 0); context.lineTo(-7, -5); context.lineTo(-14, 0); context.lineTo(-7, 5); context.closePath(); }
  else { context.moveTo(0, 0); context.lineTo(-12, -7); context.lineTo(-9, 0); context.lineTo(-12, 7); context.closePath(); }
  context.fill(); context.stroke(); context.restore();
}

function svgArrowhead(from: { x: number; y: number }, to: { x: number; y: number }, style: ConnectorProps['endArrowhead'], colorValue: string): string {
  if (style === 'none') return ''; const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI; const transform = `translate(${to.x} ${to.y}) rotate(${angle})`; const colorValueEscaped = escapeXml(colorValue);
  if (style === 'circle') return `<circle transform="${transform}" cx="-6" cy="0" r="5" fill="${colorValueEscaped}"/>`;
  if (style === 'bar') return `<path transform="${transform}" d="M 0 -7 L 0 7" fill="none" stroke="${colorValueEscaped}" stroke-width="2"/>`;
  if (style === 'diamond') return `<path transform="${transform}" d="M 0 0 L -7 -5 L -14 0 L -7 5 Z" fill="${colorValueEscaped}" stroke="${colorValueEscaped}"/>`;
  if (style === 'arrow') return `<path transform="${transform}" d="M -12 -7 L 0 0 L -12 7" fill="none" stroke="${colorValueEscaped}" stroke-width="2"/>`;
  return `<path transform="${transform}" d="M 0 0 L -12 -7 L -9 0 L -12 7 Z" fill="${colorValueEscaped}" stroke="${colorValueEscaped}"/>`;
}

function connectorDefinition(type: 'line' | 'arrow'): ShapeDefinition<ConnectorProps> {
  return {
    type,
    version: 1,
    schema: connectorSchema,
    defaults: () => ({
      points: [{ x: 0, y: 0 }, { x: 160, y: 0 }], stroke: '#64748b', strokeWidth: 1.8,
      strokeStyle: 'solid', edgeStyle: 'straight', startArrowhead: 'none',
      endArrowhead: type === 'arrow' ? 'arrow' : 'none', label: richTextFromString(''),
    }),
    geometry: {
      getBounds: (record) => {
        const bounds = connectorRouteBounds(connectorRoute(record.props.points, record.props.edgeStyle));
        const padding = Math.max(20, record.props.strokeWidth * 2);
        return { x: record.x + bounds.x - padding, y: record.y + bounds.y - padding, width: Math.max(1, bounds.width) + padding * 2, height: Math.max(1, bounds.height) + padding * 2 };
      },
      containsPoint: (record, value) => {
        const local = inversePoint(record, value);
        return pointToConnectorDistance(local, connectorRoute(record.props.points, record.props.edgeStyle)) <= Math.max(8, record.props.strokeWidth * 2);
      },
    },
    render: ({ context, record }) => withRecordTransform(context, record, () => {
      context.beginPath(); connectorPath(context, record.props);
      context.strokeStyle = record.props.stroke; context.fillStyle = record.props.stroke;
      context.lineWidth = record.props.strokeWidth; context.setLineDash(dash(record.props.strokeStyle)); context.stroke();
      const points = record.props.points; const route = connectorRoute(points, record.props.edgeStyle);
      if (route.points.length >= 2) {
        const startDirection = route.kind === 'quadratic' && route.control ? route.control : route.points[1]!;
        const endDirection = route.kind === 'quadratic' && route.control ? route.control : route.points.at(-2)!;
        drawArrowhead(context, startDirection, route.points[0]!, record.props.startArrowhead);
        drawArrowhead(context, endDirection, route.points.at(-1)!, record.props.endArrowhead);
      }
      const middle = connectorRouteMidpoint(route);
      renderText(context, record.props.label, { x: middle.x - 100, y: middle.y - 18, width: 200, color: record.props.stroke, fontSize: 14, align: 'center' });
    }),
    exportSvg: ({ record }) => {
      const points = record.props.points; const route = connectorRoute(points, record.props.edgeStyle); const path = connectorRouteSvgPath(route);
      const dashArray = dash(record.props.strokeStyle).join(' '); const middle = connectorRouteMidpoint(route);
      const startDirection = route.kind === 'quadratic' && route.control ? route.control : route.points[1]!; const endDirection = route.kind === 'quadratic' && route.control ? route.control : route.points.at(-2)!;
      return `<g transform="${svgTransform(record)}" opacity="${record.opacity}"><path d="${path}" fill="none" stroke="${escapeXml(record.props.stroke)}" stroke-width="${record.props.strokeWidth}"${dashArray ? ` stroke-dasharray="${dashArray}"` : ''}/>${svgArrowhead(startDirection, route.points[0]!, record.props.startArrowhead, record.props.stroke)}${svgArrowhead(endDirection, route.points.at(-1)!, record.props.endArrowhead, record.props.stroke)}${richTextSvg(record.props.label, { x: middle.x - 100, y: middle.y - 18, width: 200, color: record.props.stroke, fontSize: 14 })}</g>`;
    },
    properties: [
      { key: 'stroke', label: 'Stroke', control: 'color' }, { key: 'strokeWidth', label: 'Stroke width', control: 'number' },
      { key: 'strokeStyle', label: 'Stroke style', control: 'select', options: ['solid', 'dashed', 'dotted'] },
      { key: 'edgeStyle', label: 'Edge style', control: 'select', options: ['straight', 'elbow', 'curved'] },
      { key: 'startArrowhead', label: 'Start', control: 'select', options: ['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar'] },
      { key: 'endArrowhead', label: 'End', control: 'select', options: ['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar'] },
      { key: 'opacity', label: 'Opacity', control: 'number', scope: 'record' },
    ],
  };
}

const freehand: ShapeDefinition<FreehandProps> = {
  type: 'freehand', version: 1, schema: freehandSchema,
  defaults: () => ({ points: [{ x: 0, y: 0 }], stroke: '#64748b', strokeWidth: 1.8 }),
  geometry: {
    getBounds: (record) => {
      const xs = record.props.points.map(({ x }) => x); const ys = record.props.points.map(({ y }) => y);
      return { x: record.x + Math.min(...xs), y: record.y + Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    },
    containsPoint: (record, value) => {
      const local = inversePoint(record, value);
      const threshold = record.props.strokeWidth * 2 + 6;
      if (record.props.points.length === 1) return Math.hypot(record.props.points[0]!.x - local.x, record.props.points[0]!.y - local.y) <= threshold;
      return record.props.points.slice(1).some((point, index) => pointToSegmentDistance(local, record.props.points[index]!, point) <= threshold);
    },
  },
  render: ({ context, record }) => withRecordTransform(context, record, () => {
    const first = record.props.points[0]; if (!first) return;
    context.beginPath(); context.moveTo(first.x, first.y); record.props.points.slice(1).forEach(({ x, y }) => context.lineTo(x, y));
    context.strokeStyle = record.props.stroke; context.lineWidth = record.props.strokeWidth; context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke();
  }),
  exportSvg: ({ record }) => `<polyline transform="${svgTransform(record)}" points="${record.props.points.map(({ x, y }) => `${x},${y}`).join(' ')}" fill="none" stroke="${escapeXml(record.props.stroke)}" stroke-width="${record.props.strokeWidth}" opacity="${record.opacity}" />`,
  properties: [{ key: 'stroke', label: 'Stroke', control: 'color' }, { key: 'strokeWidth', label: 'Stroke width', control: 'number' }, { key: 'opacity', label: 'Opacity', control: 'number', scope: 'record' }],
};

const image: ShapeDefinition<ImageProps> = {
  type: 'image', version: 1, schema: imageSchema, defaults: () => { throw new Error('Image creation requires an uploaded asset'); },
  geometry: boxGeometry(),
  render: ({ context, record, getImage }) => withRecordTransform(context, record, () => {
    const source = getImage(record.props.assetId);
    if (!source) return;
    context.drawImage(source, 0, 0, record.props.width, record.props.height);
  }),
  exportSvg: ({ record, resolveAssetHref }) => `<image transform="${svgTransform(record)}" href="${escapeXml(resolveAssetHref(record.props.assetId))}" width="${record.props.width}" height="${record.props.height}" opacity="${record.opacity}"><title>${escapeXml(record.props.alt)}</title></image>`,
};

function databaseDefinition(type: 'db-table' | 'db-view' | 'db-enum'): ShapeDefinition<DatabaseProps> {
  return {
    type, version: 1, schema: databaseSchema,
    defaults: () => ({ ...baseBoxDefaults(), width: 300, height: 220, name: type === 'db-view' ? 'View' : type === 'db-enum' ? 'Enum' : 'Table', columns: [] }),
    geometry: databaseGeometry(),
    render: ({ context, record }) => withRecordTransform(context, record, () => {
      const props = record.props; context.fillStyle = props.fill; context.strokeStyle = props.stroke; context.lineWidth = props.strokeWidth;
      context.beginPath(); context.roundRect(0, 0, props.width, props.height, 10); context.fill(); context.stroke();
      context.fillStyle = props.stroke; context.fillRect(0, 0, props.width, 40);
      context.fillStyle = '#ffffff'; context.font = `600 ${props.fontSize}px Inter, sans-serif`; context.fillText(props.name, 12, 12, props.width - 24);
      context.fillStyle = props.textColor; context.font = `14px Inter, sans-serif`;
      props.columns.forEach((column, index) => context.fillText(`${column.primaryKey ? 'PK ' : ''}${column.name}: ${column.dataType}`, 12, 54 + index * 24, props.width - 24));
    }),
    exportSvg: ({ record }) => {
      const props = record.props;
      const rows = props.columns.map((column, index) => `<text x="12" y="${70 + index * 24}" fill="${escapeXml(props.textColor)}">${escapeXml(`${column.primaryKey ? 'PK ' : ''}${column.name}: ${column.dataType}`)}</text>`).join('');
      return `<g transform="${svgTransform(record)}" opacity="${record.opacity}"><rect width="${props.width}" height="${props.height}" rx="10" fill="${escapeXml(props.fill)}" stroke="${escapeXml(props.stroke)}"/><rect width="${props.width}" height="40" fill="${escapeXml(props.stroke)}"/><text x="12" y="26" fill="#fff">${escapeXml(props.name)}</text>${rows}</g>`;
    },
  };
}

const table: ShapeDefinition<TableProps> = {
  type: 'table', version: 1, schema: tableSchema,
  defaults: () => ({
    width: 600, height: 300, header: true, stroke: '#cbd5e1', fill: '#ffffff', textColor: '#0f172a', fontSize: 14,
    columns: [{ id: crypto.randomUUID(), title: 'Column 1', width: 200 }], rows: [],
  }),
  geometry: boxGeometry(),
  render: ({ context, record }) => withRecordTransform(context, record, () => {
    const props = record.props; const rowHeight = 36;
    context.fillStyle = props.fill; context.strokeStyle = props.stroke; context.fillRect(0, 0, props.width, props.height); context.strokeRect(0, 0, props.width, props.height);
    let x = 0; context.font = `${props.fontSize}px Inter, sans-serif`; context.fillStyle = props.textColor; context.textBaseline = 'middle';
    props.columns.forEach((column) => {
      if (props.header) { context.fillStyle = '#f1f5f9'; context.fillRect(x, 0, column.width, rowHeight); context.fillStyle = props.textColor; context.fillText(column.title, x + 10, rowHeight / 2, column.width - 20); }
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, props.height); context.stroke();
      props.rows.forEach((row, rowIndex) => context.fillText(row.cells[column.id] ?? '', x + 10, (rowIndex + (props.header ? 1 : 0)) * rowHeight + rowHeight / 2, column.width - 20));
      x += column.width;
    });
  }),
  exportSvg: ({ record }) => {
    const props = record.props; const rowHeight = 36; let x = 0; const cells: string[] = [];
    props.columns.forEach((column) => {
      if (props.header) cells.push(`<rect x="${x}" y="0" width="${column.width}" height="${rowHeight}" fill="#f1f5f9"/><text x="${x + 10}" y="${rowHeight / 2}" dominant-baseline="middle" fill="${escapeXml(props.textColor)}" font-size="${props.fontSize}">${escapeXml(column.title)}</text>`);
      props.rows.forEach((row, rowIndex) => {
        const y = (rowIndex + (props.header ? 1 : 0)) * rowHeight;
        cells.push(`<text x="${x + 10}" y="${y + rowHeight / 2}" dominant-baseline="middle" fill="${escapeXml(props.textColor)}" font-size="${props.fontSize}">${escapeXml(row.cells[column.id] ?? '')}</text>`);
      });
      cells.push(`<path d="M ${x} 0 V ${props.height}" stroke="${escapeXml(props.stroke)}"/>`); x += column.width;
    });
    if (props.header) cells.push(`<path d="M 0 ${rowHeight} H ${props.width}" stroke="${escapeXml(props.stroke)}"/>`);
    props.rows.forEach((_, rowIndex) => { const y = (rowIndex + (props.header ? 1 : 0) + 1) * rowHeight; cells.push(`<path d="M 0 ${y} H ${props.width}" stroke="${escapeXml(props.stroke)}"/>`); });
    return `<g transform="${svgTransform(record)}" opacity="${record.opacity}"><rect width="${props.width}" height="${props.height}" fill="${escapeXml(props.fill)}" stroke="${escapeXml(props.stroke)}"/>${cells.join('')}</g>`;
  },
};

const linkCard: ShapeDefinition<LinkCardProps> = {
  type: 'link-card', version: 1, schema: linkCardSchema,
  defaults: () => { throw new Error('Link cards require fetched metadata'); },
  geometry: boxGeometry(),
  render: ({ context, record, getImage }) => withRecordTransform(context, record, () => {
    const props = record.props;
    context.fillStyle = '#ffffff'; context.strokeStyle = '#cbd5e1'; context.beginPath(); context.roundRect(0, 0, props.width, props.height, 14); context.fill(); context.stroke();
    if (props.imageAssetId) { const source = getImage(props.imageAssetId); if (source) context.drawImage(source, 0, 0, props.width, Math.min(120, props.height / 2)); }
    const contentY = props.imageAssetId ? Math.min(144, props.height / 2 + 20) : 34;
    context.fillStyle = '#0f172a'; context.font = '600 18px Inter, sans-serif'; context.fillText(props.title, 16, contentY, props.width - 32);
    context.fillStyle = '#475569'; context.font = '13px Inter, sans-serif'; context.fillText(props.description, 16, contentY + 28, props.width - 32);
    let siteX = 16; if (props.faviconAssetId) { const favicon = getImage(props.faviconAssetId); if (favicon) { context.drawImage(favicon, 16, props.height - 34, 18, 18); siteX = 42; } }
    context.fillStyle = '#64748b'; context.font = '14px Inter, sans-serif'; context.fillText(props.siteName, siteX, props.height - 20, props.width - siteX - 16);
  }),
  exportSvg: ({ record, resolveAssetHref }) => {
    const props = record.props; const imageHeight = Math.min(120, props.height / 2); const contentY = props.imageAssetId ? Math.min(144, props.height / 2 + 20) : 34;
    const image = props.imageAssetId ? `<image href="${escapeXml(resolveAssetHref(props.imageAssetId))}" width="${props.width}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice"/>` : '';
    const favicon = props.faviconAssetId ? `<image href="${escapeXml(resolveAssetHref(props.faviconAssetId))}" x="16" y="${props.height - 34}" width="18" height="18"/>` : '';
    return `<g transform="${svgTransform(record)}" opacity="${record.opacity}"><rect width="${props.width}" height="${props.height}" rx="14" fill="#fff" stroke="#cbd5e1"/>${image}<text x="16" y="${contentY}" fill="#0f172a" font-size="18" font-weight="600">${escapeXml(props.title)}</text><text x="16" y="${contentY + 28}" fill="#475569" font-size="13">${escapeXml(props.description)}</text>${favicon}<text x="${props.faviconAssetId ? 42 : 16}" y="${props.height - 20}" fill="#64748b" font-size="14">${escapeXml(props.siteName)}</text></g>`;
  },
};

export function createBuiltinShapeRegistry(): ShapeRegistry {
  const registry = new ShapeRegistry();
  const definitions: ShapeDefinition[] = [
    rectangle, ellipse, diamond, triangle, sticky, frame, group, textDefinition,
    connectorDefinition('line'), connectorDefinition('arrow'), freehand, image,
    databaseDefinition('db-table'), databaseDefinition('db-view'), databaseDefinition('db-enum'),
    table, linkCard,
  ];
  const tools: Record<string, { label: string; shortcut: string }> = {
    rectangle: { label: 'Rectangle', shortcut: 'R' }, ellipse: { label: 'Ellipse', shortcut: 'E' }, diamond: { label: 'Diamond', shortcut: 'D' }, triangle: { label: 'Triangle', shortcut: 'G' },
    'sticky-note': { label: 'Sticky note', shortcut: 'S' }, frame: { label: 'Frame', shortcut: 'F' }, text: { label: 'Text', shortcut: 'T' }, line: { label: 'Line', shortcut: 'L' }, arrow: { label: 'Arrow', shortcut: 'A' }, freehand: { label: 'Draw', shortcut: 'P' },
    'db-table': { label: 'Database table', shortcut: '' }, 'db-view': { label: 'Database view', shortcut: '' }, 'db-enum': { label: 'Database enum', shortcut: '' },
  };
  definitions.forEach((definition) => registry.register(tools[definition.type] ? { ...definition, tool: tools[definition.type] } : definition));
  return registry;
}
