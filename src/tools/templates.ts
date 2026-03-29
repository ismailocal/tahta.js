import type { Shape, Point } from '../core/types';
import { createId, randomSeed } from '../core/Utils';
import { getStylePreset } from '../core/constants';

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
  const DW = 180, DH = 70, W = 160, H = 52, SIDE = 210, VERT = 100;
  const cx = 0, y = 0;

  const root   = s_diamond(cx - DW / 2, y, DW, DH, 'Karar?');
  const yes    = s_rect(cx - SIDE - W / 2, y + DH + VERT, W, H, 'Evet',  { stroke: '#22c55e' });
  const no     = s_rect(cx + SIDE - W / 2, y + DH + VERT, W, H, 'Hayır', { stroke: '#ef4444' });
  const resY   = y + DH + VERT + H + VERT;
  const yesEnd = s_oval(cx - SIDE - 70, resY, 140, H, 'Sonuç A');
  const noEnd  = s_oval(cx + SIDE - 70, resY, 140, H, 'Sonuç B');

  return {
    label: 'Karar Ağacı',
    shapes: [
      root, yes, no, yesEnd, noEnd,
      s_arrow(port(root, 'left'),    port(yes, 'right'),   { text: 'Evet'  }),
      s_arrow(port(root, 'right'),   port(no, 'left'),     { text: 'Hayır' }),
      s_arrow(port(yes, 'bottom'),   port(yesEnd, 'top')),
      s_arrow(port(no, 'bottom'),    port(noEnd, 'top')),
    ],
  };
}

function makeFlowchart(): Template {
  const W = 160, H = 52, DW = 200, DH = 72, GAP = 80, cx = 0;
  const y0 = 0, y1 = y0 + H + GAP, y2 = y1 + H + GAP, y3 = y2 + DH + GAP, y4 = y3 + H + GAP;
  const noX = cx + DW / 2 + 60, noY = y2 + DH / 2 - H / 2;

  const start   = s_oval(cx - W / 2,     y0,  W,   H,  'Başlangıç');
  const process = s_rect(cx - W / 2,     y1,  W,   H,  'İşlem');
  const decide  = s_diamond(cx - DW / 2, y2,  DW,  DH, 'Koşul?');
  const yes     = s_rect(cx - W / 2,     y3,  W,   H,  'Evet yolu', { stroke: '#22c55e' });
  const no      = s_rect(noX,            noY, W,   H,  'Hayır yolu', { stroke: '#ef4444' });
  const end     = s_oval(cx - W / 2,     y4,  W,   H,  'Bitiş');

  return {
    label: 'Akış Şeması',
    shapes: [
      start, process, decide, yes, no, end,
      s_arrow(port(start,   'bottom'), port(process, 'top')),
      s_arrow(port(process, 'bottom'), port(decide,  'top')),
      s_arrow(port(decide,  'bottom'), port(yes,     'top'),  { text: 'Evet'  }),
      s_arrow(port(decide,  'right'),  port(no,      'left'), { text: 'Hayır' }),
      s_arrow(port(yes,     'bottom'), port(end,     'top')),
    ],
  };
}

function makeDbSchema(): Template {
  const users  = s_dbTable(0,   0, 'users', [
    { name: 'id', type: 'INT', pk: true }, { name: 'name', type: 'VARCHAR' },
    { name: 'email', type: 'VARCHAR' },    { name: 'created_at', type: 'TIMESTAMP' },
  ]);
  const orders = s_dbTable(300, 0, 'orders', [
    { name: 'id', type: 'INT', pk: true }, { name: 'user_id', type: 'INT', fk: true },
    { name: 'total', type: 'DECIMAL' },    { name: 'status', type: 'VARCHAR' },
    { name: 'created_at', type: 'TIMESTAMP' },
  ]);
  const items  = s_dbTable(600, 0, 'order_items', [
    { name: 'id', type: 'INT', pk: true }, { name: 'order_id', type: 'INT', fk: true },
    { name: 'product', type: 'VARCHAR' },  { name: 'quantity', type: 'INT' },
    { name: 'price', type: 'DECIMAL' },
  ]);

  // Use column-level port IDs that match DbTablePlugin.getConnectionPoints output
  function dbPort(s: TemplateShape, colIndex: number, side: 'left' | 'right') {
    const w = s.width || 0;
    const rowY = s.y + DB_HEADER + colIndex * DB_ROW + DB_ROW / 2;
    return { x: side === 'left' ? s.x : s.x + w, y: rowY, id: `col-${colIndex}-${side}`, shapeId: s._tid };
  }

  return {
    label: 'DB Şeması',
    shapes: [
      users, orders, items,
      s_arrow(dbPort(users,  0, 'right'), dbPort(orders, 1, 'left')),
      s_arrow(dbPort(orders, 0, 'right'), dbPort(items,  1, 'left')),
    ],
  };
}

