import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { pointToSegmentDistance } from '../core/Geometry';

export class FreehandPlugin implements IShapePlugin {
  type = 'freehand';
  defaultStyle: Partial<Shape> = { stroke: '#f59e0b', strokeWidth: 1, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'opacity', 'layer', 'action'];

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean, isErasing: boolean) {
    const pts = shape.points || [];
    if (pts.length < 2) return;

    const options: any = {
      stroke: shape.stroke || '#f8fafc',
      strokeWidth: shape.strokeWidth || 1,
      roughness: shape.roughness ?? 0,
      seed: shape.seed ?? 1,
    };
    if (shape.strokeStyle === 'dashed') options.strokeLineDash = [8, 8];
    else if (shape.strokeStyle === 'dotted') options.strokeLineDash = [2, 6];

    rc.curve(pts.map(p => [shape.x + p.x, shape.y + p.y]), options);
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const pts = shape.points || [];
    if (pts.length < 2) return;
    const bounds = this.getBounds(shape);
    if (shape.locked) {
      drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
    }
  }

  getBounds(shape: Shape) {
    const pts = shape.points || [];
    if (pts.length === 0) return { x: shape.x, y: shape.y, width: 0, height: 0 };

    const xs = pts.map(p => shape.x + p.x);
    const ys = pts.map(p => shape.y + p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }

  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 12;
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
    // Expand hit area slightly to match the visual frame (which is bounds - 6)
    const margin = 6;
    return (
      point.x >= bounds.x - margin &&
      point.x <= bounds.x + bounds.width + margin &&
      point.y >= bounds.y - margin &&
      point.y <= bounds.y + bounds.height + margin
    );
  }

  onDrawInit(payload: PointerPayload): Partial<Shape> {
    return { x: payload.world.x, y: payload.world.y, points: [{ x: 0, y: 0 }] };
  }

  onDrawUpdate(shape: Shape, payload: PointerPayload): Partial<Shape> {
    const pts = shape.points || [];
    return { points: [...pts, { x: payload.world.x - shape.x, y: payload.world.y - shape.y }] };
  }

  onDragHandle(shape: Shape, handle: string, payload: PointerPayload, dragStart: Point): Partial<Shape> {
    const dx = payload.world.x - dragStart.x;
    const dy = payload.world.y - dragStart.y;

    const bounds = this.getBounds(shape);
    let { x, y, width: w, height: h } = bounds;

    if (handle.includes('n')) { y += dy; h -= dy; }
    if (handle.includes('s')) { h += dy; }
    if (handle.includes('w')) { x += dx; w -= dx; }
    if (handle.includes('e')) { w += dx; }

    let flipX = false;
    let flipY = false;

    if (w < 0) { x += w; w = Math.abs(w); flipX = true; }
    if (h < 0) { y += h; h = Math.abs(h); flipY = true; }

    const oldBounds = this.getBounds(shape);
    if (oldBounds.width === 0 || oldBounds.height === 0) return {};

    const newPoints = (shape.points || []).map(p => {
      const absX = shape.x + p.x;
      const absY = shape.y + p.y;

      let normX = (absX - oldBounds.x) / oldBounds.width;
      let normY = (absY - oldBounds.y) / oldBounds.height;

      if (flipX) normX = 1 - normX;
      if (flipY) normY = 1 - normY;

      const newAbsX = x + normX * w;
      const newAbsY = y + normY * h;

      return { x: newAbsX - x, y: newAbsY - y };
    });

    return { x, y, points: newPoints };
  }
}
