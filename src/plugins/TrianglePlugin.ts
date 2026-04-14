import type { Shape, Point, ConnectionPoint } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';
import { buildRoughOptions } from '../geometry/lineUtils';
import { polygonHitTest, toSvgPath } from './PolygonUtils';

export class TrianglePlugin extends BaseRectPlugin {
  type = 'triangle';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', fill: 'transparent', strokeWidth: 1.8, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'fill', 'fillStyle', 'roughness', 'opacity', 'textLayout', 'layer', 'action'];

  private vertices(shape: Shape): Point[] {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    return [
      { x: x + w / 2, y },        // apex (top center)
      { x: x + w,     y: y + h }, // bottom right
      { x,            y: y + h }, // bottom left
    ];
  }

  render(rc: any, _ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    rc.path(toSvgPath(this.vertices(shape)), buildRoughOptions(shape, theme));
  }

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const [a, b, c] = this.vertices(shape);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
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
