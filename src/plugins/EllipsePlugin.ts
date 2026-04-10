import type { Shape, Point, ConnectionPoint } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';
import { buildRoughOptions } from '../geometry/lineUtils';

export class EllipsePlugin extends BaseRectPlugin {
  type = 'ellipse';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', fill: 'transparent', strokeWidth: 1, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'fill', 'fillStyle', 'roughness', 'opacity', 'layer', 'action'];

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const options = buildRoughOptions(shape, theme);

    rc.ellipse(shape.x + w / 2, shape.y + h / 2, Math.abs(w), Math.abs(h), options);
  }

  renderFast(ctx: CanvasRenderingContext2D, shape: Shape, theme: 'light' | 'dark'): void {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const options = buildRoughOptions(shape, theme);
    ctx.save();
    ctx.strokeStyle = options.stroke as string;
    ctx.lineWidth = (options.strokeWidth as number) || 1.8;
    ctx.beginPath();
    ctx.ellipse(shape.x + w / 2, shape.y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  getDrawable(generator: any, shape: Shape, _allShapes: Shape[], theme: 'light' | 'dark'): any[] {
    const w = shape.width || 0;
    const h = shape.height || 0;
    if (w <= 0 || h <= 0) return [];
    const options = buildRoughOptions(shape, theme);
    return [generator.ellipse(shape.x + w / 2, shape.y + h / 2, Math.abs(w), Math.abs(h), options)];
  }

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const b = this.getBounds(shape);
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    return [
      { id: 'top',    x: cx,          y: b.y,            side: 'top'    },
      { id: 'right',  x: b.x + b.width, y: cy,           side: 'right'  },
      { id: 'bottom', x: cx,          y: b.y + b.height, side: 'bottom' },
      { id: 'left',   x: b.x,        y: cy,             side: 'left'   },
    ];
  }

  isPointInside(point: Point, shape: Shape): boolean {
    const b = this.getBounds(shape);
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const t = Math.max(8, (shape.strokeWidth || 1) + 7);
    const rx = b.width / 2, ry = b.height / 2;
    const dx = point.x - cx, dy = point.y - cy;
    // Accept clicks anywhere inside the (slightly inflated) ellipse bounding area
    const distOuter = (dx * dx) / ((rx + t) * (rx + t)) + (dy * dy) / ((ry + t) * (ry + t));
    return distOuter <= 1;
  }

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const b = this.getBounds(shape);
    ctx.beginPath();
    ctx.ellipse(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

}
