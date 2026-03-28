import type { Shape, Point, ConnectionPoint } from '../core/types';
import { drawLockIcon } from '../core/Utils';
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
    // p1: point on incoming edge, t1 fraction from curr back toward prev
    const p1x = curr.x + (prev.x - curr.x) * t1;
    const p1y = curr.y + (prev.y - curr.y) * t1;
    // p2: point on outgoing edge, t2 fraction from curr toward next
    const p2x = curr.x + (next.x - curr.x) * t2;
    const p2y = curr.y + (next.y - curr.y) * t2;
    if (i === 0) ctx.moveTo(p1x, p1y); else ctx.lineTo(p1x, p1y);
    ctx.quadraticCurveTo(curr.x, curr.y, p2x, p2y);
  }
  ctx.closePath();
}

export class DiamondPlugin extends BaseRectPlugin {
  type = 'diamond';
  defaultStyle: Partial<Shape> = { stroke: '#f8fafc', fill: 'transparent', strokeWidth: 1, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'fill', 'layer', 'action'];

  getCornerRadius(shape: Shape): number {
    const w = shape.width || 0, h = shape.height || 0;
    return Math.min(w, h) * 0.15;
  }

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape) {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const r = this.getCornerRadius(shape);

    ctx.save();
    buildDiamondPath(ctx, [
      { x: cx,          y: shape.y     },
      { x: shape.x + w, y: cy          },
      { x: cx,          y: shape.y + h },
      { x: shape.x,     y: cy          },
    ], r);

    if (shape.fill && shape.fill !== 'transparent') {
      ctx.fillStyle = shape.fill;
      ctx.fill();
    }

    ctx.strokeStyle = shape.stroke || '#f8fafc';
    ctx.lineWidth = shape.strokeWidth || 1;
    if (shape.strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
    else if (shape.strokeStyle === 'dotted') ctx.setLineDash([2, 6]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();
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
    const { x, y, width: w, height: h } = shape;
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
    const dx = Math.abs(point.x - cx) / (w / 2 + 8);
    const dy = Math.abs(point.y - cy) / (h / 2 + 8);
    return dx + dy <= 1;
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

    // Setback points for the bracket bezier (same geometry as buildDiamondPath)
    const hw = w / 2, hh = h / 2;
    const nP1x = cx - hw * t, nP1y = y  + hh * t;
    const nP2x = cx + hw * t, nP2y = nP1y;
    const eP1x = x+w - hw*t,  eP1y = cy - hh * t;
    const eP2x = eP1x,        eP2y = cy + hh * t;
    const sP1x = cx + hw * t, sP1y = y+h - hh * t;
    const sP2x = cx - hw * t, sP2y = sP1y;
    const wP1x = x  + hw * t, wP1y = cy + hh * t;
    const wP2x = wP1x,        wP2y = cy - hh * t;

    const bezier = (p1x: number, p1y: number, ctrlX: number, ctrlY: number, p2x: number, p2y: number) =>
      (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, p2x, p2y);
        ctx.stroke();
      };

    return [
      { x: cx,    y: nTipY, angle: -Math.PI / 2, draw: bezier(nP1x, nP1y, cx,   y,    nP2x, nP2y) },
      { x: eTipX, y: cy,    angle:  0,            draw: bezier(eP1x, eP1y, x+w,  cy,   eP2x, eP2y) },
      { x: cx,    y: sTipY, angle:  Math.PI / 2,  draw: bezier(sP1x, sP1y, cx,   y+h,  sP2x, sP2y) },
      { x: wTipX, y: cy,    angle:  Math.PI,       draw: bezier(wP1x, wP1y, x,    cy,   wP2x, wP2y) },
    ];
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const bounds = this.getBounds(shape);
    if (shape.locked) drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
  }
}
