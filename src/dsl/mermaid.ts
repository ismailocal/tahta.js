import { z } from 'zod';
import type { CanvasAst, DslDirection, DslEdge, DslNode } from './ast.js';
import { DslDiagnosticError } from './ast.js';

const pointSchema = z.tuple([z.number().finite(), z.number().finite()]);
const elementSchema = z.object({
  id: z.string().max(255).optional(),
  type: z.string().min(1).max(64),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive().max(100_000).optional(),
  height: z.number().finite().positive().max(100_000).optional(),
  text: z.string().max(20_000).optional(),
  label: z.object({ text: z.string().max(20_000).nullable().optional(), fontSize: z.number().finite().min(8).max(256).optional(), strokeColor: z.string().max(64).optional() }).passthrough().optional(),
  points: z.array(pointSchema).min(2).max(100_000).optional(),
  groupIds: z.array(z.string().max(512)).max(100).optional(),
  start: z.object({ id: z.string().max(255) }).passthrough().optional(),
  end: z.object({ id: z.string().max(255) }).passthrough().optional(),
  link: z.string().nullable().optional(),
  strokeColor: z.string().max(64).optional(),
  backgroundColor: z.string().max(64).optional(),
  strokeWidth: z.number().finite().min(0.5).max(32).optional(),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  roundness: z.object({ type: z.number().int() }).passthrough().optional(),
  startArrowhead: z.string().nullable().optional(),
  endArrowhead: z.string().nullable().optional(),
}).passthrough();

const converterResultSchema = z.object({ elements: z.array(elementSchema).max(2_000) });
type ConverterElement = z.infer<typeof elementSchema>;

const mermaidHeader = /^(?:flowchart|graph)\s+(LR|RL|TB|BT)\b/u;
const mermaidSource = /^(?:flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram(?:-v2)?)\b/u;

export function isMermaidSource(source: string): boolean { return mermaidSource.test(source.trimStart()); }

