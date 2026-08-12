import type { Shape, Point } from '../core/types';
import { createId, randomSeed } from '../core/Utils';
import { getStylePreset } from '../core/constants';

// ─── Core data model ──────────────────────────────────────────────────────────

/**
 * A stored shape within a template. Positions are relative to the template
 * origin (0, 0). `_tid` is a stable intra-template ID used for binding refs.
 * Real `id`s are generated fresh on each instantiation.
 */
type TemplateShape = Omit<Shape, 'id'> & { _tid: string };

export type Template = {
  label: string;
  shapes: TemplateShape[];
};

function builtInNode(
  tid: string,
  type: 'rectangle' | 'ellipse' | 'diamond',
  x: number,
  y: number,
  text: string,
  width: number,
  height: number,
  style: Partial<Shape> = {},
): TemplateShape {
  return {
    ...getStylePreset(type),
    _tid: tid,
    type,
    x,
    y,
    width,
    height,
    text,
    strokeStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
    opacity: 1,
    zIndex: 0,
    ...style,
  };
}

function builtInArrow(
  tid: string,
  from: string,
  fromPort: string,
  to: string,
  toPort: string,
  style: Partial<Shape> = {},
): TemplateShape {
  return {
    _tid: tid,
    type: 'arrow',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    zIndex: 0,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    startBinding: { elementId: from, portId: fromPort },
    endBinding: { elementId: to, portId: toPort },
    strokeStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
    ...style,
  };
}

function builtInDbTable(
  tid: string,
  x: number,
  tableName: string,
  columns: Array<{ name: string; type: string; pk?: boolean; fk?: boolean }>,
): TemplateShape {
  return {
    _tid: tid,
    type: 'db-table',
    x,
    y: 0,
    width: 220,
    height: 36 + Math.max(1, columns.length) * 28,
    zIndex: 0,
    strokeStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
    data: { tableName, columns },
  };
}

/**
 * Instantiate a template at `origin`. Generates fresh IDs, remaps all
 * startBinding/endBinding elementIds from _tid to the new real IDs,
 * and offsets all positions by origin.
 *
 * This is the ONLY place that knows how to turn template data into live shapes.
 * "Save as template" is the inverse: normalize selected shapes to (0,0) and
 * store them as TemplateShape[].
 */
export function instantiateTemplate(template: Template, origin: Point): Shape[] {
  const idMap = new Map<string, string>();
  for (const s of template.shapes) idMap.set(s._tid, createId());

  return template.shapes.map(s => {
    const newId = idMap.get(s._tid)!;
    const { _tid, ...storedShape } = s;
    void _tid;
    const shape: Shape = {
      ...storedShape,
      id: newId,
      x: s.x + origin.x,
      y: s.y + origin.y,
      zIndex: s.zIndex ?? 0,
    };
    // Remap connector bindings
    if (shape.startBinding?.elementId) {
      const remapped = idMap.get(shape.startBinding.elementId);
      if (remapped) shape.startBinding = { ...shape.startBinding, elementId: remapped };
    }
    if (shape.endBinding?.elementId) {
      const remapped = idMap.get(shape.endBinding.elementId);
      if (remapped) shape.endBinding = { ...shape.endBinding, elementId: remapped };
    }
    // Arrow points are relative to shape.x/y — already offset above, no extra work needed
    return shape;
  });
}

/**
 * Normalize a set of live shapes into a Template.
 * Positions become relative to the bounding box top-left.
 * Called by "Save as template" UI (future feature).
 */
