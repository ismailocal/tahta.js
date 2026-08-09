import type { Shape, Point, ConnectionPoint } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';
import { buildRoughOptions } from '../geometry/lineUtils';
import { polygonHitTest, toSvgPath, toRoundedSvgPath } from './PolygonUtils';

export class TrianglePlugin extends BaseRectPlugin {
  type = 'triangle';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', fill: 'transparent', strokeWidth: 1.8, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'fill', 'fillStyle', 'roughness', 'cornerRadius', 'opacity', 'textLayout', 'layer', 'action'];

  getCornerRadius(shape: Shape): number {
    const w = shape.width || 0, h = shape.height || 0;
    const customRadius = shape.cornerRadius ?? 16;
    return Math.min(customRadius, w / 2, h / 2);
  }

  private vertices(shape: Shape): Point[] {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    return [
      { x: x + w / 2, y },        // apex (top center)
      { x: x + w,     y: y + h }, // bottom right
      { x,            y: y + h }, // bottom left
    ];
  }

  render(rc: any, _ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const r = this.getCornerRadius(shape);
    if (r > 0) {
      rc.path(toRoundedSvgPath(this.vertices(shape), r), buildRoughOptions(shape, theme));
    } else {
      rc.path(toSvgPath(this.vertices(shape)), buildRoughOptions(shape, theme));
    }
  }

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const [a, b, c] = this.vertices(shape);
    const r = this.getCornerRadius(shape);
    ctx.beginPath();
    if (r > 0) {
      const pts = [a, b, c];
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const prev = pts[(i - 1 + n) % n];
        const curr = pts[i];
        const next = pts[(i + 1) % n];
        const d1 = Math.hypot(prev.x - curr.x, prev.y - curr.y);
        const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
        const t1 = d1 > 0 ? Math.min(r / d1, 0.45) : 0;
        const t2 = d2 > 0 ? Math.min(r / d2, 0.45) : 0;
        const p1x = curr.x + (prev.x - curr.x) * t1;
        const p1y = curr.y + (prev.y - curr.y) * t1;
        const p2x = curr.x + (next.x - curr.x) * t2;
        const p2y = curr.y + (next.y - curr.y) * t2;
        if (i === 0) ctx.moveTo(p1x, p1y); else ctx.lineTo(p1x, p1y);
        ctx.quadraticCurveTo(curr.x, curr.y, p2x, p2y);
      }
    } else {
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  isPointInside(point: Point, shape: Shape): boolean {
    return polygonHitTest(point, this.vertices(shape), shape.strokeWidth || 1, shape.fill);
  }

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const [top, br, bl] = this.vertices(shape);
    return [
      { id: 'top',    x: top.x,               y: top.y,               side: 'top'    },
      { id: 'right',  x: (top.x + br.x) / 2,  y: (top.y + br.y) / 2, side: 'right'  },
      { id: 'bottom', x: (bl.x + br.x) / 2,   y: bl.y,               side: 'bottom' },
      { id: 'left',   x: (top.x + bl.x) / 2,  y: (top.y + bl.y) / 2, side: 'left'   },
    ];
  }
}