function sourceLocation(source: string, token: string): { line: number; column: number } {
  const index = source.indexOf(token); if (index < 0) return { line: 1, column: 1 };
  const prefix = source.slice(0, index); const lines = prefix.split(/\r?\n/u);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function safeId(value: string | undefined, prefix: string, sequence: number, used: Set<string>): string {
  const normalized = value?.replace(/[^A-Za-z0-9_-]/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 180);
  const base = normalized && /^[A-Za-z]/u.test(normalized) ? normalized : `${prefix}-${normalized || sequence}`;
  let candidate = base; let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-${suffix++}`;
  used.add(candidate); return candidate;
}

function arrowhead(value: string | null | undefined, line: number): DslEdge['startArrowhead'] {
  if (value === null || value === undefined) return 'none';
  if (value === 'arrow' || value === 'triangle' || value === 'circle' || value === 'diamond' || value === 'bar') return value;
  throw new DslDiagnosticError(`Unsupported Mermaid arrowhead '${value}'`, line, 1);
}

function directParent(element: ConverterElement, frameIds: ReadonlySet<string>): string | undefined {
  for (const groupId of element.groupIds ?? []) {
    if (!groupId.startsWith('subgraph_group_')) continue;
    const id = groupId.slice('subgraph_group_'.length);
    if (frameIds.has(id) && id !== element.id) return id;
  }
  return undefined;
}

export async function parseMermaid(source: string): Promise<CanvasAst> {
  if (source.length > 50_000) throw new DslDiagnosticError('Mermaid input exceeds 50,000 characters', 1, 1);
  if (!isMermaidSource(source)) throw new DslDiagnosticError('Unsupported Mermaid diagram type', 1, 1);
  const forbidden = source.match(/^\s*(?:click\b|%%\{)/imu);
  if (forbidden) { const location = sourceLocation(source, forbidden[0]); throw new DslDiagnosticError('Executable links and Mermaid configuration directives are not supported', location.line, location.column); }

  let raw: unknown;
  try {
    const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');
    raw = await parseMermaidToExcalidraw(source, { startOnLoad: false, flowchart: { curve: 'linear' }, maxEdges: 500, maxTextSize: 50_000, themeVariables: { fontSize: '20px' } });
  } catch (error) {
    throw new DslDiagnosticError(`Mermaid conversion failed: ${error instanceof Error ? error.message : String(error)}`, 1, 1);
  }
  const parsed = converterResultSchema.safeParse(raw);
  if (!parsed.success) throw new DslDiagnosticError(`Mermaid converter returned invalid geometry: ${z.prettifyError(parsed.error)}`, 1, 1);
  if (parsed.data.elements.some(({ link }) => Boolean(link))) throw new DslDiagnosticError('Mermaid links are not supported', 1, 1);

  const header = source.trimStart().match(mermaidHeader);
  const ast: CanvasAst = { direction: (header?.[1] ?? 'TB') as DslDirection, statements: [] };
  const used = new Set<string>(); const sourceIds = new Map<string, string>();
  const frameSourceIds = new Set(parsed.data.elements.filter((element) => element.id && element.groupIds?.includes(`subgraph_group_${element.id}`)).map(({ id }) => id!));
  let sequence = 0;

  parsed.data.elements.filter(({ type }) => type !== 'arrow' && type !== 'line').forEach((element) => {
    sequence++;
    if (element.type === 'image') throw new DslDiagnosticError('Mermaid image diagrams cannot be imported without an uploaded asset', 1, 1);
    const shape = frameSourceIds.has(element.id ?? '') ? 'frame' : element.type === 'rectangle' ? 'rectangle' : element.type === 'ellipse' ? 'ellipse' : element.type === 'diamond' ? 'diamond' : element.type === 'text' ? 'text' : null;
    if (!shape) throw new DslDiagnosticError(`Unsupported Mermaid element type '${element.type}'`, 1, 1);
    const id = safeId(element.id, 'mermaid-node', sequence, used); if (element.id) sourceIds.set(element.id, id);
    const node: DslNode = {
      kind: 'node', id, shape, label: element.label?.text ?? element.text ?? '', x: element.x, y: element.y,
      width: element.width ?? Math.max(80, (element.text?.length ?? 0) * 12), height: element.height ?? 44,
      ...(element.backgroundColor ? { fill: element.backgroundColor } : {}),
      ...(element.strokeColor ? { stroke: element.strokeColor } : {}),
      ...(element.strokeWidth ? { strokeWidth: element.strokeWidth } : {}),
      ...(element.strokeStyle ? { strokeStyle: element.strokeStyle } : {}),
      ...(element.roundness ? { cornerRadius: 24 } : {}),
      ...(element.label?.strokeColor ? { textColor: element.label.strokeColor } : {}),
      ...(element.label?.fontSize ? { fontSize: element.label.fontSize } : {}),
      location: { line: 1, column: 1 },
    };
    const parent = directParent(element, frameSourceIds); if (parent) node.parentId = sourceIds.get(parent) ?? parent;
    ast.statements.push(node);
  });

  parsed.data.elements.filter(({ type }) => type === 'arrow' || type === 'line').forEach((element) => {
    sequence++; const from = element.start?.id ? sourceIds.get(element.start.id) : undefined; const to = element.end?.id ? sourceIds.get(element.end.id) : undefined;
    if (!from || !to || !element.points) throw new DslDiagnosticError('Mermaid connector is missing a valid bound endpoint or route', 1, 1);
    const id = safeId(element.id, 'mermaid-edge', sequence, used);
    ast.statements.push({
      kind: 'edge', id, from, to, label: element.label?.text ?? '', x: element.x, y: element.y,
      points: element.points.map(([x, y]) => ({ x, y })),
      ...(element.strokeColor ? { stroke: element.strokeColor } : {}),
      ...(element.strokeWidth ? { strokeWidth: element.strokeWidth } : {}),
      ...(element.strokeStyle ? { strokeStyle: element.strokeStyle } : {}),
      edgeStyle: element.points.length > 2 ? 'elbow' : 'straight',
      startArrowhead: arrowhead(element.startArrowhead, 1), endArrowhead: arrowhead(element.endArrowhead, 1),
      location: { line: 1, column: 1 },
    });
  });
  return ast;
}