export function selectionToTemplate(label: string, shapes: Shape[]): Template {
  if (!shapes.length) return { label, shapes: [] };
  const minX = Math.min(...shapes.map(s => s.x));
  const minY = Math.min(...shapes.map(s => s.y));

  const tidMap = new Map<string, string>();
  for (const s of shapes) tidMap.set(s.id, s.id); // keep original id as _tid

  const templateShapes: TemplateShape[] = shapes.map(s => {
    const { id, ...rest } = s;
    const ts: TemplateShape = {
      ...rest,
      _tid: id,
      x: s.x - minX,
      y: s.y - minY,
    };
    if (ts.startBinding?.elementId && tidMap.has(ts.startBinding.elementId)) {
      ts.startBinding = { ...ts.startBinding, elementId: ts.startBinding.elementId };
    }
    if (ts.endBinding?.elementId && tidMap.has(ts.endBinding.elementId)) {
      ts.endBinding = { ...ts.endBinding, elementId: ts.endBinding.elementId };
    }
    return ts;
  });

  return { label, shapes: templateShapes };
}

// ─── Build helpers (only used for defining built-in templates below) ──────────

type Side = 'top' | 'right' | 'bottom' | 'left';

function port(s: TemplateShape, side: Side) {
  const w = s.width || 0, h = s.height || 0;
  const cx = s.x + w / 2, cy = s.y + h / 2;
  switch (side) {
    case 'top':    return { x: cx,      y: s.y,     id: 'top',    shapeId: s._tid };
    case 'right':  return { x: s.x + w, y: cy,      id: 'right',  shapeId: s._tid };
    case 'bottom': return { x: cx,      y: s.y + h, id: 'bottom', shapeId: s._tid };
    case 'left':   return { x: s.x,     y: cy,      id: 'left',   shapeId: s._tid };
  }
}

function s_arrow(
  from: { x: number; y: number; id: string; shapeId: string },
  to:   { x: number; y: number; id: string; shapeId: string },
  opts: Partial<Shape> = {}
): TemplateShape {
  return {
    ...getStylePreset('arrow'),
    _tid: createId(), type: 'arrow',
    x: from.x, y: from.y, width: 0, height: 0, zIndex: 0,
    points: [{ x: 0, y: 0 }, { x: to.x - from.x, y: to.y - from.y }],
    startBinding: { elementId: from.shapeId, portId: from.id },
    endBinding:   { elementId: to.shapeId,   portId: to.id   },
    seed: randomSeed(),
    ...opts,
  } as TemplateShape;
}

function s_rect(x: number, y: number, w: number, h: number,
                text: string, opts: Partial<Shape> = {}): TemplateShape {
  return {
    ...getStylePreset('rectangle'),
    _tid: createId(), type: 'rectangle', x, y, width: w, height: h, zIndex: 0,
    text, seed: randomSeed(), ...opts,
  } as TemplateShape;
}

function s_oval(x: number, y: number, w: number, h: number,
                text: string, opts: Partial<Shape> = {}): TemplateShape {
  return {
    ...getStylePreset('ellipse'),
    _tid: createId(), type: 'ellipse', x, y, width: w, height: h, zIndex: 0,
    text, seed: randomSeed(), ...opts,
  } as TemplateShape;
}

// ─── Built-in templates ───────────────────────────────────────────────────────

function makeDecisionTree(): Template {
  return { label: 'Decision Tree', shapes: [
    builtInNode('root', 'diamond', -90, 0, 'Decision?', 120, 80),
    builtInNode('yes', 'rectangle', -210, 100, 'Yes', 160, 52, { stroke: '#22c55e' }),
    builtInNode('no', 'rectangle', 210, 100, 'No', 160, 52, { stroke: '#ef4444' }),
    builtInNode('yesEnd', 'ellipse', -210, 200, 'Result A', 140, 52, { stroke: '#22c55e' }),
    builtInNode('noEnd', 'ellipse', 210, 200, 'Result B', 140, 52, { stroke: '#ef4444' }),
    builtInArrow('root-yes', 'root', 'left', 'yes', 'right', { text: '"Yes"' }),
    builtInArrow('root-no', 'root', 'right', 'no', 'left', { text: '"No"' }),
    builtInArrow('yes-end', 'yes', 'bottom', 'yesEnd', 'top'),
    builtInArrow('no-end', 'no', 'bottom', 'noEnd', 'top'),
  ] };
}

