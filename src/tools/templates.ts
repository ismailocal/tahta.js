import type { Shape, Point } from '../core/types';
import { createId } from '../core/Utils';
import { getStylePreset } from '../core/constants';

export type Template = {
  label: string;
  build: (origin: Point) => Shape[];
};

// ─── Port helper ──────────────────────────────────────────────────────────────

type Side = 'top' | 'right' | 'bottom' | 'left';

function port(shape: Shape, side: Side): { x: number; y: number; id: string } {
  const w = shape.width || 0;
  const h = shape.height || 0;
  const cx = shape.x + w / 2;
  const cy = shape.y + h / 2;
  switch (side) {
    case 'top':    return { x: cx,         y: shape.y,     id: 'top'    };
    case 'right':  return { x: shape.x + w, y: cy,          id: 'right'  };
    case 'bottom': return { x: cx,         y: shape.y + h, id: 'bottom' };
    case 'left':   return { x: shape.x,    y: cy,          id: 'left'   };
  }
}

// ─── Shape helpers (all use plugin defaultStyle as base) ──────────────────────

function arrow(from: { x: number; y: number; id: string; shapeId: string },
               to:   { x: number; y: number; id: string; shapeId: string },
               opts: Partial<Shape> = {}): Shape {
  return {
    ...getStylePreset('arrow'),
    id: createId(), type: 'arrow',
    x: from.x, y: from.y, width: 0, height: 0, zIndex: 0,
    points: [{ x: 0, y: 0 }, { x: to.x - from.x, y: to.y - from.y }],
    startBinding: { elementId: from.shapeId, portId: from.id },
    endBinding:   { elementId: to.shapeId,   portId: to.id   },
    seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  } as Shape;
}

function rect(x: number, y: number, w: number, h: number,
              text: string, opts: Partial<Shape> = {}): Shape {
  return {
    ...getStylePreset('rectangle'),
    id: createId(), type: 'rectangle', x, y, width: w, height: h, zIndex: 0,
    text, seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  } as Shape;
}

function oval(x: number, y: number, w: number, h: number,
              text: string, opts: Partial<Shape> = {}): Shape {
  return {
    ...getStylePreset('ellipse'),
    id: createId(), type: 'ellipse', x, y, width: w, height: h, zIndex: 0,
    text, seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  } as Shape;
}

function diamond(x: number, y: number, w: number, h: number,
                 text: string, opts: Partial<Shape> = {}): Shape {
  return {
    ...getStylePreset('diamond'),
    id: createId(), type: 'diamond', x, y, width: w, height: h, zIndex: 0,
    text, seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  } as Shape;
}

