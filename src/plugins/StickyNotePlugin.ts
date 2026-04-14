import type { Shape, Point, ConnectionPoint } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';
import { getThemeAdjustedStroke } from '../geometry/lineUtils';

const FOLD = 18; // folded-corner size in px (scales with shape if smaller)

/**
 * Sticky note shape — solid colored background with a folded top-right corner.
 * Unlike RoughJS-based shapes, this renders with the canvas 2D API for a flat,
 * paper-like appearance. The fold shadow creates depth without looking sketchy.
 * Default fill is a warm yellow (#fde047). Border stroke is suppressed.
 */
export class StickyNotePlugin extends BaseRectPlugin {
  type = 'sticky-note';
  defaultStyle: Partial<Shape> = {
    stroke: '#ca8a04',
    fill: '#fde047',
    strokeWidth: 1,
    roughness: 0,
    opacity: 1,
  };
  defaultProperties = ['fill', 'stroke', 'opacity', 'textLayout', 'layer', 'action'];

  getCornerRadius(_shape: Shape): number { return 4; }

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const fold = Math.min(FOLD, w * 0.2, h * 0.2);
    const r = Math.min(this.getCornerRadius(shape), w / 2, h / 2);
    const fill = shape.fill || '#fde047';
    const accent = getThemeAdjustedStroke(shape.stroke, theme);

    ctx.save();
    ctx.globalAlpha = shape.opacity ?? 1;

    // Clipping region — full sticky body (with notched corner)
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - fold, y);
    ctx.lineTo(x + w, y + fold);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();

    ctx.fillStyle = fill;
    ctx.fill();

    // Subtle inner shadow along fold
    const grad = ctx.createLinearGradient(x + w - fold, y, x + w, y + fold);
    grad.addColorStop(0, 'rgba(0,0,0,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke border
    ctx.strokeStyle = accent;
    ctx.lineWidth = shape.strokeWidth || 1;
    ctx.stroke();

    // Fold triangle — slightly darker tint
    ctx.beginPath();
    ctx.moveTo(x + w - fold, y);
    ctx.lineTo(x + w, y + fold);
    ctx.lineTo(x + w - fold, y + fold);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = shape.strokeWidth || 1;
    ctx.stroke();

    ctx.restore();
  }

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const fold = Math.min(FOLD, w * 0.2, h * 0.2);
    const r = Math.min(this.getCornerRadius(shape), w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - fold, y);
    ctx.lineTo(x + w, y + fold);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.stroke();
  }

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const cx = x + w / 2, cy = y + h / 2;
    return [
      { id: 'top',    x: cx,    y,        side: 'top'    },
      { id: 'right',  x: x + w, y: cy,    side: 'right'  },
      { id: 'bottom', x: cx,    y: y + h, side: 'bottom' },
      { id: 'left',   x,        y: cy,    side: 'left'   },
    ];
  }
}