function makeFlowchart(): Template {
  return { label: 'Flowchart', shapes: [
    builtInNode('start', 'ellipse', -80, 0, 'Start', 160, 52, { stroke: '#6366f1' }),
    builtInNode('process', 'rectangle', -80, 132, 'Process', 160, 52, { stroke: '#6366f1' }),
    builtInNode('decide', 'diamond', -100, 264, 'Condition?', 120, 80, { stroke: '#6366f1' }),
    builtInNode('yes', 'rectangle', -80, 396, 'Yes path', 160, 52, { stroke: '#22c55e' }),
    builtInNode('no', 'rectangle', 140, 332, 'No path', 160, 52, { stroke: '#ef4444' }),
    builtInNode('end', 'ellipse', -80, 528, 'End', 160, 52, { stroke: '#6366f1' }),
    builtInArrow('start-process', 'start', 'bottom', 'process', 'top'),
    builtInArrow('process-decide', 'process', 'bottom', 'decide', 'top'),
    builtInArrow('decide-yes', 'decide', 'bottom', 'yes', 'top', { text: '"Yes"' }),
    builtInArrow('decide-no', 'decide', 'right', 'no', 'left', { text: '"No"' }),
    builtInArrow('yes-end', 'yes', 'bottom', 'end', 'top'),
  ] };
}

function makeDbSchema(): Template {
  return { label: 'DB Schema', shapes: [
    builtInDbTable('users', 0, 'users', [{ name: 'id', type: 'INT', pk: true }, { name: 'name', type: 'VARCHAR' }, { name: 'email', type: 'VARCHAR' }, { name: 'created_at', type: 'TIMESTAMP' }]),
    builtInDbTable('orders', 300, 'orders', [{ name: 'id', type: 'INT', pk: true }, { name: 'user_id', type: 'INT', fk: true }, { name: 'total', type: 'DECIMAL' }, { name: 'status', type: 'VARCHAR' }, { name: 'created_at', type: 'TIMESTAMP' }]),
    builtInDbTable('items', 600, 'order_items', [{ name: 'id', type: 'INT', pk: true }, { name: 'order_id', type: 'INT', fk: true }, { name: 'product', type: 'VARCHAR' }, { name: 'quantity', type: 'INT' }, { name: 'price', type: 'DECIMAL' }]),
    builtInArrow('users-orders', 'users', 'row-0-right', 'orders', 'row-1-left'),
    builtInArrow('orders-items', 'orders', 'row-0-right', 'items', 'row-1-left'),
  ] };
}

function makeUserFlow(): Template {
  return { label: 'User Flow', shapes: [
    builtInNode('login', 'rectangle', 0, 0, 'Login', 150, 52, { stroke: '#06b6d4' }),
    builtInNode('dashboard', 'rectangle', 180, 0, 'Dashboard', 150, 52, { stroke: '#06b6d4' }),
    builtInNode('action', 'diamond', 330, -10, 'Action?', 120, 80, { stroke: '#06b6d4' }),
    builtInNode('success', 'rectangle', 510, -20, 'Success', 150, 52, { stroke: '#22c55e' }),
    builtInNode('error', 'rectangle', 510, 52, 'Error', 150, 52, { stroke: '#ef4444' }),
    builtInNode('logout', 'ellipse', 0, 152, 'Logout', 150, 52, { stroke: '#06b6d4' }),
    builtInArrow('login-dashboard', 'login', 'right', 'dashboard', 'left'),
    builtInArrow('dashboard-action', 'dashboard', 'right', 'action', 'left'),
    builtInArrow('action-success', 'action', 'right', 'success', 'left', { text: '"Yes"' }),
    builtInArrow('action-error', 'action', 'bottom', 'error', 'left', { text: '"No"' }),
    builtInArrow('login-logout', 'login', 'bottom', 'logout', 'top'),
  ] };
}

