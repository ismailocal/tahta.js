import type { Shape, Point, ConnectionPoint, PointerPayload, ICanvasAPI } from '../core/types';
import { buildRoughOptions } from '../geometry/lineUtils';
import { BaseRectPlugin } from './BaseRectPlugin';
import { toRoundedSvgPath } from './PolygonUtils';

function buildDiamondPath(ctx: CanvasRenderingContext2D, pts: Point[], r: number) {
  const n = pts.length;
  ctx.beginPath();
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
  ctx.closePath();
}

export class DiamondPlugin extends BaseRectPlugin {
  type = 'diamond';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', fill: 'transparent', strokeWidth: 1.8, roughness: 0, opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'fill', 'fillStyle', 'roughness', 'cornerRadius', 'opacity', 'textLayout', 'layer', 'action'];

  getCornerRadius(shape: Shape): number {
    const w = shape.width || 0, h = shape.height || 0;
    const customRadius = shape.cornerRadius ?? 16;
    return Math.min(customRadius, w / 2, h / 2);
  }

  render(rc: any, _ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const r = this.getCornerRadius(shape);
    const tips: Point[] = [
      { x: cx,          y: shape.y     },
      { x: shape.x + w, y: cy          },
      { x: cx,          y: shape.y + h },
      { x: shape.x,     y: cy          },
    ];

    const options = buildRoughOptions(shape, theme);
    rc.path(toRoundedSvgPath(tips, r), options);
  }

  drawHoverOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const cx = x + w / 2, cy = y + h / 2;
    buildDiamondPath(ctx, [
      { x: cx,    y      },
      { x: x + w, y: cy  },
      { x: cx,    y: y+h },
      { x,        y: cy  },
    ], this.getCornerRadius(shape));
    ctx.stroke();
  }

  /** 8-point handle hit test using bounding box - allows corner resize like rectangle */
  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 14;
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;

    // 8-point handle positions at bounding box corners and midpoints
    if (Math.abs(point.x - shape.x)         <= d && Math.abs(point.y - shape.y)         <= d) return 'nw';
    if (Math.abs(point.x - cx)              <= d && Math.abs(point.y - shape.y)         <= d) return 'n';
    if (Math.abs(point.x - (shape.x + w))   <= d && Math.abs(point.y - shape.y)         <= d) return 'ne';
    if (Math.abs(point.x - shape.x)         <= d && Math.abs(point.y - cy)              <= d) return 'w';
    if (Math.abs(point.x - (shape.x + w))   <= d && Math.abs(point.y - cy)              <= d) return 'e';
    if (Math.abs(point.x - shape.x)         <= d && Math.abs(point.y - (shape.y + h))   <= d) return 'sw';
    if (Math.abs(point.x - cx)              <= d && Math.abs(point.y - (shape.y + h))   <= d) return 's';
    if (Math.abs(point.x - (shape.x + w))   <= d && Math.abs(point.y - (shape.y + h))   <= d) return 'se';
    return null;
  }

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const { x, y } = shape;
    const w = shape.width ?? 0, h = shape.height ?? 0;
    const cx = x + w / 2, cy = y + h / 2;
    const r = this.getCornerRadius(shape);
    // Half-diagonal of one edge (e.g. top-left edge from left-tip to top-tip)
    const d = Math.hypot(w / 2, h / 2);
    const t = d > 0 ? Math.min(r / d, 0.45) : 0;
    // Actual bezier peak = bbox tip + inset of (side/4)*t toward center
    return [
      { id: 'top',    x: cx,              y: y     + (h / 4) * t, side: 'top'    },
      { id: 'right',  x: x + w - (w / 4) * t, y: cy,             side: 'right'  },
      { id: 'bottom', x: cx,              y: y + h - (h / 4) * t, side: 'bottom' },
      { id: 'left',   x: x     + (w / 4) * t, y: cy,             side: 'left'   },
    ];
  }



  isPointInside(point: Point, shape: Shape): boolean {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;
    const t = Math.max(8, (shape.strokeWidth || 1) + 7);
    
    // Accept any click inside the (slightly inflated) diamond area
    const dxOuter = Math.abs(point.x - cx) / (w / 2 + t);
    const dyOuter = Math.abs(point.y - cy) / (h / 2 + t);
    if (dxOuter + dyOuter > 1) return false;

    const isTransparent = !shape.fill || shape.fill === 'transparent' || shape.fill === 'none';
    if (isTransparent) {
        const wi = Math.max(0.1, w / 2 - t);
        const hi = Math.max(0.1, h / 2 - t);
        const dxInner = Math.abs(point.x - cx) / wi;
        const dyInner = Math.abs(point.y - cy) / hi;
        return dxInner + dyInner >= 1;
    }

    return true;
  }

}
