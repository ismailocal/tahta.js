import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point, ConnectionPoint, ICanvasAPI } from '../core/types';
import { UI_CONSTANTS } from '../core/constants';
import { genericHitTest } from './PolygonUtils';

/**
 * Shared base for all rectangle-bounded shape plugins.
 * Provides standard implementations for getBounds, getHandleAtPoint (8-point),
 * isPointInside, onDrawInit, onDrawUpdate, onDragHandle and renderSelection (lock icon).
 * Plugins with special geometry (ellipse, diamond) override only what differs.
 */
export abstract class BaseRectPlugin implements IShapePlugin {
  abstract type: string;
  abstract render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean, isErasing: boolean, allShapes: Shape[], theme: 'light' | 'dark'): void;

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

  /** Selection frame padding — used by getHandleAtPoint to align hit zones with the visual frame. */
  protected selectionPad = UI_CONSTANTS.SELECTION_PAD;

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const r = this.getCornerRadius(shape);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }

  /** 8-point handle hit test aligned to the selection frame (padded bounding box). */
  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = UI_CONSTANTS.HANDLE_HIT_DISTANCE;
    const b = this.getBounds(shape);
    const pad = this.selectionPad;
    const x = b.x - pad, y = b.y - pad, w = b.width + pad * 2, h = b.height + pad * 2;
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
    const bounds = this.getBounds(shape);
    return genericHitTest(
      point,
      bounds,
      (pt) => pt.x >= bounds.x && pt.x <= bounds.x + bounds.width && pt.y >= bounds.y && pt.y <= bounds.y + bounds.height,
      shape.strokeWidth || 1,
      shape.fill
    );
  }


  onDrawInit(payload: PointerPayload, _shapes: Shape[], _api: ICanvasAPI): Partial<Shape> {
    return { x: payload.world.x, y: payload.world.y, width: 0, height: 0, strokeWidth: 1.8 };
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
