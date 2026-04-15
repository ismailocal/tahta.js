import type { Shape, Point } from '../core/types';
import { createId, randomSeed } from '../core/Utils';
import { getStylePreset } from '../core/constants';
import { TEMPLATES_DSL } from './templates-dsl';
import { dslToJson, jsonToShapes } from '../dsl/converter';
import { registerAllPlugins } from '../dsl/plugins';

// Ensure DSL plugins are registered
registerAllPlugins();

// ─── Core data model ──────────────────────────────────────────────────────────

/**
 * A stored shape within a template. Positions are relative to the template
 * origin (0, 0). `_tid` is a stable intra-template ID used for binding refs.
 * Real `id`s are generated fresh on each instantiation.
 */
export type TemplateShape = Omit<Shape, 'id'> & { _tid: string };

export type Template = {
  label: string;
  shapes: TemplateShape[];
};

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
    const shape: Shape = {
      ...(s as any),
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
    const { id, ...rest } = s as any;
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

// ─── DSL to Template converter ───────────────────────────────────────────────────

/**
 * Convert DSL string to Template format
 * This bridges the DSL system with the existing Template format
 */
function dslToTemplate(dslText: string, label: string): Template {
  const doc = dslToJson(dslText);
  const shapes = jsonToShapes(doc);
  
  // Convert Shape[] to TemplateShape[] by replacing id with _tid
  const templateShapes: TemplateShape[] = shapes.map(s => {
    const { id, ...rest } = s as any;
    return { ...rest, _tid: id } as TemplateShape;
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

function s_diamond(x: number, y: number, w: number, h: number,
                   text: string, opts: Partial<Shape> = {}): TemplateShape {
  return {
    ...getStylePreset('diamond'),
    _tid: createId(), type: 'diamond', x, y, width: w, height: h, zIndex: 0,
    text, seed: randomSeed(), ...opts,
  } as TemplateShape;
}

const DB_HEADER = 36, DB_ROW = 28;

function s_dbTable(x: number, y: number, tableName: string,
                   columns: Array<{ name: string; type: string; pk?: boolean; fk?: boolean }>,
                   opts: Partial<Shape> = {}): TemplateShape {
  const height = DB_HEADER + Math.max(1, columns.length) * DB_ROW;
  return {
    ...getStylePreset('db-table'),
    _tid: createId(), type: 'db-table', x, y, width: 220, height, zIndex: 0,
    data: { tableName, columns },
    seed: randomSeed(), ...opts,
  } as TemplateShape;
}

// ─── Built-in templates ───────────────────────────────────────────────────────

function makeDecisionTree(): Template {
  return dslToTemplate(TEMPLATES_DSL['decision-tree'], 'Decision Tree');
}

function makeFlowchart(): Template {
  return dslToTemplate(TEMPLATES_DSL['flowchart'], 'Flowchart');
}

function makeDbSchema(): Template {
  return dslToTemplate(TEMPLATES_DSL['db-schema'], 'DB Schema');
}

function makeUserFlow(): Template {
  return dslToTemplate(TEMPLATES_DSL['user-flow'], 'User Flow');
}

function makeMindMap(): Template {
  return dslToTemplate(TEMPLATES_DSL['mind-map'], 'Mind Map');
}

function makeSwot(): Template {
  return dslToTemplate(TEMPLATES_DSL['swot'], 'SWOT Analysis');
}

function makeOrgChart(): Template {
  return dslToTemplate(TEMPLATES_DSL['org-chart'], 'Org Chart');
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
  const H = HDR + (ATTRS.length + METHS.length) * ROW;
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
    { endArrowhead: 'triangle', text: 'has many' } as any
  );

  return { label: 'UML Class', shapes: [...cls1, ...cls2, arrow] };
}

function makeVennDiagram(): Template {
  return dslToTemplate(TEMPLATES_DSL['venn'], 'Venn Diagram');
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
  return dslToTemplate(TEMPLATES_DSL['wireframe'], 'Wireframe');
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