function makeMindMap(): Template {
  return { label: 'Mind Map', shapes: [
    builtInNode('center', 'rectangle', -80, -26, 'Main Idea', 160, 52, { stroke: '#f59e0b', fill: '#1c1310' }),
    builtInNode('topic1', 'rectangle', -350, -120, 'Topic 1', 130, 44, { stroke: '#8b5cf6' }),
    builtInNode('topic3', 'rectangle', -350, 50, 'Topic 3', 130, 44, { stroke: '#22c55e' }),
    builtInNode('topic2', 'rectangle', 170, -120, 'Topic 2', 130, 44, { stroke: '#06b6d4' }),
    builtInNode('topic4', 'rectangle', 170, 50, 'Topic 4', 130, 44, { stroke: '#f43f5e' }),
    builtInArrow('topic1-center', 'topic1', 'right', 'center', 'left', { endArrowhead: 'none', stroke: '#8b5cf6' }),
    builtInArrow('topic3-center', 'topic3', 'right', 'center', 'left', { endArrowhead: 'none', stroke: '#22c55e' }),
    builtInArrow('topic2-center', 'topic2', 'left', 'center', 'right', { endArrowhead: 'none', stroke: '#06b6d4' }),
    builtInArrow('topic4-center', 'topic4', 'left', 'center', 'right', { endArrowhead: 'none', stroke: '#f43f5e' }),
  ] };
}

function makeSwot(): Template {
  return { label: 'SWOT Analysis', shapes: [
    builtInNode('strengths', 'rectangle', 0, 0, 'Strengths', 300, 200, { stroke: '#22c55e', fill: '#f0fdf4' }),
    builtInNode('weaknesses', 'rectangle', 304, 0, 'Weaknesses', 300, 200, { stroke: '#ef4444', fill: '#fef2f2' }),
    builtInNode('opportunities', 'rectangle', 0, 204, 'Opportunities', 300, 200, { stroke: '#06b6d4', fill: '#f0f9ff' }),
    builtInNode('threats', 'rectangle', 304, 204, 'Threats', 300, 200, { stroke: '#f59e0b', fill: '#fffbeb' }),
  ] };
}

function makeOrgChart(): Template {
  const nodes = [
    builtInNode('ceo', 'rectangle', -70, 0, 'CEO', 140, 48, { stroke: '#6366f1', fill: '#eef2ff' }),
    builtInNode('mgr1', 'rectangle', -250, 120, 'Manager 1', 140, 48, { stroke: '#8b5cf6' }),
    builtInNode('mgr2', 'rectangle', -70, 120, 'Manager 2', 140, 48, { stroke: '#8b5cf6' }),
    builtInNode('mgr3', 'rectangle', 110, 120, 'Manager 3', 140, 48, { stroke: '#8b5cf6' }),
    ...Array.from({ length: 6 }, (_, index) => builtInNode(`emp${index + 1}`, 'rectangle', -380 + index * 130, 200, `Employee ${index + 1}`, 119, 41, { stroke: '#a78bfa' })),
  ];
  return { label: 'Org Chart', shapes: [
    ...nodes,
    builtInArrow('ceo-mgr1', 'ceo', 'bottom', 'mgr1', 'top', { endArrowhead: 'none' }),
    builtInArrow('ceo-mgr2', 'ceo', 'bottom', 'mgr2', 'top', { endArrowhead: 'none' }),
    builtInArrow('ceo-mgr3', 'ceo', 'bottom', 'mgr3', 'top', { endArrowhead: 'none' }),
    ...Array.from({ length: 6 }, (_, index) => builtInArrow(`mgr-emp${index + 1}`, `mgr${Math.floor(index / 2) + 1}`, 'bottom', `emp${index + 1}`, 'top', { endArrowhead: 'none' })),
  ] };
}

