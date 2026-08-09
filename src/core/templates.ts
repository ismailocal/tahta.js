import { generateKeyBetween } from 'fractional-indexing';
import type { CanvasEngine } from './CanvasEngine.js';
import { getBindingPoint } from './bindings.js';
import type { CanvasCommand } from './commands.js';
import { compareFractionalIndex, ROOT_PARENT_ID, type ShapeRecord } from './model.js';
import { richTextFromString } from './richText.js';

export const BUILTIN_CANVAS_TEMPLATES = [
  ['decision-tree', 'Decision Tree'], ['flowchart', 'Flowchart'], ['db-schema', 'DB Schema'],
  ['user-flow', 'User Flow'], ['mind-map', 'Mind Map'], ['swot', 'SWOT Analysis'],
  ['org-chart', 'Org Chart'], ['timeline', 'Timeline'], ['uml-class', 'UML Class'],
  ['venn', 'Venn Diagram'], ['fishbone', 'Fishbone'], ['wireframe', 'Wireframe'],
] as const;

export type BuiltinCanvasTemplateKey = (typeof BUILTIN_CANVAS_TEMPLATES)[number][0];

interface TemplateBox {
  kind: 'box'; id: string; type: 'rectangle' | 'ellipse' | 'diamond'; x: number; y: number;
  width: number; height: number; text?: string; fill?: string; stroke?: string; opacity?: number;
}

interface TemplateDatabase {
  kind: 'database'; id: string; x: number; y: number; name: string;
  columns: { name: string; dataType: string; primaryKey?: boolean; nullable?: boolean }[];
}

interface TemplateConnector {
  kind: 'connector'; id: string; type: 'line' | 'arrow';
  from?: { id: string; port: string }; to?: { id: string; port: string };
  start?: { x: number; y: number }; end?: { x: number; y: number };
  text?: string; stroke?: string; endArrowhead?: 'none' | 'arrow' | 'triangle';
}

type TemplateItem = TemplateBox | TemplateDatabase | TemplateConnector;
const box = (id: string, type: TemplateBox['type'], x: number, y: number, width: number, height: number, text = '', style: Pick<TemplateBox, 'fill' | 'stroke' | 'opacity'> = {}): TemplateBox => ({ kind: 'box', id, type, x, y, width, height, text, ...style });
const edge = (id: string, from: string, fromPort: string, to: string, toPort: string, text = '', style: Pick<TemplateConnector, 'stroke' | 'endArrowhead'> = {}): TemplateConnector => ({ kind: 'connector', id, type: 'arrow', from: { id: from, port: fromPort }, to: { id: to, port: toPort }, text, ...style });
const segment = (id: string, type: TemplateConnector['type'], start: { x: number; y: number }, end: { x: number; y: number }): TemplateConnector => ({ kind: 'connector', id, type, start, end });

