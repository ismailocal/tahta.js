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
  defaultStyle: Partial<Shape> = { stroke: '#06b6d4', fill: 'transparent', strokeWidth: 1, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'fill', 'layer', 'action'];

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

    if (isLocked) {
      drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
      return;
    }

    ctx.strokeStyle = shape.stroke || '#8b5cf6';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.ellipse(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      bounds.width / 2 + 4,
      bounds.height / 2 + 4,
      0, 0, Math.PI * 2
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#1e1e24';
    ctx.strokeStyle = shape.stroke || '#8b5cf6';

    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rx = bounds.width / 2 + 6;
    const ry = bounds.height / 2 + 6;
    const d45 = Math.SQRT1_2; // cos/sin of 45°
    drawHandle(ctx, cx, cy - ry);                         // n
    drawHandle(ctx, cx + rx, cy);                         // e
    drawHandle(ctx, cx, cy + ry);                         // s
    drawHandle(ctx, cx - rx, cy);                         // w
    drawHandle(ctx, cx + rx * d45, cy - ry * d45);        // ne
    drawHandle(ctx, cx + rx * d45, cy + ry * d45);        // se
    drawHandle(ctx, cx - rx * d45, cy + ry * d45);        // sw
    drawHandle(ctx, cx - rx * d45, cy - ry * d45);        // nw
  }

  getBounds(shape: Shape) {
    return { x: shape.x, y: shape.y, width: shape.width || 0, height: shape.height || 0 };
  }

  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 6;
    const bounds = this.getBounds(shape);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rx = bounds.width / 2 + 6;
    const ry = bounds.height / 2 + 6;
    const d45 = Math.SQRT1_2;

    if (Math.abs(point.x - cx) <= d && Math.abs(point.y - (cy - ry)) <= d) return 'n';
    if (Math.abs(point.x - (cx + rx)) <= d && Math.abs(point.y - cy) <= d) return 'e';
    if (Math.abs(point.x - cx) <= d && Math.abs(point.y - (cy + ry)) <= d) return 's';
    if (Math.abs(point.x - (cx - rx)) <= d && Math.abs(point.y - cy) <= d) return 'w';
    if (Math.abs(point.x - (cx + rx * d45)) <= d && Math.abs(point.y - (cy - ry * d45)) <= d) return 'ne';
    if (Math.abs(point.x - (cx + rx * d45)) <= d && Math.abs(point.y - (cy + ry * d45)) <= d) return 'se';
    if (Math.abs(point.x - (cx - rx * d45)) <= d && Math.abs(point.y - (cy + ry * d45)) <= d) return 'sw';
    if (Math.abs(point.x - (cx - rx * d45)) <= d && Math.abs(point.y - (cy - ry * d45)) <= d) return 'nw';
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