function makeUserFlow(): Template {
  const W = 150, H = 52, DW = 180, DH = 72, GAP = 60;
  const x0 = 0, x1 = x0 + W + GAP, x2 = x1 + W + GAP, x3 = x2 + DW + GAP;
  const dY = H / 2 - DH / 2;

  const login     = s_rect(x0, 0,           W,  H,  'Giriş',     { stroke: '#06b6d4' });
  const dashboard = s_rect(x1, 0,           W,  H,  'Dashboard');
  const action    = s_diamond(x2, dY,       DW, DH, 'Aksiyon?');
  const success   = s_rect(x3, -20,         W,  H,  'Başarı',    { stroke: '#22c55e' });
  const error     = s_rect(x3, H + 20,      W,  H,  'Hata',      { stroke: '#ef4444' });
  const logout    = s_oval(x0, H + 100,     W,  H,  'Çıkış');

  return {
    label: 'Kullanıcı Akışı',
    shapes: [
      login, dashboard, action, success, error, logout,
      s_arrow(port(login,     'right'),  port(dashboard, 'left')),
      s_arrow(port(dashboard, 'right'),  port(action,    'left')),
      s_arrow(port(action,    'right'),  port(success,   'left'), { text: 'Evet'  }),
      s_arrow(port(action,    'bottom'), port(error,     'left'), { text: 'Hayır' }),
      s_arrow(port(login,     'bottom'), port(logout,    'top')),
    ],
  };
}

function makeMindMap(): Template {
  const CW = 160, CH = 52, BW = 130, BH = 44, HGAP = 100, VGAP = 30;

  const center = s_rect(-CW / 2, -CH / 2, CW, CH, 'Ana Fikir', {
    stroke: '#f59e0b', fill: '#1c1310',
  });

  const branches = [
    { bx: -CW / 2 - HGAP - BW, by: -CH / 2 - BH - VGAP, label: 'Konu 1', color: '#8b5cf6' },
    { bx: -CW / 2 - HGAP - BW, by:  CH / 2 + VGAP,       label: 'Konu 3', color: '#22c55e' },
    { bx:  CW / 2 + HGAP,      by: -CH / 2 - BH - VGAP,  label: 'Konu 2', color: '#06b6d4' },
    { bx:  CW / 2 + HGAP,      by:  CH / 2 + VGAP,        label: 'Konu 4', color: '#f43f5e' },
  ];

  const nodes = branches.map(b => s_rect(b.bx, b.by, BW, BH, b.label, { stroke: b.color }));

  const arrs = branches.map((b, i) => {
    const isLeft = b.bx < 0;
    return s_arrow(
      port(nodes[i], isLeft ? 'right' : 'left'),
      port(center,   isLeft ? 'left'  : 'right'),
      { endArrowhead: 'none', stroke: branches[i].color }
    );
  });

  return { label: 'Mind Map', shapes: [center, ...nodes, ...arrs] };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TEMPLATES: Record<string, Template> = {
  'decision-tree': makeDecisionTree(),
  'flowchart':     makeFlowchart(),
  'db-schema':     makeDbSchema(),
  'user-flow':     makeUserFlow(),
  'mind-map':      makeMindMap(),
};
