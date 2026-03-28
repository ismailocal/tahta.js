import type { Shape, Point } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { BaseRectPlugin } from './BaseRectPlugin';

export class DiamondPlugin extends BaseRectPlugin {
  type = 'diamond';
  customSelectionBrackets = true;
  defaultStyle: Partial<Shape> = { stroke: '#f8fafc', fill: 'transparent', strokeWidth: 1, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'fill', 'layer', 'action'];

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape) {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const r = Math.min(10, w * 0.12, h * 0.12);

    // 4 tips: N, E, S, W
    const pts = [
      { x: cx,           y: shape.y      },
      { x: shape.x + w,  y: cy           },
      { x: cx,           y: shape.y + h  },
      { x: shape.x,      y: cy           },
    ];

    ctx.save();
    ctx.beginPath();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const d1 = Math.hypot(prev.x - curr.x, prev.y - curr.y);
      const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
      const t1 = Math.min(r / d1, 0.4);
      const t2 = Math.min(r / d2, 0.4);
      const p1x = curr.x + (prev.x - curr.x) * t1;
      const p1y = curr.y + (prev.y - curr.y) * t1;
      const p2x = curr.x + (next.x - curr.x) * t2;
      const p2y = curr.y + (next.y - curr.y) * t2;
      if (i === 0) ctx.moveTo(p1x, p1y); else ctx.lineTo(p1x, p1y);
      ctx.quadraticCurveTo(curr.x, curr.y, p2x, p2y);
    }
    ctx.closePath();

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

  /** 4-point handle hit test at N/E/S/W diamond tips. */
  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 14;
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const pad = 6;

    if (Math.abs(point.x - cx)               <= d && Math.abs(point.y - (shape.y - pad))     <= d) return 'n';
    if (Math.abs(point.x - (shape.x + w + pad)) <= d && Math.abs(point.y - cy)               <= d) return 'e';
    if (Math.abs(point.x - cx)               <= d && Math.abs(point.y - (shape.y + h + pad)) <= d) return 's';
    if (Math.abs(point.x - (shape.x - pad))  <= d && Math.abs(point.y - cy)                  <= d) return 'w';
    return null;
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

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const cx = x + w / 2, cy = y + h / 2;
    const r = Math.min(10, w * 0.12, h * 0.12);
    const pts = [
      { x: cx,      y },
      { x: x + w,   y: cy },
      { x: cx,      y: y + h },
      { x,          y: cy },
    ];
    ctx.beginPath();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const d1 = Math.hypot(prev.x - curr.x, prev.y - curr.y);
      const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
      const t1 = Math.min(r / d1, 0.4), t2 = Math.min(r / d2, 0.4);
      const p1x = curr.x + (prev.x - curr.x) * t1, p1y = curr.y + (prev.y - curr.y) * t1;
      const p2x = curr.x + (next.x - curr.x) * t2, p2y = curr.y + (next.y - curr.y) * t2;
      if (i === 0) ctx.moveTo(p1x, p1y); else ctx.lineTo(p1x, p1y);
      ctx.quadraticCurveTo(curr.x, curr.y, p2x, p2y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const bounds = this.getBounds(shape);
    if (shape.locked) {
      drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
    }

    // V-shape brackets at diamond tips (N/E/S/W)
    const w = bounds.width;
    const h = bounds.height;
    const cx = bounds.x + w / 2;
    const cy = bounds.y + h / 2;
    const arm = Math.min(14, w * 0.18, h * 0.18);
    const color = shape.stroke || '#ffffff';
    const hw = w / 2, hh = h / 2;
    const lenNE = Math.hypot(hw, hh);
    const ux = hw / lenNE, uy = hh / lenNE;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // N tip
    ctx.beginPath();
    ctx.moveTo(cx - ux * arm, cy - hh + uy * arm);
    ctx.lineTo(cx, cy - hh);
    ctx.lineTo(cx + ux * arm, cy - hh + uy * arm);
    ctx.stroke();

    // S tip
    ctx.beginPath();
    ctx.moveTo(cx - ux * arm, cy + hh - uy * arm);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx + ux * arm, cy + hh - uy * arm);
    ctx.stroke();

    // E tip
    ctx.beginPath();
    ctx.moveTo(cx + hw - ux * arm, cy - uy * arm);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx + hw - ux * arm, cy + uy * arm);
    ctx.stroke();

    // W tip
    ctx.beginPath();
    ctx.moveTo(cx - hw + ux * arm, cy - uy * arm);
    ctx.lineTo(cx - hw, cy);
    ctx.lineTo(cx - hw + ux * arm, cy + uy * arm);
    ctx.stroke();

    ctx.restore();
  }
}
