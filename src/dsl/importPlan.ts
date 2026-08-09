import { generateKeyBetween } from 'fractional-indexing';
import { z } from 'zod';
import { runLayoutRequest, type CanvasCommand, type CanvasEngine } from '../core/index.js';
import { ROOT_PARENT_ID, bindingRecordSchema, canvasDocumentSchema, shapeRecordSchema, type ShapeRecord } from '../core/model.js';
import type { ShapeRegistry } from '../core/registry.js';
import type { CanvasAst, DslNode } from './ast.js';
import { DslDiagnosticError } from './ast.js';
import { nodesInAst } from './serializer.js';

export type ImportPlanCommand =
  | Extract<CanvasCommand, { type: 'shape.create' }>
  | Extract<CanvasCommand, { type: 'shape.update' }>
  | Extract<CanvasCommand, { type: 'shape.delete' }>
  | Extract<CanvasCommand, { type: 'binding.set' }>
  | Extract<CanvasCommand, { type: 'document.update' }>;

export interface ImportPlanV2 { schemaVersion: 2; commands: ImportPlanCommand[] }

const importCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('shape.create'), record: shapeRecordSchema }),
  z.object({ type: z.literal('shape.update'), id: z.string().min(1).max(255), patch: shapeRecordSchema.omit({ id: true, type: true, typeVersion: true }).partial() }),
  z.object({ type: z.literal('shape.delete'), ids: z.array(z.string().min(1).max(255)).max(50_000), mode: z.enum(['only', 'cascade']) }),
  z.object({ type: z.literal('binding.set'), binding: bindingRecordSchema }),
  z.object({ type: z.literal('document.update'), patch: canvasDocumentSchema.omit({ id: true }).partial() }),
]);

export const importPlanSchema = z.object({ schemaVersion: z.literal(2), commands: z.array(importCommandSchema).max(150_000) });

function connectorRecord(source: ShapeRecord, target: ShapeRecord, registry: ShapeRegistry, edge: Extract<CanvasAst['statements'][number], { kind: 'edge' }>, index: string): ShapeRecord {
  const sourceBounds = registry.get(source.type).geometry.getBounds(source);
  const targetBounds = registry.get(target.type).geometry.getBounds(target);
  const start = { x: sourceBounds.x + sourceBounds.width / 2, y: sourceBounds.y + sourceBounds.height / 2 };
  const end = { x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + targetBounds.height / 2 };
  const definition = registry.get('arrow');
  const props = definition.defaults() as Record<string, unknown>;
  return registry.validate({
    id: edge.id, type: 'arrow', typeVersion: definition.version, parentId: ROOT_PARENT_ID, index,
    x: edge.x ?? start.x, y: edge.y ?? start.y, rotation: 0, opacity: 1, locked: false, hidden: false,
    props: {
      ...props,
      points: edge.points ?? [{ x: 0, y: 0 }, { x: end.x - start.x, y: end.y - start.y }],
      ...(edge.stroke !== undefined ? { stroke: edge.stroke } : {}),
      ...(edge.strokeWidth !== undefined ? { strokeWidth: edge.strokeWidth } : {}),
      ...(edge.strokeStyle !== undefined ? { strokeStyle: edge.strokeStyle } : {}),
      ...(edge.edgeStyle !== undefined ? { edgeStyle: edge.edgeStyle } : {}),
      ...(edge.startArrowhead !== undefined ? { startArrowhead: edge.startArrowhead } : {}),
      ...(edge.endArrowhead !== undefined ? { endArrowhead: edge.endArrowhead } : {}),
      label: { type: 'doc', content: [{ type: 'paragraph', align: 'left', content: [{ text: edge.label, marks: [] }] }] },
    },
  });
}

