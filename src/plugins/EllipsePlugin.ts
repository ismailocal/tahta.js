import type { Shape, Point } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { BaseRectPlugin } from './BaseRectPlugin';

export class EllipsePlugin extends BaseRectPlugin {
  type = 'ellipse';
  customSelectionBrackets = true;
  defaultStyle: Partial<Shape> = { stroke: '#06b6d4', fill: 'transparent', strokeWidth: 1, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'fill', 'layer', 'action'];

  render(rc: any, _ctx: CanvasRenderingContext2D, shape: Shape) {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const options: any = {
      stroke: shape.stroke || '#f8fafc',
      fill: shape.fill && shape.fill !== 'transparent' ? shape.fill : undefined,
      strokeWidth: shape.strokeWidth || 2,
      roughness: shape.roughness ?? 1,
      fillStyle: shape.fillStyle || 'hachure',
      seed: shape.seed ?? 1,
    };

    if (shape.strokeStyle === 'dashed') options.strokeLineDash = [8, 8];
    else if (shape.strokeStyle === 'dotted') options.strokeLineDash = [2, 6];

    rc.ellipse(shape.x + w / 2, shape.y + h / 2, Math.abs(w), Math.abs(h), options);
  }

  /** 4-point handle hit test at N/E/S/W on the actual ellipse outline. */
  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 12;
    const bounds = this.getBounds(shape);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rx = bounds.width / 2 + 6;
    const ry = bounds.height / 2 + 6;

    if (Math.abs(point.x - cx)       <= d && Math.abs(point.y - (cy - ry)) <= d) return 'n';
    if (Math.abs(point.x - (cx + rx)) <= d && Math.abs(point.y - cy)       <= d) return 'e';
    if (Math.abs(point.x - cx)       <= d && Math.abs(point.y - (cy + ry)) <= d) return 's';
    if (Math.abs(point.x - (cx - rx)) <= d && Math.abs(point.y - cy)       <= d) return 'w';
    return null;
  }

  isPointInside(point: Point, shape: Shape): boolean {
    const bounds = this.getBounds(shape);
    const margin = 6;
    return (
      point.x >= bounds.x - margin &&
      point.x <= bounds.x + bounds.width + margin &&
      point.y >= bounds.y - margin &&
      point.y <= bounds.y + bounds.height + margin
    );
  }

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const b = this.getBounds(shape);
    ctx.beginPath();
    ctx.ellipse(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const bounds = this.getBounds(shape);
    if (shape.locked) {
      drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
    }

    // Small arc indicators at N/E/S/W handle positions on the ellipse
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rx = bounds.width / 2;
    const ry = bounds.height / 2;
    const span = 0.13;
    const color = shape.stroke || '#ffffff';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    [-Math.PI / 2, 0, Math.PI / 2, Math.PI].forEach(angle => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, angle - span, angle + span);
      ctx.stroke();
    });

    ctx.restore();
  }
}