function makeTimeline(): Template {
  const MILESTONES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
  const STEP = 180, OW = 44, OH = 44, CW = 130, CH = 52, ABOVE = 70;
  const totalW = (MILESTONES.length - 1) * STEP;

  // Binding-less horizontal axis arrow
  const axisId = createId();
  const axis: TemplateShape = {
    ...getStylePreset('arrow'),
    _tid: axisId, type: 'arrow',
    x: 0, y: 0, width: 0, height: 0, zIndex: 0,
    points: [{ x: 0, y: 0 }, { x: totalW + 60, y: 0 }],
    seed: randomSeed(),
  } as TemplateShape;

  const dots = MILESTONES.map((label, i) => {
    const cx = i * STEP;
    return s_oval(cx - OW / 2, -OH / 2, OW, OH, '', { fill: '#6366f1', stroke: '#4f46e5', opacity: 1 });
  });

  const cards = MILESTONES.map((label, i) => {
    const cx = i * STEP;
    const above = i % 2 === 0;
    const cardY = above ? -(OH / 2 + ABOVE + CH) : OH / 2 + ABOVE;
    return s_rect(cx - CW / 2, cardY, CW, CH, label, { stroke: '#6366f1' });
  });

  // Vertical connector lines (binding-less)
  const lines: TemplateShape[] = MILESTONES.map((_, i) => {
    const cx = i * STEP;
    const above = i % 2 === 0;
    const lineStartY = above ? -(OH / 2) : OH / 2;
    const lineEndY   = above ? -(OH / 2 + ABOVE) : OH / 2 + ABOVE;
    const lineId = createId();
    return {
      ...getStylePreset('line'),
      _tid: lineId, type: 'line',
      x: cx, y: lineStartY, width: 0, height: 0, zIndex: 0,
      points: [{ x: 0, y: 0 }, { x: 0, y: lineEndY - lineStartY }],
      seed: randomSeed(),
    } as TemplateShape;
  });

  return { label: 'Timeline', shapes: [axis, ...lines, ...dots, ...cards] };
}

function makeUmlClass(): Template {
  const W = 200, HDR = 44, ROW = 28;
  const ATTRS = ['- id: int', '- name: string', '- email: string'];
  const METHS = ['+ getId(): int', '+ save(): void'];
  const GAP = 120;

  function umlClass(x: number, name: string): TemplateShape[] {
    const header = s_rect(x, 0, W, HDR, name, { stroke: '#6366f1', fill: '#eef2ff', strokeWidth: 1.8 });
    const attrBox = s_rect(x, HDR, W, ATTRS.length * ROW, ATTRS.join('\n'), { stroke: '#6366f1', strokeWidth: 1 });
    const methBox = s_rect(x, HDR + ATTRS.length * ROW, W, METHS.length * ROW, METHS.join('\n'), { stroke: '#6366f1', strokeWidth: 1 });
    return [header, attrBox, methBox];
  }

  const cls1 = umlClass(0, 'User');
  const cls2 = umlClass(W + GAP, 'Order');

  const arrow = s_arrow(
    port(cls1[0], 'right'),
    port(cls2[0], 'left'),
    { endArrowhead: 'triangle', text: 'has many' }
  );

  return { label: 'UML Class', shapes: [...cls1, ...cls2, arrow] };
}

function makeVennDiagram(): Template {
  return { label: 'Venn Diagram', shapes: [
    builtInNode('setA', 'ellipse', -190, -132, 'Set A', 220, 220, { stroke: '#6366f1', fill: '#6366f1', opacity: 0.25 }),
    builtInNode('setB', 'ellipse', -30, -132, 'Set B', 220, 220, { stroke: '#ec4899', fill: '#ec4899', opacity: 0.25 }),
    builtInNode('setC', 'ellipse', -110, 28, 'Set C', 220, 220, { stroke: '#f59e0b', fill: '#f59e0b', opacity: 0.25 }),
  ] };
}

