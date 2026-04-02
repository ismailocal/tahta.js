import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point, ICanvasAPI } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { pointToSegmentDistance } from '../geometry/Geometry';
import { buildRoughOptions } from '../geometry/lineUtils';

export class FreehandPlugin implements IShapePlugin {
  type = 'freehand';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', strokeWidth: 1, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'opacity', 'layer', 'action'];

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const pts = shape.points || [];
    if (pts.length < 2) return;

    const options = buildRoughOptions(shape, theme);
    rc.curve(pts.map(p => [shape.x + p.x, shape.y + p.y]), options);
  }

  getDrawable(generator: any, shape: Shape, _allShapes: Shape[], theme: 'light' | 'dark'): any[] {
    const pts = shape.points || [];
    if (pts.length < 2) return [];
    const options = buildRoughOptions(shape, theme);
    return [generator.curve(pts.map(p => [shape.x + p.x, shape.y + p.y]), options)];
  }

  renderFast(ctx: CanvasRenderingContext2D, shape: Shape, theme: 'light' | 'dark'): void {
    const pts = shape.points || [];
    if (pts.length < 2) return;
    const options = buildRoughOptions(shape, theme);
    ctx.save();
    ctx.strokeStyle = options.stroke as string;
    ctx.lineWidth = (options.strokeWidth as number) || 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(shape.x + pts[0].x, shape.y + pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(shape.x + pts[i].x, shape.y + pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  getResizeHandlePositions(_shape: Shape): Array<any> {
    return [];
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape, _allShapes: Shape[], _theme: 'light' | 'dark') {
    if (shape.locked && shape.points && shape.points.length > 0) {
      drawLockIcon(ctx, shape.x + shape.points[0].x, shape.y + shape.points[0].y);
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

  getHandleAtPoint(_shape: Shape, _point: Point): string | null {
    return null;
  }

  isPointInside(point: Point, shape: Shape): boolean {
    const pts = shape.points || [];
    if (pts.length < 2) return false;

    // Hit radius in pixels — slightly larger for easier selection of thin lines
    const hitRadius = 10;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = { x: shape.x + pts[i].x, y: shape.y + pts[i].y };
      const p2 = { x: shape.x + pts[i + 1].x, y: shape.y + pts[i + 1].y };
      
      const d = pointToSegmentDistance(point, p1, p2);
      if (d <= hitRadius) return true;
    }

    return false;
  }

  onDrawInit(payload: PointerPayload, _shapes: Shape[], _api: ICanvasAPI): Partial<Shape> {
    return { x: payload.world.x, y: payload.world.y, stroke: '#64748b', points: [{ x: 0, y: 0 }] };
  }

  onDrawUpdate(shape: Shape, payload: PointerPayload): Partial<Shape> {
    const pts = shape.points || [];
    const next = { x: payload.world.x - shape.x, y: payload.world.y - shape.y };

    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      const dx = next.x - last.x;
      const dy = next.y - last.y;
      // Increased threshold to 9 (3 pixels) to further reduce point density
      // and improve rendering speed without sacrificing visual quality.
      if (dx * dx + dy * dy < 9) return {};
    }

    return { points: [...pts, next] };
  }

  onDragHandle(_shape: Shape, _handle: string, _payload: PointerPayload, _dragStart: Point): Partial<Shape> {
    return {};
  }
}
