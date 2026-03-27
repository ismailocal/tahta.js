import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point } from '../core/types';
import { drawLockIcon } from '../core/Utils';

function drawHandle(ctx: CanvasRenderingContext2D, hx: number, hy: number) {
  const hw = 4;
  ctx.fillRect(hx - hw, hy - hw, hw * 2, hw * 2);
  ctx.strokeRect(hx - hw, hy - hw, hw * 2, hw * 2);
}

export class DiamondPlugin implements IShapePlugin {
  type = 'diamond';
  defaultStyle: Partial<Shape> = { stroke: '#f8fafc', fill: 'transparent', strokeWidth: 1, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'fill', 'layer', 'action'];

  render(rc: any, _ctx: CanvasRenderingContext2D, shape: Shape) {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;

    const options: any = {
      stroke: shape.stroke || '#f8fafc',
      fill: shape.fill && shape.fill !== 'transparent' ? shape.fill : undefined,
      strokeWidth: shape.strokeWidth || 1,
      roughness: shape.roughness ?? 0,
      fillStyle: shape.fillStyle || 'hachure',
      seed: shape.seed ?? 1,
    };

    if (shape.strokeStyle === 'dashed') options.strokeLineDash = [8, 8];
    else if (shape.strokeStyle === 'dotted') options.strokeLineDash = [2, 6];

    rc.linearPath([
      [cx, shape.y],
      [shape.x + w, cy],
      [cx, shape.y + h],
      [shape.x, cy],
      [cx, shape.y],
    ], options);
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const bounds = this.getBounds(shape);

    if (shape.locked) {
      drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
      return;
    }

    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const pad = 6;

    ctx.strokeStyle = shape.stroke || '#f8fafc';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, shape.y - pad);
    ctx.lineTo(shape.x + w + pad, cy);
    ctx.lineTo(cx, shape.y + h + pad);
    ctx.lineTo(shape.x - pad, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#1e1e24';
    ctx.strokeStyle = shape.stroke || '#f8fafc';
    drawHandle(ctx, cx, shape.y - pad);           // n
    drawHandle(ctx, shape.x + w + pad, cy);        // e
    drawHandle(ctx, cx, shape.y + h + pad);        // s
    drawHandle(ctx, shape.x - pad, cy);            // w
  }

  getBounds(shape: Shape) {
    return { x: shape.x, y: shape.y, width: shape.width || 0, height: shape.height || 0 };
  }

  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 8;
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const pad = 6;

    if (Math.abs(point.x - cx) <= d && Math.abs(point.y - (shape.y - pad)) <= d) return 'n';
    if (Math.abs(point.x - (shape.x + w + pad)) <= d && Math.abs(point.y - cy) <= d) return 'e';
    if (Math.abs(point.x - cx) <= d && Math.abs(point.y - (shape.y + h + pad)) <= d) return 's';
    if (Math.abs(point.x - (shape.x - pad)) <= d && Math.abs(point.y - cy) <= d) return 'w';
    return null;
  }

  isPointInside(point: Point, shape: Shape): boolean {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    // Point-in-diamond: |dx/w| + |dy/h| <= 0.5
    const dx = Math.abs(point.x - cx) / (w / 2 + 8);
    const dy = Math.abs(point.y - cy) / (h / 2 + 8);
    return dx + dy <= 1;
  }

  onDrawInit(payload: PointerPayload): Partial<Shape> {
    return { x: payload.world.x, y: payload.world.y, width: 0, height: 0 };
  }

  onDrawUpdate(shape: Shape, payload: PointerPayload, dragStart: Pick<Point, 'x' | 'y'>): Partial<Shape> {
    let x = dragStart.x;
    let y = dragStart.y;
    let width = payload.world.x - dragStart.x;
    let height = payload.world.y - dragStart.y;

    if (payload.shiftKey) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width < 0 ? -size : size;
      height = height < 0 ? -size : size;
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

    if (handle === 'n') { y += dy; h -= dy; }
    if (handle === 's') { h += dy; }
    if (handle === 'w') { x += dx; w -= dx; }
    if (handle === 'e') { w += dx; }

    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }

    return { x, y, width: w, height: h };
  }
}
