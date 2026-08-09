import type { Shape, Point, ConnectionPoint } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';
import { getThemeAdjustedStroke } from '../geometry/lineUtils';

const FOLD = 24; // folded-corner size in px (scales with shape if smaller)

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
    textPaddingX: 16,
    textPaddingY: 16,
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

    // 1. Draw Main Drop Shadow
    ctx.save();
    ctx.shadowColor = theme === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.shadowOffsetX = 2;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();

    // 2. Fill Main Body
    ctx.fillStyle = fill;
    ctx.fill();

    // (Body gradient removed per user request)

    // 4. Draw Fold Shadow (Clipped so it doesn't bleed outside paper)
    ctx.save();
    ctx.clip(); // Clip to main body path
    ctx.beginPath();
    ctx.moveTo(x + w - fold, y);
    ctx.lineTo(x + w, y + fold);
    ctx.lineTo(x + w - fold, y + fold);
    ctx.closePath();
    ctx.shadowColor = theme === 'light' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = -2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = fill;
    ctx.fill(); // Casts shadow onto main body
    ctx.restore(); // Remove clip

    // 5. Draw Fold Triangle
    ctx.beginPath();
    ctx.moveTo(x + w - fold, y);
    ctx.lineTo(x + w, y + fold);
    ctx.lineTo(x + w - fold, y + fold);
    ctx.closePath();

    // Fold back base color
    ctx.fillStyle = fill;
    ctx.fill();

    // Fold 3D Gradient
    const foldGrad = ctx.createLinearGradient(x + w - fold, y, x + w - fold, y + fold);
    foldGrad.addColorStop(0, theme === 'light' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.15)');
    foldGrad.addColorStop(1, theme === 'light' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = foldGrad;
    ctx.fill();

    // 6. Crease Highlight Line
    ctx.beginPath();
    ctx.moveTo(x + w - fold, y);
    ctx.lineTo(x + w, y + fold);
    ctx.strokeStyle = theme === 'light' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 7. Subtle Border Stroke (if requested)
    if (shape.strokeWidth && shape.strokeWidth > 0 && shape.stroke !== 'transparent') {
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
      ctx.strokeStyle = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = shape.strokeWidth;
      ctx.stroke();
    }

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
