import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point, ConnectionPoint } from '../core/types';
import { drawLockIcon } from '../core/Utils';

/**
 * Shared base for all rectangle-bounded shape plugins.
 * Provides standard implementations for getBounds, getHandleAtPoint (8-point),
 * isPointInside, onDrawInit, onDrawUpdate, onDragHandle and renderSelection (lock icon).
 * Plugins with special geometry (ellipse, diamond) override only what differs.
 */
export abstract class BaseRectPlugin implements IShapePlugin {
  abstract type: string;
  abstract render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean, isErasing: boolean, allShapes: Shape[]): void;

  defaultStyle?: Partial<Shape>;
  defaultProperties?: string[];

  /** Override to enforce minimum size during handle drag. */
  protected minWidth = 0;
  protected minHeight = 0;

  getBounds(shape: Shape) {
    return {
      x: shape.x,
      y: shape.y,
      width: shape.width || 0,
      height: shape.height || 0,
    };
  }

  /**
   * Corner radius used by both hover border and bracket indicators.
   * Override this in subclasses — no need to override getBracketRadius or drawHoverOutline separately.
   */
  getCornerRadius(_shape: Shape): number { return 0; }

  getBracketRadius(shape: Shape): number { return this.getCornerRadius(shape); }

  /** Default: 8 handle positions at bounding box corners + midpoints with appropriate draw closures. */
  getResizeHandlePositions(shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const cx = x + w / 2, cy = y + h / 2;
    const r = this.getCornerRadius(shape);
    const arm = 11;

    // Arc bracket draw closure for a rounded corner
    const arcDraw = (acx: number, acy: number, mid: number) =>
      (ctx: CanvasRenderingContext2D) => {
        const span = r > 0 ? Math.min(arm / r, Math.PI / 3) : 0;
        ctx.beginPath();
        ctx.arc(acx, acy, r, mid - span, mid + span);
        ctx.stroke();
      };

    // L-bracket draw closure for a sharp corner
    const lDraw = (px: number, py: number, dx: number, dy: number) =>
      (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.moveTo(px + dx * arm, py);
        ctx.lineTo(px, py);
        ctx.lineTo(px, py + dy * arm);
        ctx.stroke();
      };

    // Tick draw closure for an edge midpoint
    const tickDraw = (px: number, py: number, horiz: boolean) =>
      (ctx: CanvasRenderingContext2D) => {
        const tick = 7;
        ctx.beginPath();
        if (horiz) { ctx.moveTo(px - tick, py); ctx.lineTo(px + tick, py); }
        else       { ctx.moveTo(px, py - tick); ctx.lineTo(px, py + tick); }
        ctx.stroke();
      };

    const cornerNW = r > 0
      ? arcDraw(x + r, y + r, 5 * Math.PI / 4)
      : lDraw(x, y, 1, 1);
    const cornerNE = r > 0
      ? arcDraw(x + w - r, y + r, 7 * Math.PI / 4)
      : lDraw(x + w, y, -1, 1);
    const cornerSW = r > 0
      ? arcDraw(x + r, y + h - r, 3 * Math.PI / 4)
      : lDraw(x, y + h, 1, -1);
    const cornerSE = r > 0
      ? arcDraw(x + w - r, y + h - r, 1 * Math.PI / 4)
      : lDraw(x + w, y + h, -1, -1);

    return [
      { x,      y,      angle: -3 * Math.PI / 4, draw: cornerNW },
      { x: cx,  y,      angle: -Math.PI / 2,      draw: tickDraw(cx, y, true) },
      { x: x+w, y,      angle: -Math.PI / 4,      draw: cornerNE },
      { x: x+w, y: cy,  angle: 0,                 draw: tickDraw(x + w, cy, false) },
      { x: x+w, y: y+h, angle:  Math.PI / 4,      draw: cornerSE },
      { x: cx,  y: y+h, angle:  Math.PI / 2,      draw: tickDraw(cx, y + h, true) },
      { x,      y: y+h, angle:  3 * Math.PI / 4,  draw: cornerSW },
      { x,      y: cy,  angle:  Math.PI,           draw: tickDraw(x, cy, false) },
    ];
  }

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const r = this.getCornerRadius(shape);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }

  /** 8-point handle hit test on inflated bounding box. */
  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 12;
    const b = this.getBounds(shape);
    const x = b.x - 6, y = b.y - 6, w = b.width + 12, h = b.height + 12;
    if (Math.abs(point.x - x)           <= d && Math.abs(point.y - y)           <= d) return 'nw';
    if (Math.abs(point.x - (x + w / 2)) <= d && Math.abs(point.y - y)           <= d) return 'n';
    if (Math.abs(point.x - (x + w))     <= d && Math.abs(point.y - y)           <= d) return 'ne';
    if (Math.abs(point.x - x)           <= d && Math.abs(point.y - (y + h / 2)) <= d) return 'w';
    if (Math.abs(point.x - (x + w))     <= d && Math.abs(point.y - (y + h / 2)) <= d) return 'e';
    if (Math.abs(point.x - x)           <= d && Math.abs(point.y - (y + h))     <= d) return 'sw';
    if (Math.abs(point.x - (x + w / 2)) <= d && Math.abs(point.y - (y + h))     <= d) return 's';
    if (Math.abs(point.x - (x + w))     <= d && Math.abs(point.y - (y + h))     <= d) return 'se';
    return null;
  }

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const cx = x + w / 2, cy = y + h / 2;
    return [
      { id: 'top',    x: cx,     y,         side: 'top'    },
      { id: 'right',  x: x + w,  y: cy,     side: 'right'  },
      { id: 'bottom', x: cx,     y: y + h,  side: 'bottom' },
      { id: 'left',   x,         y: cy,     side: 'left'   },
    ];
  }

  isPointInside(point: Point, shape: Shape): boolean {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const m = 6;
    return point.x >= x - m && point.x <= x + w + m && point.y >= y - m && point.y <= y + h + m;
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const bounds = this.getBounds(shape);
    if (shape.locked) {
      drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
    }
  }

  onDrawInit(payload: PointerPayload): Partial<Shape> {
    return { x: payload.world.x, y: payload.world.y, width: 0, height: 0 };
  }

  onDrawUpdate(_shape: Shape, payload: PointerPayload, dragStart: Pick<Point, 'x' | 'y'>): Partial<Shape> {
    let x = dragStart.x, y = dragStart.y;
    let width = payload.world.x - dragStart.x;
    let height = payload.world.y - dragStart.y;

    if (payload.shiftKey) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width < 0 ? -size : size;
      height = height < 0 ? -size : size;
    }

    if (payload.altKey) {
      x = dragStart.x - width; y = dragStart.y - height;
      width *= 2; height *= 2;
    }

    if (width < 0)  { x += width;  width  = Math.abs(width);  }
    if (height < 0) { y += height; height = Math.abs(height); }

    return { x, y, width, height };
  }

  onDragHandle(shape: Shape, handle: string, payload: PointerPayload, dragStart: Point): Partial<Shape> {
    const dx = payload.world.x - dragStart.x;
    const dy = payload.world.y - dragStart.y;
    let { x, y } = shape;
    let w = shape.width || 0;
    let h = shape.height || 0;

    if (handle.includes('n')) { y += dy; h -= dy; }
    if (handle.includes('s')) { h += dy; }
    if (handle.includes('w')) { x += dx; w -= dx; }
    if (handle.includes('e')) { w += dx; }

    if (w < this.minWidth)  { if (handle.includes('w')) x -= this.minWidth  - w; w = this.minWidth;  }
    if (h < this.minHeight) { if (handle.includes('n')) y -= this.minHeight - h; h = this.minHeight; }
    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }

    return { x, y, width: w, height: h };
  }
}