function dbTable(x: number, y: number, tableName: string,
                 columns: Array<{ name: string; type: string; pk?: boolean; fk?: boolean }>,
                 opts: Partial<Shape> = {}): Shape {
  return {
    ...getStylePreset('db-table'),
    id: createId(), type: 'db-table', x, y, width: 220, height: 0, zIndex: 0,
    data: { tableName, columns },
    seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  } as Shape;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export const TEMPLATES: Record<string, Template> = {

  'decision-tree': {
    label: 'Karar Ağacı',
    build({ x, y }) {
      const DW = 180, DH = 70, W = 160, H = 52, SIDE = 210, VERT = 100;
      const cx = x;

      const root   = diamond(cx - DW / 2, y, DW, DH, 'Karar?');
      const yes    = rect(cx - SIDE - W / 2, y + DH + VERT, W, H, 'Evet',  { stroke: '#22c55e' });
      const no     = rect(cx + SIDE - W / 2, y + DH + VERT, W, H, 'Hayır', { stroke: '#ef4444' });
      const resY   = y + DH + VERT + H + VERT;
      const yesEnd = oval(cx - SIDE - 70, resY, 140, H, 'Sonuç A');
      const noEnd  = oval(cx + SIDE - 70, resY, 140, H, 'Sonuç B');

      return [
        root, yes, no, yesEnd, noEnd,
        arrow({ ...port(root,   'left'),  shapeId: root.id   },
              { ...port(yes,    'right'), shapeId: yes.id    }, { text: 'Evet'  }),
        arrow({ ...port(root,   'right'), shapeId: root.id   },
              { ...port(no,     'left'),  shapeId: no.id     }, { text: 'Hayır' }),
        arrow({ ...port(yes,    'bottom'), shapeId: yes.id   },
              { ...port(yesEnd, 'top'),    shapeId: yesEnd.id }),
        arrow({ ...port(no,     'bottom'), shapeId: no.id    },
              { ...port(noEnd,  'top'),    shapeId: noEnd.id  }),
      ];
    },
  },

  'flowchart': {
    label: 'Akış Şeması',
    build({ x, y }) {
      const W = 160, H = 52, DW = 200, DH = 72, GAP = 80;
      const cx = x;

      const y0 = y;
      const y1 = y0 + H + GAP;
      const y2 = y1 + H + GAP;
      const y3 = y2 + DH + GAP;
      const y4 = y3 + H + GAP;
      const noX = cx + DW / 2 + 60;
      const noY = y2 + DH / 2 - H / 2;

      const start   = oval(cx - W / 2,     y0,  W,   H,  'Başlangıç');
      const process = rect(cx - W / 2,     y1,  W,   H,  'İşlem');
      const decide  = diamond(cx - DW / 2, y2,  DW,  DH, 'Koşul?');
      const yes     = rect(cx - W / 2,     y3,  W,   H,  'Evet yolu', { stroke: '#22c55e' });
      const no      = rect(noX,            noY, W,   H,  'Hayır yolu', { stroke: '#ef4444' });
      const end     = oval(cx - W / 2,     y4,  W,   H,  'Bitiş');

      return [
        start, process, decide, yes, no, end,
        arrow({ ...port(start,   'bottom'), shapeId: start.id   },
              { ...port(process, 'top'),    shapeId: process.id }),
        arrow({ ...port(process, 'bottom'), shapeId: process.id },
              { ...port(decide,  'top'),    shapeId: decide.id  }),
        arrow({ ...port(decide,  'bottom'), shapeId: decide.id  },
              { ...port(yes,     'top'),    shapeId: yes.id     }, { text: 'Evet'  }),
        arrow({ ...port(decide,  'right'),  shapeId: decide.id  },
              { ...port(no,      'left'),   shapeId: no.id      }, { text: 'Hayır' }),
        arrow({ ...port(yes,     'bottom'), shapeId: yes.id     },
              { ...port(end,     'top'),    shapeId: end.id     }),
      ];
    },
  },

  'db-schema': {
    label: 'DB Şeması',
    build({ x, y }) {
      const users  = dbTable(x,       y, 'users', [
        { name: 'id',         type: 'INT',       pk: true },
        { name: 'name',       type: 'VARCHAR' },
        { name: 'email',      type: 'VARCHAR' },
        { name: 'created_at', type: 'TIMESTAMP' },
      ]);
      const orders = dbTable(x + 300, y, 'orders', [
        { name: 'id',         type: 'INT',       pk: true },
        { name: 'user_id',    type: 'INT',       fk: true },
        { name: 'total',      type: 'DECIMAL' },
        { name: 'status',     type: 'VARCHAR' },
        { name: 'created_at', type: 'TIMESTAMP' },
      ]);
      const items  = dbTable(x + 600, y, 'order_items', [
        { name: 'id',         type: 'INT',       pk: true },
        { name: 'order_id',   type: 'INT',       fk: true },
        { name: 'product',    type: 'VARCHAR' },
        { name: 'quantity',   type: 'INT' },
        { name: 'price',      type: 'DECIMAL' },
      ]);

      return [
        users, orders, items,
        arrow({ ...port(users,  'right'), shapeId: users.id  },
              { ...port(orders, 'left'),  shapeId: orders.id }),
        arrow({ ...port(orders, 'right'), shapeId: orders.id },
              { ...port(items,  'left'),  shapeId: items.id  }),
      ];
    },
  },

  'user-flow': {
    label: 'Kullanıcı Akışı',
    build({ x, y }) {
      const W = 150, H = 52, DW = 180, DH = 72, GAP = 60;
      const x0 = x, x1 = x0 + W + GAP, x2 = x1 + W + GAP, x3 = x2 + DW + GAP;
      const dY = y + H / 2 - DH / 2;

      const login     = rect(x0, y,           W,  H,  'Giriş',     { stroke: '#06b6d4' });
      const dashboard = rect(x1, y,           W,  H,  'Dashboard');
      const action    = diamond(x2, dY,       DW, DH, 'Aksiyon?');
      const success   = rect(x3, y - 20,      W,  H,  'Başarı',    { stroke: '#22c55e' });
      const error     = rect(x3, y + H + 20,  W,  H,  'Hata',      { stroke: '#ef4444' });
      const logout    = oval(x0, y + H + 100, W,  H,  'Çıkış');

      return [
        login, dashboard, action, success, error, logout,
        arrow({ ...port(login,     'right'),  shapeId: login.id     },
              { ...port(dashboard, 'left'),   shapeId: dashboard.id }),
        arrow({ ...port(dashboard, 'right'),  shapeId: dashboard.id },
              { ...port(action,    'left'),   shapeId: action.id    }),
        arrow({ ...port(action,    'right'),  shapeId: action.id    },
              { ...port(success,   'left'),   shapeId: success.id   }, { text: 'Evet'  }),
        arrow({ ...port(action,    'bottom'), shapeId: action.id    },
              { ...port(error,     'left'),   shapeId: error.id     }, { text: 'Hayır' }),
        arrow({ ...port(login,     'bottom'), shapeId: login.id     },
              { ...port(logout,    'top'),    shapeId: logout.id    }),
      ];
    },
  },

  'mind-map': {
    label: 'Mind Map',
    build({ x, y }) {
      const CW = 160, CH = 52, BW = 130, BH = 44, HGAP = 100, VGAP = 30;

      const center = rect(x - CW / 2, y - CH / 2, CW, CH, 'Ana Fikir', {
        stroke: '#f59e0b', fill: '#1c1310',
      });

      const branches = [
        { bx: x - CW / 2 - HGAP - BW, by: y - CH / 2 - BH - VGAP, label: 'Konu 1', color: '#8b5cf6' },
        { bx: x - CW / 2 - HGAP - BW, by: y + CH / 2 + VGAP,       label: 'Konu 3', color: '#22c55e' },
        { bx: x + CW / 2 + HGAP,      by: y - CH / 2 - BH - VGAP,  label: 'Konu 2', color: '#06b6d4' },
        { bx: x + CW / 2 + HGAP,      by: y + CH / 2 + VGAP,        label: 'Konu 4', color: '#f43f5e' },
      ];

      const nodes = branches.map(b => rect(b.bx, b.by, BW, BH, b.label, { stroke: b.color }));

      const arrs = branches.map((b, i) => {
        const isLeft = b.bx < x;
        const nodeSide: Side  = isLeft ? 'right' : 'left';
        const centerSide: Side = isLeft ? 'left'  : 'right';
        return arrow(
          { ...port(nodes[i], nodeSide),  shapeId: nodes[i].id },
          { ...port(center,   centerSide), shapeId: center.id  },
          { endArrowhead: 'none', stroke: branches[i].color }
        );
      });

      return [center, ...nodes, ...arrs];
    },
  },
};