function makeFishbone(): Template {
  // Spine: left to right, "Problem" label at the right end
  const SPINE_W = 500, RIB_LEN = 140, RIB_ANGLE = 35;
  const dy = Math.tan(RIB_ANGLE * Math.PI / 180) * RIB_LEN;

  const headW = 120, headH = 52;
  const head = s_rect(SPINE_W, -headH / 2, headW, headH, 'Problem', { stroke: '#ef4444', fill: '#fef2f2' });

  // Spine (binding-less arrow pointing to head)
  const spineId = createId();
  const spine: TemplateShape = {
    ...getStylePreset('arrow'),
    _tid: spineId, type: 'arrow',
    x: 0, y: 0, width: 0, height: 0, zIndex: 0,
    points: [{ x: 0, y: 0 }, { x: SPINE_W, y: 0 }],
    seed: randomSeed(),
  } as TemplateShape;

  const categories = ['Method', 'Machine', 'Material', 'People'];
  const positions = [SPINE_W * 0.2, SPINE_W * 0.45, SPINE_W * 0.2, SPINE_W * 0.45];
  const sides: Array<1 | -1> = [1, 1, -1, -1]; // 1=above, -1=below

  const LW = 110, LH = 44;
  const ribs: TemplateShape[] = [];
  const labels: TemplateShape[] = [];

  categories.forEach((cat, i) => {
    const sx = positions[i];
    const side = sides[i];
    const ribId = createId();
    ribs.push({
      ...getStylePreset('line'),
      _tid: ribId, type: 'line',
      x: sx, y: 0, width: 0, height: 0, zIndex: 0,
      points: [{ x: 0, y: 0 }, { x: -RIB_LEN * Math.cos(RIB_ANGLE * Math.PI / 180), y: side * -dy }],
      seed: randomSeed(),
    } as TemplateShape);

    const lx = sx - RIB_LEN * Math.cos(RIB_ANGLE * Math.PI / 180) - LW / 2;
    const ly = side * -dy - (side === 1 ? LH + 8 : -8);
    labels.push(s_rect(lx, ly, LW, LH, cat, { stroke: '#64748b' }));
  });

  return { label: 'Fishbone', shapes: [spine, ...ribs, head, ...labels] };
}

function makeWireframe(): Template {
  return { label: 'Wireframe', shapes: [
    builtInNode('header', 'rectangle', 0, -12, 'Header / Nav', 720, 60, { stroke: '#94a3b8', fill: '#f1f5f9' }),
    builtInNode('sidebar', 'rectangle', 0, 64, 'Sidebar', 160, 400, { stroke: '#94a3b8', fill: '#f8fafc' }),
    builtInNode('footer', 'rectangle', 0, 472, 'Footer', 720, 48, { stroke: '#94a3b8', fill: '#f1f5f9' }),
    builtInNode('content1', 'rectangle', 168, 64, 'Content 1', 552, 120, { stroke: '#cbd5e1' }),
    builtInNode('content2', 'rectangle', 168, 200, 'Content 2', 552, 120, { stroke: '#cbd5e1' }),
    builtInNode('content3', 'rectangle', 168, 336, 'Content 3', 552, 120, { stroke: '#cbd5e1' }),
  ] };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TEMPLATES: Record<string, Template> = {
  'decision-tree': makeDecisionTree(),
  'flowchart':     makeFlowchart(),
  'db-schema':     makeDbSchema(),
  'user-flow':     makeUserFlow(),
  'mind-map':      makeMindMap(),
  'swot':          makeSwot(),
  'org-chart':     makeOrgChart(),
  'timeline':      makeTimeline(),
  'uml-class':     makeUmlClass(),
  'venn':          makeVennDiagram(),
  'fishbone':      makeFishbone(),
  'wireframe':     makeWireframe(),
};
