import type { Shape, Point, ConnectionPoint, PointerPayload, ICanvasAPI } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { buildRoughOptions } from '../geometry/lineUtils';
import { BaseRectPlugin } from './BaseRectPlugin';

function buildDiamondPath(ctx: CanvasRenderingContext2D, pts: Point[], r: number) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const d1 = Math.hypot(prev.x - curr.x, prev.y - curr.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const t1 = d1 > 0 ? Math.min(r / d1, 0.45) : 0;
    const t2 = d2 > 0 ? Math.min(r / d2, 0.45) : 0;
    const p1x = curr.x + (prev.x - curr.x) * t1;
    const p1y = curr.y + (prev.y - curr.y) * t1;
    const p2x = curr.x + (next.x - curr.x) * t2;
    const p2y = curr.y + (next.y - curr.y) * t2;
    if (i === 0) ctx.moveTo(p1x, p1y); else ctx.lineTo(p1x, p1y);
    ctx.quadraticCurveTo(curr.x, curr.y, p2x, p2y);
  }
  ctx.closePath();
}

function buildDiamondSvgPath(pts: Point[], r: number): string {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const d1 = Math.hypot(prev.x - curr.x, prev.y - curr.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const t1 = d1 > 0 ? Math.min(r / d1, 0.45) : 0;
    const t2 = d2 > 0 ? Math.min(r / d2, 0.45) : 0;
    const p1x = curr.x + (prev.x - curr.x) * t1;
    const p1y = curr.y + (prev.y - curr.y) * t1;
    const p2x = curr.x + (next.x - curr.x) * t2;
    const p2y = curr.y + (next.y - curr.y) * t2;
    d += i === 0 ? `M ${p1x} ${p1y}` : ` L ${p1x} ${p1y}`;
    d += ` Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
  }
  return d + ' Z';
}

export class DiamondPlugin extends BaseRectPlugin {
  type = 'diamond';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', fill: 'transparent', strokeWidth: 1, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'fill', 'fillStyle', 'roughness', 'opacity', 'layer', 'action'];

  getCornerRadius(shape: Shape): number {
    const w = shape.width || 0, h = shape.height || 0;
    return Math.min(w, h) * 0.15;
  }

  render(rc: any, _ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const r = this.getCornerRadius(shape);
    const tips: Point[] = [
      { x: cx,          y: shape.y     },
      { x: shape.x + w, y: cy          },
      { x: cx,          y: shape.y + h },
      { x: shape.x,     y: cy          },
    ];

    const options = buildRoughOptions(shape, theme);
    rc.path(buildDiamondSvgPath(tips, r), options);
  }

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const cx = x + w / 2, cy = y + h / 2;
    buildDiamondPath(ctx, [
      { x: cx,    y      },
      { x: x + w, y: cy  },
      { x: cx,    y: y+h },
      { x,        y: cy  },
    ], this.getCornerRadius(shape));
    ctx.stroke();
  }

  /** 4-point handle hit test at the actual rendered tip positions (matching bracket locations). */
  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 14;
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const hyp = Math.hypot(w / 2, h / 2);
    const t = hyp > 0 ? Math.min(this.getCornerRadius(shape) / hyp, 0.45) : 0;

    const nTipY = shape.y     + (h / 4) * t;
    const eTipX = shape.x + w - (w / 4) * t;
    const sTipY = shape.y + h - (h / 4) * t;
    const wTipX = shape.x     + (w / 4) * t;

    if (Math.abs(point.x - cx)    <= d && Math.abs(point.y - nTipY) <= d) return 'n';
    if (Math.abs(point.x - eTipX) <= d && Math.abs(point.y - cy)    <= d) return 'e';
    if (Math.abs(point.x - cx)    <= d && Math.abs(point.y - sTipY) <= d) return 's';
    if (Math.abs(point.x - wTipX) <= d && Math.abs(point.y - cy)    <= d) return 'w';
    return null;
  }

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const { x, y } = shape;
    const w = shape.width ?? 0, h = shape.height ?? 0;
    const cx = x + w / 2, cy = y + h / 2;
    const r = this.getCornerRadius(shape);
    // Half-diagonal of one edge (e.g. top-left edge from left-tip to top-tip)
    const d = Math.hypot(w / 2, h / 2);
    const t = d > 0 ? Math.min(r / d, 0.45) : 0;
    // Actual bezier peak = bbox tip + inset of (side/4)*t toward center
    return [
      { id: 'top',    x: cx,              y: y     + (h / 4) * t, side: 'top'    },
      { id: 'right',  x: x + w - (w / 4) * t, y: cy,             side: 'right'  },
      { id: 'bottom', x: cx,              y: y + h - (h / 4) * t, side: 'bottom' },
      { id: 'left',   x: x     + (w / 4) * t, y: cy,             side: 'left'   },
    ];
  }



  isPointInside(point: Point, shape: Shape): boolean {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const hasFill = shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none';
    const t = Math.max(8, (shape.strokeWidth || 1) + 7);
    // Diamond hit test: use L1 (taxicab) norm. Outer = inflated diamond, Inner = deflated diamond
    const dxOuter = Math.abs(point.x - cx) / (w / 2 + t);
    const dyOuter = Math.abs(point.y - cy) / (h / 2 + t);
    if (dxOuter + dyOuter > 1) return false;
    if (hasFill) return true;
    const rxi = Math.max(0, w / 2 - t);
    const ryi = Math.max(0, h / 2 - t);
    if (rxi === 0 || ryi === 0) return true;
    const dxInner = Math.abs(point.x - cx) / rxi;
    const dyInner = Math.abs(point.y - cy) / ryi;
    return dxInner + dyInner >= 1;
  }

  getResizeHandlePositions(shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const cx = x + w / 2, cy = y + h / 2;
    const r = this.getCornerRadius(shape);
    const hyp = Math.hypot(w / 2, h / 2);
    // t: fraction setback along each edge — determines where rendered tip peak lands
    const t = hyp > 0 ? Math.min(r / hyp, 0.45) : 0;

    // Quadratic bezier peak (rendered tip) = midpoint(p1,p2) * 0.5 + ctrl * 0.5
    // peak_y for N = y + (h/2)*t*0.5 = y + (h*t)/4
    const nTipY  = y     + (h / 4) * t;
    const eTipX  = x + w - (w / 4) * t;
    const sTipY  = y + h - (h / 4) * t;
    const wTipX  = x     + (w / 4) * t;

    // Compute sub-arc of each tip's bezier via de Casteljau, capped to ARM pixels half-chord.
    // This guarantees the handle brackets lie exactly on the rendered diamond outline.
    const hw = w / 2, hh = h / 2;
    const ARM = 11;

    // subArc: returns {q0, ctrl, q2} for a symmetric quadratic bezier sub-arc capped to halfChordCap.
    // Original bezier: P0=(p0x,p0y), Ctrl=(cx,cy), P2=(p2x,p2y) — symmetric about the ctrl point.
    // halfFull: half-chord of the full arc (hw*t for N/S, hh*t for E/W in their dominant axis).
    const subArcH = (
      fullHalfH: number, fullHalfV: number, ctrl: [number, number], sign: 1 | -1
    ) => {
      const cap = Math.min(fullHalfH, ARM);
      const s = fullHalfH > 0 ? cap / fullHalfH : 0;
      const s2 = s * s;
      // Sub-arc endpoints (on the original bezier)
      const q0x = ctrl[0] - cap,          q0y = ctrl[1] + sign * fullHalfV * (1 + s2) / 2;
      const q2x = ctrl[0] + cap,          q2y = q0y;
      const qcx = ctrl[0],                qcy = ctrl[1] + sign * fullHalfV * (1 - s2) / 2;
      return { q0x, q0y, qcx, qcy, q2x, q2y };
    };
    const subArcV = (
      fullHalfV: number, fullHalfH: number, ctrl: [number, number], xDir: 1 | -1
    ) => {
      // xDir: -1 for E tip (inward = negative x from ctrl), +1 for W tip (inward = positive x)
      const cap = Math.min(fullHalfV, ARM);
      const s = fullHalfV > 0 ? cap / fullHalfV : 0;
      const s2 = s * s;
      const q0x = ctrl[0] + xDir * fullHalfH * (1 + s2) / 2, q0y = ctrl[1] - cap;
      const q2x = q0x,                                         q2y = ctrl[1] + cap;
      const qcx = ctrl[0] + xDir * fullHalfH * (1 - s2) / 2, qcy = ctrl[1];
      return { q0x, q0y, qcx, qcy, q2x, q2y };
    };

    const n = subArcH(hw * t, hh * t, [cx,   y    ],  1);
    const e = subArcV(hh * t, hw * t, [x + w, cy   ], -1);
    const s = subArcH(hw * t, hh * t, [cx,   y + h], -1);
    const ww = subArcV(hh * t, hw * t, [x,    cy   ],  1);

    const arc = (q0x: number, q0y: number, qcx: number, qcy: number, q2x: number, q2y: number) =>
      (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.moveTo(q0x, q0y);
        ctx.quadraticCurveTo(qcx, qcy, q2x, q2y);
        ctx.stroke();
      };

    return [
      { x: cx,    y: nTipY, angle: -Math.PI / 2, draw: arc(n.q0x,  n.q0y,  n.qcx,  n.qcy,  n.q2x,  n.q2y)  },
      { x: eTipX, y: cy,    angle:  0,            draw: arc(e.q0x,  e.q0y,  e.qcx,  e.qcy,  e.q2x,  e.q2y)  },
      { x: cx,    y: sTipY, angle:  Math.PI / 2,  draw: arc(s.q0x,  s.q0y,  s.qcx,  s.qcy,  s.q2x,  s.q2y)  },
      { x: wTipX, y: cy,    angle:  Math.PI,      draw: arc(ww.q0x, ww.q0y, ww.qcx, ww.qcy, ww.q2x, ww.q2y) },
    ];
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape, _allShapes: Shape[], _theme: 'light' | 'dark') {
    const bounds = this.getBounds(shape);
    if (shape.locked) drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
  }
}