function templateItems(key: BuiltinCanvasTemplateKey): TemplateItem[] {
  if (key === 'decision-tree') return [
    box('root', 'diamond', -90, 0, 180, 100, 'Decision?'), box('yes', 'rectangle', -210, 100, 160, 52, 'Yes', { stroke: '#22c55e' }), box('no', 'rectangle', 210, 100, 160, 52, 'No', { stroke: '#ef4444' }),
    box('yesEnd', 'ellipse', -210, 200, 140, 52, 'Result A', { stroke: '#22c55e' }), box('noEnd', 'ellipse', 210, 200, 140, 52, 'Result B', { stroke: '#ef4444' }),
    edge('root-yes', 'root', 'left', 'yes', 'right', 'Yes'), edge('root-no', 'root', 'right', 'no', 'left', 'No'), edge('yes-end', 'yes', 'bottom', 'yesEnd', 'top'), edge('no-end', 'no', 'bottom', 'noEnd', 'top'),
  ];
  if (key === 'flowchart') return [
    box('start', 'ellipse', -80, 0, 160, 52, 'Start', { stroke: '#6366f1' }), box('process', 'rectangle', -80, 132, 160, 52, 'Process', { stroke: '#6366f1' }), box('decide', 'diamond', -100, 264, 200, 100, 'Condition?', { stroke: '#6366f1' }),
    box('yes', 'rectangle', -80, 396, 160, 52, 'Yes path', { stroke: '#22c55e' }), box('no', 'rectangle', 140, 332, 160, 52, 'No path', { stroke: '#ef4444' }), box('end', 'ellipse', -80, 528, 160, 52, 'End', { stroke: '#6366f1' }),
    edge('start-process', 'start', 'bottom', 'process', 'top'), edge('process-decide', 'process', 'bottom', 'decide', 'top'), edge('decide-yes', 'decide', 'bottom', 'yes', 'top', 'Yes'), edge('decide-no', 'decide', 'right', 'no', 'left', 'No'), edge('yes-end', 'yes', 'bottom', 'end', 'top'),
  ];
  if (key === 'db-schema') return [
    { kind: 'database', id: 'users', x: 0, y: 0, name: 'users', columns: [{ name: 'id', dataType: 'INT', primaryKey: true }, { name: 'name', dataType: 'VARCHAR' }, { name: 'email', dataType: 'VARCHAR' }, { name: 'created_at', dataType: 'TIMESTAMP' }] },
    { kind: 'database', id: 'orders', x: 300, y: 0, name: 'orders', columns: [{ name: 'id', dataType: 'INT', primaryKey: true }, { name: 'user_id', dataType: 'INT' }, { name: 'total', dataType: 'DECIMAL' }, { name: 'status', dataType: 'VARCHAR' }, { name: 'created_at', dataType: 'TIMESTAMP' }] },
    { kind: 'database', id: 'items', x: 600, y: 0, name: 'order_items', columns: [{ name: 'id', dataType: 'INT', primaryKey: true }, { name: 'order_id', dataType: 'INT' }, { name: 'product', dataType: 'VARCHAR' }, { name: 'quantity', dataType: 'INT' }, { name: 'price', dataType: 'DECIMAL' }] },
    edge('users-orders', 'users', 'row-0-right', 'orders', 'row-1-left'), edge('orders-items', 'orders', 'row-0-right', 'items', 'row-1-left'),
  ];
  if (key === 'user-flow') return [
    box('login', 'rectangle', 0, 0, 150, 52, 'Login', { stroke: '#06b6d4' }), box('dashboard', 'rectangle', 180, 0, 150, 52, 'Dashboard', { stroke: '#06b6d4' }), box('action', 'diamond', 330, -10, 180, 100, 'Action?', { stroke: '#06b6d4' }),
    box('success', 'rectangle', 510, -20, 150, 52, 'Success', { stroke: '#22c55e' }), box('error', 'rectangle', 510, 52, 150, 52, 'Error', { stroke: '#ef4444' }), box('logout', 'ellipse', 0, 152, 150, 52, 'Logout', { stroke: '#06b6d4' }),
    edge('login-dashboard', 'login', 'right', 'dashboard', 'left'), edge('dashboard-action', 'dashboard', 'right', 'action', 'left'), edge('action-success', 'action', 'right', 'success', 'left', 'Yes'), edge('action-error', 'action', 'bottom', 'error', 'left', 'No'), edge('login-logout', 'login', 'bottom', 'logout', 'top'),
  ];
  if (key === 'mind-map') return [
    box('center', 'rectangle', -80, -26, 160, 52, 'Main Idea', { stroke: '#f59e0b', fill: '#1c1310' }), box('topic1', 'rectangle', -350, -120, 130, 44, 'Topic 1', { stroke: '#8b5cf6' }), box('topic3', 'rectangle', -350, 50, 130, 44, 'Topic 3', { stroke: '#22c55e' }),
    box('topic2', 'rectangle', 170, -120, 130, 44, 'Topic 2', { stroke: '#06b6d4' }), box('topic4', 'rectangle', 170, 50, 130, 44, 'Topic 4', { stroke: '#f43f5e' }),
    edge('topic1-center', 'topic1', 'right', 'center', 'left', '', { stroke: '#8b5cf6', endArrowhead: 'none' }), edge('topic3-center', 'topic3', 'right', 'center', 'left', '', { stroke: '#22c55e', endArrowhead: 'none' }), edge('topic2-center', 'topic2', 'left', 'center', 'right', '', { stroke: '#06b6d4', endArrowhead: 'none' }), edge('topic4-center', 'topic4', 'left', 'center', 'right', '', { stroke: '#f43f5e', endArrowhead: 'none' }),
  ];
  if (key === 'swot') return [
    box('strengths', 'rectangle', 0, 0, 300, 200, 'Strengths', { stroke: '#22c55e', fill: '#f0fdf4' }), box('weaknesses', 'rectangle', 304, 0, 300, 200, 'Weaknesses', { stroke: '#ef4444', fill: '#fef2f2' }),
    box('opportunities', 'rectangle', 0, 204, 300, 200, 'Opportunities', { stroke: '#06b6d4', fill: '#f0f9ff' }), box('threats', 'rectangle', 304, 204, 300, 200, 'Threats', { stroke: '#f59e0b', fill: '#fffbeb' }),
  ];
  if (key === 'org-chart') {
    const nodes = [box('ceo', 'rectangle', -70, 0, 140, 48, 'CEO', { stroke: '#6366f1', fill: '#eef2ff' }), ...[-250, -70, 110].map((x, index) => box(`mgr${index + 1}`, 'rectangle', x, 120, 140, 48, `Manager ${index + 1}`, { stroke: '#8b5cf6' })), ...[-380, -250, -120, 10, 140, 270].map((x, index) => box(`emp${index + 1}`, 'rectangle', x, 200, 119, 41, `Employee ${index + 1}`, { stroke: '#a78bfa' }))];
    return [...nodes, edge('ceo-mgr1', 'ceo', 'bottom', 'mgr1', 'top', '', { endArrowhead: 'none' }), edge('ceo-mgr2', 'ceo', 'bottom', 'mgr2', 'top', '', { endArrowhead: 'none' }), edge('ceo-mgr3', 'ceo', 'bottom', 'mgr3', 'top', '', { endArrowhead: 'none' }), ...[1, 2, 3, 4, 5, 6].map((employee) => edge(`mgr-emp${employee}`, `mgr${Math.ceil(employee / 2)}`, 'bottom', `emp${employee}`, 'top', '', { endArrowhead: 'none' }))];
  }
  if (key === 'timeline') {
    const items: TemplateItem[] = [segment('axis', 'arrow', { x: 0, y: 0 }, { x: 780, y: 0 })];
    ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].forEach((label, index) => { const x = index * 180; const above = index % 2 === 0; const lineEndY = above ? -92 : 92; items.push(segment(`line${index}`, 'line', { x, y: above ? -22 : 22 }, { x, y: lineEndY }), box(`dot${index}`, 'ellipse', x - 22, -22, 44, 44, '', { fill: '#6366f1', stroke: '#4f46e5' }), box(`card${index}`, 'rectangle', x - 65, above ? -144 : 92, 130, 52, label, { stroke: '#6366f1' })); });
    return items;
  }
  if (key === 'uml-class') {
    const makeClass = (prefix: string, x: number, title: string) => [box(`${prefix}Header`, 'rectangle', x, 0, 200, 44, title, { stroke: '#6366f1', fill: '#eef2ff' }), box(`${prefix}Attrs`, 'rectangle', x, 44, 200, 84, '- id: int\n- name: string\n- email: string', { stroke: '#6366f1' }), box(`${prefix}Meths`, 'rectangle', x, 128, 200, 56, '+ getId(): int\n+ save(): void', { stroke: '#6366f1' })];
    return [...makeClass('user', 0, 'User'), ...makeClass('order', 320, 'Order'), edge('relation', 'userHeader', 'right', 'orderHeader', 'left', 'has many', { endArrowhead: 'triangle' })];
  }
  if (key === 'venn') return [box('setA', 'ellipse', -190, -132, 220, 220, 'Set A', { stroke: '#6366f1', fill: '#6366f1', opacity: .25 }), box('setB', 'ellipse', -30, -132, 220, 220, 'Set B', { stroke: '#ec4899', fill: '#ec4899', opacity: .25 }), box('setC', 'ellipse', -110, 28, 220, 220, 'Set C', { stroke: '#f59e0b', fill: '#f59e0b', opacity: .25 })];
  if (key === 'fishbone') {
    const cosine = Math.cos(35 * Math.PI / 180); const dy = Math.tan(35 * Math.PI / 180) * 140; const positions = [100, 225, 100, 225]; const sides = [1, 1, -1, -1]; const labels = ['Method', 'Machine', 'Material', 'People'];
    const items: TemplateItem[] = [segment('spine', 'arrow', { x: 0, y: 0 }, { x: 500, y: 0 }), box('problem', 'rectangle', 500, -26, 120, 52, 'Problem', { stroke: '#ef4444', fill: '#fef2f2' })];
    positions.forEach((x, index) => { const end = { x: x - 140 * cosine, y: sides[index]! * -dy }; items.push(segment(`rib${index}`, 'line', { x, y: 0 }, end), box(`label${index}`, 'rectangle', end.x - 55, end.y - (sides[index] === 1 ? 52 : -8), 110, 44, labels[index]!, { stroke: '#64748b' })); }); return items;
  }
  return [box('header', 'rectangle', 0, -12, 720, 60, 'Header / Nav', { stroke: '#94a3b8', fill: '#f1f5f9' }), box('sidebar', 'rectangle', 0, 64, 160, 400, 'Sidebar', { stroke: '#94a3b8', fill: '#f8fafc' }), box('footer', 'rectangle', 0, 472, 720, 48, 'Footer', { stroke: '#94a3b8', fill: '#f1f5f9' }), box('content1', 'rectangle', 168, 64, 552, 120, 'Content 1', { stroke: '#cbd5e1' }), box('content2', 'rectangle', 168, 200, 552, 120, 'Content 2', { stroke: '#cbd5e1' }), box('content3', 'rectangle', 168, 336, 552, 120, 'Content 3', { stroke: '#cbd5e1' })];
}