export async function astToImportPlan(ast: CanvasAst, registry: ShapeRegistry): Promise<ImportPlanV2> {
  const commands: ImportPlanCommand[] = [];
  const records = new Map<string, ShapeRecord>();
  let index: string | null = null;
  const nodes = nodesInAst(ast);
  nodes.forEach((node: DslNode) => {
    if (!registry.has(node.shape)) throw new DslDiagnosticError(`Unknown shape type '${node.shape}'`, node.location.line, node.location.column);
    const definition = registry.get(node.shape);
    const props = definition.defaults() as Record<string, unknown>;
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    index = generateKeyBetween(index, null);
    const record = registry.validate({
      id: node.id, type: node.shape, typeVersion: definition.version,
      parentId: node.parentId ?? ROOT_PARENT_ID, index, x, y, rotation: 0,
      opacity: 1, locked: false, hidden: false,
      props: {
        ...props,
        ...(node.width !== undefined ? { width: node.width } : {}),
        ...(node.height !== undefined ? { height: node.height } : {}),
        ...(node.fill !== undefined ? { fill: node.fill } : {}),
        ...(node.stroke !== undefined ? { stroke: node.stroke } : {}),
        ...(node.strokeWidth !== undefined ? { strokeWidth: node.strokeWidth } : {}),
        ...(node.strokeStyle !== undefined ? { strokeStyle: node.strokeStyle } : {}),
        ...(node.cornerRadius !== undefined ? { cornerRadius: node.cornerRadius } : {}),
        ...(node.textColor !== undefined ? { textColor: node.textColor } : {}),
        ...(node.fontSize !== undefined ? { fontSize: node.fontSize } : {}),
        ...(typeof props.text === 'object' ? { text: { type: 'doc', content: [{ type: 'paragraph', align: 'left', content: [{ text: node.label, marks: [] }] }] } } : {}),
        ...(typeof props.name === 'string' ? { name: node.label } : {}),
      },
    });
    records.set(record.id, record); commands.push({ type: 'shape.create', record });
  });
  if (nodes.some((node) => node.x === undefined || node.y === undefined) && nodes.length >= 2) {
    const edges = ast.statements.filter((statement) => statement.kind === 'edge');
    const result = await runLayoutRequest({
      direction: ast.direction, alignment: 'automatic', spacing: 80,
      nodes: nodes.map((node) => { const record = records.get(node.id)!; const bounds = registry.get(record.type).geometry.getBounds(record); return { id: record.id, parentId: records.has(record.parentId) ? record.parentId : ROOT_PARENT_ID, x: record.x, y: record.y, width: Math.max(1, bounds.width), height: Math.max(1, bounds.height), locked: node.x !== undefined && node.y !== undefined }; }),
      edges: edges.map((edge) => ({ id: edge.id, source: edge.from, target: edge.to, connectorId: edge.id })),
    });
    const sourceNodes = new Map(nodes.map((node) => [node.id, node]));
    result.nodes.forEach((position) => {
      const current = records.get(position.id); const source = sourceNodes.get(position.id); if (!current || !source) return;
      const next = registry.validate({ ...current, x: source.x ?? position.x, y: source.y ?? position.y }); records.set(next.id, next);
      const command = commands.find((value): value is Extract<ImportPlanCommand, { type: 'shape.create' }> => value.type === 'shape.create' && value.record.id === next.id);
      if (command) command.record = next;
    });
  }
  ast.statements.filter((statement) => statement.kind === 'edge').forEach((edge) => {
    const source = records.get(edge.from)!; const target = records.get(edge.to)!;
    index = generateKeyBetween(index, null);
    const connector = connectorRecord(source, target, registry, edge, index);
    commands.push({ type: 'shape.create', record: connector });
    commands.push({ type: 'binding.set', binding: { id: `binding:${edge.id}`, connectorId: edge.id, start: { shapeId: edge.from }, end: { shapeId: edge.to } } });
  });
  if (ast.title !== undefined) commands.unshift({ type: 'document.update', patch: { title: ast.title } });
  return importPlanSchema.parse({ schemaVersion: 2, commands }) as ImportPlanV2;
}

export function validateImportPlan(value: unknown, registry: ShapeRegistry): ImportPlanV2 {
  const plan = importPlanSchema.parse(value) as ImportPlanV2;
  plan.commands.forEach((command) => { if (command.type === 'shape.create') registry.validate(command.record); });
  return plan;
}

export function applyImportPlan(engine: CanvasEngine, value: unknown): void {
  const plan = validateImportPlan(value, engine.registry);
  engine.dispatch({ type: 'batch', commands: plan.commands });
}
