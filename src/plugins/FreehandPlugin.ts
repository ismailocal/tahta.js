import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point, ICanvasAPI } from '../core/types';
import { pointToSegmentDistance } from '../geometry/Geometry';
import { getThemeAdjustedStroke } from '../core/Utils';
import { getStroke } from 'perfect-freehand';

export class FreehandPlugin implements IShapePlugin {
  type = 'freehand';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', strokeWidth: 1.8, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'opacity', 'layer', 'action'];

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const pts = shape.points || [];
    if (pts.length < 2) return;

    const strokeColor = getThemeAdjustedStroke(shape.stroke, theme);
    const strokeWidth = shape.strokeWidth || 1.8;

    // Convert points to perfect-freehand format [x, y, pressure]
    const inputPoints = pts.map(p => [shape.x + p.x, shape.y + p.y, 0.5]);
    const outlinePoints = getStroke(inputPoints, {
      size: strokeWidth * 4,
      smoothing: 0.5,
      thinning: 0.5,
      streamline: 0.5,
      easing: (t: number) => t,
      start: {
        taper: 0,
        cap: true,
      },
      end: {
        taper: 0,
        cap: true,
      },
    });

    if (outlinePoints.length === 0) return;

    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
    for (let i = 1; i < outlinePoints.length; i++) {
      const [x, y] = outlinePoints[i];
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  renderFast(ctx: CanvasRenderingContext2D, shape: Shape, theme: 'light' | 'dark'): void {
    const pts = shape.points || [];
    if (pts.length < 2) return;

    const strokeColor = getThemeAdjustedStroke(shape.stroke, theme);
    const strokeWidth = shape.strokeWidth || 1.8;

    const inputPoints = pts.map(p => [shape.x + p.x, shape.y + p.y, 0.5]);
    const outlinePoints = getStroke(inputPoints, {
      size: strokeWidth * 4,
      smoothing: 0.5,
      thinning: 0.5,
      streamline: 0.5,
      easing: (t: number) => t,
      start: {
        taper: 0,
        cap: true,
      },
      end: {
        taper: 0,
        cap: true,
      },
    });

    if (outlinePoints.length === 0) return;

    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
    for (let i = 1; i < outlinePoints.length; i++) {
      const [x, y] = outlinePoints[i];
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  getResizeHandlePositions(_shape: Shape): Array<any> {
    return [];
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
      // Reduced threshold to 1 (1 pixel) for smoother curves
      // Higher point density reduces jagged edges when zoomed
      if (dx * dx + dy * dy < 1) return {};
    }

    return { points: [...pts, next] };
  }

  onDragHandle(_shape: Shape, _handle: string, _payload: PointerPayload, _dragStart: Point): Partial<Shape> {
    return {};
  }
}
