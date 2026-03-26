import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point } from '../core/types';
import { drawLockIcon } from '../core/Utils';

function drawHandle(ctx: CanvasRenderingContext2D, hx: number, hy: number) {
  const hw = 4;
  ctx.fillRect(hx - hw, hy - hw, hw * 2, hw * 2);
  ctx.strokeRect(hx - hw, hy - hw, hw * 2, hw * 2);
}

export class EllipsePlugin implements IShapePlugin {
  type = 'ellipse';

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean, isErasing: boolean) {
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

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const bounds = this.getBounds(shape);
    const isLocked = shape.locked;

    if (!isLocked) {
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = shape.stroke || '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.strokeRect(bounds.x - 6, bounds.y - 6, bounds.width + 12, bounds.height + 12);
    }

    if (isLocked) {
      drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
      return;
    }

    ctx.setLineDash([]);
    ctx.fillStyle = '#1e1e24';
    ctx.strokeStyle = shape.stroke || '#8b5cf6';

    const b = { x: bounds.x - 6, y: bounds.y - 6, w: bounds.width + 12, h: bounds.height + 12 };
    drawHandle(ctx, b.x, b.y);
    drawHandle(ctx, b.x + b.w / 2, b.y);
    drawHandle(ctx, b.x + b.w, b.y);
    drawHandle(ctx, b.x, b.y + b.h / 2);
    drawHandle(ctx, b.x + b.w, b.y + b.h / 2);
    drawHandle(ctx, b.x, b.y + b.h);
    drawHandle(ctx, b.x + b.w / 2, b.y + b.h);
    drawHandle(ctx, b.x + b.w, b.y + b.h);
  }

  getBounds(shape: Shape) {
    return { x: shape.x, y: shape.y, width: shape.width || 0, height: shape.height || 0 };
  }

  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 6;
    const bounds = this.getBounds(shape);
    const b = { x: bounds.x - 6, y: bounds.y - 6, w: bounds.width + 12, h: bounds.height + 12 };

    if (Math.abs(point.x - b.x) <= d && Math.abs(point.y - b.y) <= d) return 'nw';
    if (Math.abs(point.x - (b.x + b.w / 2)) <= d && Math.abs(point.y - b.y) <= d) return 'n';
    if (Math.abs(point.x - (b.x + b.w)) <= d && Math.abs(point.y - b.y) <= d) return 'ne';
    if (Math.abs(point.x - b.x) <= d && Math.abs(point.y - (b.y + b.h / 2)) <= d) return 'w';
    if (Math.abs(point.x - (b.x + b.w)) <= d && Math.abs(point.y - (b.y + b.h / 2)) <= d) return 'e';
    if (Math.abs(point.x - b.x) <= d && Math.abs(point.y - (b.y + b.h)) <= d) return 'sw';
    if (Math.abs(point.x - (b.x + b.w / 2)) <= d && Math.abs(point.y - (b.y + b.h)) <= d) return 's';
    if (Math.abs(point.x - (b.x + b.w)) <= d && Math.abs(point.y - (b.y + b.h)) <= d) return 'se';
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

  onDrawInit(payload: PointerPayload): Partial<Shape> {
    return { x: payload.world.x, y: payload.world.y, width: 0, height: 0 };
  }

  onDrawUpdate(shape: Shape, payload: PointerPayload, dragStart: Pick<Point, "x" | "y">): Partial<Shape> {
    let x = dragStart.x;
    let y = dragStart.y;
    let width = payload.world.x - dragStart.x;
    let height = payload.world.y - dragStart.y;

    if (payload.shiftKey) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width < 0 ? -size : size;
      height = height < 0 ? -size : size;
    }

    if (payload.altKey) {
      x = dragStart.x - width;
      y = dragStart.y - height;
      width *= 2;
      height *= 2;
    }

    if (width < 0) { x += width; width = Math.abs(width); }
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

    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }

    return { x, y, width: w, height: h };
  }
}
