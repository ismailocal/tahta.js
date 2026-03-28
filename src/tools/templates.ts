import type { Shape, Point } from '../core/types';
import { createId } from '../core/Utils';

export type Template = {
  label: string;
  build: (origin: Point) => Shape[];
};

function arrow(
  x1: number, y1: number, x2: number, y2: number,
  opts: Partial<Shape> = {}
): Shape {
  return {
    id: createId(), type: 'arrow', x: x1, y: y1, width: 0, height: 0, zIndex: 0,
    points: [{ x: 0, y: 0 }, { x: x2 - x1, y: y2 - y1 }],
    stroke: '#94a3b8', strokeWidth: 1, roughness: 0, opacity: 1,
    edgeStyle: 'straight', startArrowhead: 'none', endArrowhead: 'arrow',
    seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  } as Shape;
}

function rect(
  x: number, y: number, w: number, h: number,
  text: string, opts: Partial<Shape> = {}
): Shape {
  return {
    id: createId(), type: 'rectangle', x, y, width: w, height: h, zIndex: 0,
    stroke: '#8b5cf6', fill: 'transparent', strokeWidth: 1, roughness: 0,
    roundness: 'round', opacity: 1, text,
    seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  } as Shape;
}

function oval(
  x: number, y: number, w: number, h: number,
  text: string, opts: Partial<Shape> = {}
): Shape {
  return {
    id: createId(), type: 'ellipse', x, y, width: w, height: h, zIndex: 0,
    stroke: '#06b6d4', fill: 'transparent', strokeWidth: 1, roughness: 0,
    opacity: 1, text,
    seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  } as Shape;
}

function diamond(
  x: number, y: number, w: number, h: number,
  text: string, opts: Partial<Shape> = {}
): Shape {
  return {
    id: createId(), type: 'diamond', x, y, width: w, height: h, zIndex: 0,
    stroke: '#f8fafc', fill: 'transparent', strokeWidth: 1, roughness: 0,
    opacity: 1, text,
    seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  } as Shape;
}

