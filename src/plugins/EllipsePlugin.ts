import type { Shape, Point, ConnectionPoint } from '../core/types';
import { drawLockIcon } from '../core/Utils';
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
    const options = buildRoughOptions(shape, theme);
    return [generator.ellipse(shape.x + w / 2, shape.y + h / 2, Math.abs(w), Math.abs(h), options)];
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
    const hasFill = shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none';
    const t = Math.max(8, (shape.strokeWidth || 1) + 7);
    // Check using normalized ellipse distance
    const rx = b.width / 2, ry = b.height / 2;
    const dx = point.x - cx, dy = point.y - cy;
    const distOuter = (dx * dx) / ((rx + t) * (rx + t)) + (dy * dy) / ((ry + t) * (ry + t));
    if (distOuter > 1) return false;
    if (hasFill) return true;
    const rxInner = Math.max(0, rx - t), ryInner = Math.max(0, ry - t);
    if (rxInner === 0 || ryInner === 0) return true;
    const distInner = (dx * dx) / (rxInner * rxInner) + (dy * dy) / (ryInner * ryInner);
    return distInner >= 1;
  }

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const b = this.getBounds(shape);
    ctx.beginPath();
    ctx.ellipse(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  getResizeHandlePositions(shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const ecx = x + w / 2, ecy = y + h / 2;
    const rx = w / 2, ry = h / 2;
    const arcLen = 14; // fixed pixel arc length at each handle

    const arcDraw = (angle: number) => {
      // Local radius of ellipse at this angle for arc-length → span conversion
      const localR = Math.abs(Math.sin(angle)) > 0.5 ? rx : ry;
      const span = localR > 0 ? arcLen / (2 * localR) : 0.15;
      return (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, rx, ry, 0, angle - span, angle + span);
        ctx.stroke();
      };
    };

    return [
      { x: ecx,    y,       angle: -Math.PI / 2, draw: arcDraw(-Math.PI / 2) }, // N
      { x: x + w,  y: ecy,  angle: 0,            draw: arcDraw(0)            }, // E
      { x: ecx,    y: y+h,  angle: Math.PI / 2,  draw: arcDraw(Math.PI / 2) }, // S
      { x,         y: ecy,  angle: Math.PI,       draw: arcDraw(Math.PI)     }, // W
    ];
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const bounds = this.getBounds(shape);
    if (shape.locked) drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
  }
}