export function placeBuiltinCanvasTemplate(engine: CanvasEngine, key: BuiltinCanvasTemplateKey, origin: { x: number; y: number }): string[] {
  const snapshot = engine.getSnapshot(); const prefix = `template-${key}-${crypto.randomUUID()}`; const records = new Map<string, ShapeRecord>(); const commands: CanvasCommand[] = [];
  let index = snapshot.records.filter(({ parentId }) => parentId === ROOT_PARENT_ID).sort((a, b) => compareFractionalIndex(a.index, b.index)).at(-1)?.index ?? null;
  const nextIndex = () => { index = generateKeyBetween(index, null); return index; };
  const id = (localId: string) => `${prefix}:${localId}`;
  const connectors: TemplateConnector[] = [];
  templateItems(key).forEach((item) => {
    if (item.kind === 'connector') { connectors.push(item); return; }
    const type = item.kind === 'database' ? 'db-table' : item.type; const definition = engine.registry.get(type); const defaults = definition.defaults() as Record<string, unknown>;
    const props = item.kind === 'database'
      ? { ...defaults, width: 220, height: 52 + item.columns.length * 24, name: item.name, columns: item.columns.map((column, columnIndex) => ({ id: `${id(item.id)}:column-${columnIndex}`, name: column.name, dataType: column.dataType, primaryKey: column.primaryKey ?? false, nullable: column.nullable ?? true })) }
      : { ...defaults, width: item.width, height: item.height, text: richTextFromString(item.text ?? ''), ...(item.fill ? { fill: item.fill } : {}), ...(item.stroke ? { stroke: item.stroke } : {}) };
    const record = engine.registry.validate({ id: id(item.id), type, typeVersion: definition.version, parentId: ROOT_PARENT_ID, index: nextIndex(), x: origin.x + item.x, y: origin.y + item.y, rotation: 0, opacity: item.kind === 'box' ? item.opacity ?? 1 : 1, locked: false, hidden: false, props });
    records.set(item.id, record); commands.push({ type: 'shape.create', record });
  });
  connectors.forEach((item) => {
    const definition = engine.registry.get(item.type); const source = item.from ? records.get(item.from.id) : undefined; const target = item.to ? records.get(item.to.id) : undefined;
    if (item.from && !source) throw new Error(`Template '${key}' connector '${item.id}' has an unknown source '${item.from.id}'`);
    if (item.to && !target) throw new Error(`Template '${key}' connector '${item.id}' has an unknown target '${item.to.id}'`);
    const start = source && item.from ? getBindingPoint(source, item.from.port, engine.registry) : { x: origin.x + item.start!.x, y: origin.y + item.start!.y };
    const end = target && item.to ? getBindingPoint(target, item.to.port, engine.registry) : { x: origin.x + item.end!.x, y: origin.y + item.end!.y };
    const defaults = definition.defaults() as Record<string, unknown>; const connectorId = id(item.id);
    const record = engine.registry.validate({ id: connectorId, type: item.type, typeVersion: definition.version, parentId: ROOT_PARENT_ID, index: nextIndex(), x: start.x, y: start.y, rotation: 0, opacity: 1, locked: false, hidden: false, props: { ...defaults, points: [{ x: 0, y: 0 }, { x: end.x - start.x, y: end.y - start.y }], label: richTextFromString(item.text ?? ''), ...(item.stroke ? { stroke: item.stroke } : {}), ...(item.endArrowhead ? { endArrowhead: item.endArrowhead } : {}) } });
    commands.push({ type: 'shape.create', record });
    if (item.from || item.to) commands.push({ type: 'binding.set', binding: { id: `${connectorId}:binding`, connectorId, start: source && item.from ? { shapeId: source.id, portId: item.from.port } : null, end: target && item.to ? { shapeId: target.id, portId: item.to.port } : null } });
  });
  engine.dispatch({ type: 'batch', commands }); const selectedIds = commands.filter((command): command is Extract<CanvasCommand, { type: 'shape.create' }> => command.type === 'shape.create').map(({ record }) => record.id); engine.setViewState({ selectedIds }); return selectedIds;
}