function dbTable(
  x: number, y: number, tableName: string,
  columns: Array<{ name: string; type: string; pk?: boolean; fk?: boolean }>,
  opts: Partial<Shape> = {}
): Shape {
  return {
    id: createId(), type: 'db-table', x, y, width: 220, height: 0, zIndex: 0,
    stroke: '#a78bfa', opacity: 1,
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
      const yesX = cx - SIDE - W / 2, yesY = y + DH + VERT;
      const yes    = rect(yesX, yesY, W, H, 'Evet',  { stroke: '#22c55e' });
      const noX = cx + SIDE - W / 2, noY = y + DH + VERT;
      const no     = rect(noX, noY, W, H, 'Hayır', { stroke: '#ef4444' });
      const resY   = yesY + H + VERT;
      const yesEnd = oval(cx - SIDE - 70, resY, 140, H, 'Sonuç A');
      const noEnd  = oval(cx + SIDE - 70, resY, 140, H, 'Sonuç B');

      const leftTipX = cx - DW / 2, leftTipY = y + DH / 2;
      const rightTipX = cx + DW / 2, rightTipY = y + DH / 2;
      const yesCx = yesX + W / 2, noCx = noX + W / 2;

      return [
        root, yes, no, yesEnd, noEnd,
        arrow(leftTipX,  leftTipY,  yesX + W,  yesY + H / 2,
          { text: 'Evet',  startBinding: { elementId: root.id }, endBinding: { elementId: yes.id } }),
        arrow(rightTipX, rightTipY, noX, noY + H / 2,
          { text: 'Hayır', startBinding: { elementId: root.id }, endBinding: { elementId: no.id } }),
        arrow(yesCx, yesY + H, yesCx, resY,
          { startBinding: { elementId: yes.id }, endBinding: { elementId: yesEnd.id } }),
        arrow(noCx, noY + H, noCx, resY,
          { startBinding: { elementId: no.id },  endBinding: { elementId: noEnd.id } }),
      ];
    },
  },

  'flowchart': {
    label: 'Akış Şeması',
    build({ x, y }) {
      // x,y is top-center
      const W = 160, H = 52, DW = 200, DH = 72, GAP = 80;
      const cx = x;

      const y0 = y;                  // start
      const y1 = y0 + H + GAP;       // process
      const y2 = y1 + H + GAP;       // decide
      const y3 = y2 + DH + GAP;      // yes path
      const y4 = y3 + H + GAP;       // end

      const start   = oval(cx - W / 2,   y0, W,   H,   'Başlangıç', { stroke: '#06b6d4' });
      const process = rect(cx - W / 2,   y1, W,   H,   'İşlem',     { stroke: '#8b5cf6' });
      const decide  = diamond(cx - DW / 2, y2, DW, DH, 'Koşul?');
      const yes     = rect(cx - W / 2,   y3, W,   H,   'Evet yolu', { stroke: '#22c55e' });
      const noX     = cx + DW / 2 + 60;
      const noY     = y2 + DH / 2 - H / 2;
      const no      = rect(noX,           noY, W,  H,   'Hayır yolu', { stroke: '#ef4444' });
      const end     = oval(cx - W / 2,   y4, W,   H,   'Bitiş',     { stroke: '#06b6d4' });

      return [
        start, process, decide, yes, no, end,
        arrow(cx, y0 + H, cx, y1,
          { startBinding: { elementId: start.id },   endBinding: { elementId: process.id } }),
        arrow(cx, y1 + H, cx, y2,
          { startBinding: { elementId: process.id }, endBinding: { elementId: decide.id } }),
        arrow(cx, y2 + DH, cx, y3,
          { text: 'Evet',  startBinding: { elementId: decide.id }, endBinding: { elementId: yes.id } }),
        arrow(cx + DW / 2, y2 + DH / 2, noX, noY + H / 2,
          { text: 'Hayır', startBinding: { elementId: decide.id }, endBinding: { elementId: no.id } }),
        arrow(cx, y3 + H, cx, y4,
          { startBinding: { elementId: yes.id },     endBinding: { elementId: end.id } }),
      ];
    },
  },

  'db-schema': {
    label: 'DB Şeması',
    build({ x, y }) {
      // x,y is top-left of first table
      const users = dbTable(x, y, 'users', [
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
      const items = dbTable(x + 600, y, 'order_items', [
        { name: 'id',         type: 'INT',       pk: true },
        { name: 'order_id',   type: 'INT',       fk: true },
        { name: 'product',    type: 'VARCHAR' },
        { name: 'quantity',   type: 'INT' },
        { name: 'price',      type: 'DECIMAL' },
      ]);

      // Connect at row 1 center (header=36, row=28 → center of row0 = 36+14 = 50)
      return [
        users, orders, items,
        arrow(x + 220, y + 50, x + 300, y + 50,
          { stroke: '#a78bfa', startBinding: { elementId: users.id }, endBinding: { elementId: orders.id } }),
        arrow(x + 520, y + 50, x + 600, y + 50,
          { stroke: '#a78bfa', startBinding: { elementId: orders.id }, endBinding: { elementId: items.id } }),
      ];
    },
  },

  'user-flow': {
    label: 'Kullanıcı Akışı',
    build({ x, y }) {
      // Horizontal flow, x,y is top-left of first box
      const W = 150, H = 52, DW = 180, DH = 72, GAP = 60;
      const cy = y + H / 2;  // vertical center of regular boxes

      const x0 = x;
      const x1 = x0 + W + GAP;
      const x2 = x1 + W + GAP;
      const x3 = x2 + DW + GAP;

      // Diamond vertically centered with regular boxes
      const dY = y + H / 2 - DH / 2;

      const login     = rect(x0, y,   W,   H,   'Giriş',     { stroke: '#06b6d4' });
      const dashboard = rect(x1, y,   W,   H,   'Dashboard', { stroke: '#8b5cf6' });
      const action    = diamond(x2, dY, DW, DH,  'Aksiyon?');
      const success   = rect(x3, y - 20,      W, H, 'Başarı', { stroke: '#22c55e' });
      const error     = rect(x3, y + H + 20,  W, H, 'Hata',   { stroke: '#ef4444' });
      const logout    = oval(x0, y + H + 100, W, H, 'Çıkış',  { stroke: '#94a3b8' });

      return [
        login, dashboard, action, success, error, logout,
        arrow(x0 + W,  cy, x1, cy,
          { startBinding: { elementId: login.id },     endBinding: { elementId: dashboard.id } }),
        arrow(x1 + W,  cy, x2, cy,
          { startBinding: { elementId: dashboard.id }, endBinding: { elementId: action.id } }),
        arrow(x2 + DW, cy, x3, y - 20 + H / 2,
          { text: 'Evet',  startBinding: { elementId: action.id }, endBinding: { elementId: success.id } }),
        arrow(x2 + DW / 2, dY + DH, x3, y + H + 20 + H / 2,
          { text: 'Hayır', startBinding: { elementId: action.id }, endBinding: { elementId: error.id } }),
        arrow(x0 + W / 2, y + H, x0 + W / 2, y + H + 100,
          { startBinding: { elementId: login.id },     endBinding: { elementId: logout.id } }),
      ];
    },
  },

  'mind-map': {
    label: 'Mind Map',
    build({ x, y }) {
      // x,y is center of the mind map
      const CW = 160, CH = 52, BW = 130, BH = 44;
      const HGAP = 100, VGAP = 30;  // gaps between center and branches

      const center = rect(x - CW / 2, y - CH / 2, CW, CH, 'Ana Fikir', {
        stroke: '#f59e0b', fill: '#1c1310',
      });

      // branch positions: left-top, left-bottom, right-top, right-bottom
      const branches = [
        { bx: x - CW / 2 - HGAP - BW, by: y - CH / 2 - BH - VGAP, label: 'Konu 1', color: '#8b5cf6' },
        { bx: x - CW / 2 - HGAP - BW, by: y + CH / 2 + VGAP,        label: 'Konu 3', color: '#22c55e' },
        { bx: x + CW / 2 + HGAP,      by: y - CH / 2 - BH - VGAP,   label: 'Konu 2', color: '#06b6d4' },
        { bx: x + CW / 2 + HGAP,      by: y + CH / 2 + VGAP,         label: 'Konu 4', color: '#f43f5e' },
      ];

      const nodes = branches.map(b => rect(b.bx, b.by, BW, BH, b.label, { stroke: b.color }));

      const arrs = branches.map((b, i) => {
        const isLeft = b.bx < x;
        const ax1 = isLeft ? b.bx + BW : b.bx;
        const ay1 = b.by + BH / 2;
        const ax2 = isLeft ? x - CW / 2 : x + CW / 2;
        const ay2 = b.by + BH / 2 < y ? y - CH / 2 : y + CH / 2;
        return arrow(ax1, ay1, ax2, ay2, {
          startArrowhead: 'none', endArrowhead: 'none', stroke: branches[i].color,
          startBinding: { elementId: nodes[i].id },
          endBinding:   { elementId: center.id },
        });
      });

      return [center, ...nodes, ...arrs];
    },
  },
};
