import type { Shape, PointerPayload, Point, ConnectionPoint, ICanvasAPI } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { BaseRectPlugin } from './BaseRectPlugin';

export const imageCache = new Map<string, HTMLImageElement>();

/** Release all cached HTMLImageElement objects (call on canvas destroy). */
export function clearImageCache() {
  imageCache.clear();
}

export class ImagePlugin extends BaseRectPlugin {
  type = 'image';
  defaultStyle: Partial<Shape> = {};
  defaultProperties = ['opacity', 'layer', 'action'];

  getResizeHandlePositions(shape: Shape) {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const arm = 11;
    const lDraw = (px: number, py: number, dx: number, dy: number) =>
      (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.moveTo(px + dx * arm, py);
        ctx.lineTo(px, py);
        ctx.lineTo(px, py + dy * arm);
        ctx.stroke();
      };
    return [
      { x,      y,      angle: -3 * Math.PI / 4, draw: lDraw(x,      y,     1,  1) },
      { x: x+w, y,      angle: -Math.PI / 4,      draw: lDraw(x + w,  y,    -1,  1) },
      { x: x+w, y: y+h, angle:  Math.PI / 4,      draw: lDraw(x + w,  y+h,  -1, -1) },
      { x,      y: y+h, angle:  3 * Math.PI / 4,  draw: lDraw(x,      y+h,   1, -1) },
    ];
  }

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], _theme: 'light' | 'dark') {
    const { x, y, width = 100, height = 100, imageSrc } = shape;
    if (imageSrc) {
      let img = imageCache.get(imageSrc);
      if (!img) {
        img = new Image();
        img.onload = () => { window.dispatchEvent(new CustomEvent('tuval-force-render')); };
        img.src = imageSrc;
        imageCache.set(imageSrc, img);
      }
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x, y, width, height);
      }
    }
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape, _allShapes: Shape[], _theme: 'light' | 'dark') {
    const { x, y, width = 100, height = 100 } = shape;
    if (shape.locked) drawLockIcon(ctx, x + width + 6, y - 6);
  }

  getBounds(shape: Shape) {
    return { x: shape.x, y: shape.y, width: shape.width || 100, height: shape.height || 100 };
  }

  /** Images always fill their bounds — hit anywhere inside. */
  isPointInside(point: Point, shape: Shape): boolean {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const m = 6;
    return point.x >= x - m && point.x <= x + w + m && point.y >= y - m && point.y <= y + h + m;
  }

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const { x, y, width: w, height: h } = this.getBounds(shape);
    const cx = x + w / 2, cy = y + h / 2;
    return [
      { id: 'top',    x: cx,     y,        side: 'top'    },
      { id: 'right',  x: x + w,  y: cy,    side: 'right'  },
      { id: 'bottom', x: cx,     y: y + h, side: 'bottom' },
      { id: 'left',   x,         y: cy,    side: 'left'   },
    ];
  }

  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 20;
    const { x, y, width: w, height: h } = this.getBounds(shape);
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

  onDrawInit(payload: PointerPayload, _shapes: Shape[], _api: ICanvasAPI): Partial<Shape> {
    return { x: payload.world.x, y: payload.world.y, width: 0, height: 0, imageSrc: '' };
  }

  onDrawUpdate(_shape: Shape, payload: PointerPayload, dragStart: Pick<Point, 'x' | 'y'>): Partial<Shape> {
    return { width: payload.world.x - dragStart.x, height: payload.world.y - dragStart.y };
  }

  /** Ratio-preserving resize. */
  onDragHandle(shape: Shape, handle: string, payload: PointerPayload, dragStart: Point): Partial<Shape> {
    const dx = payload.world.x - dragStart.x;
    const dy = payload.world.y - dragStart.y;
    const origW = shape.width || 100;
    const origH = shape.height || 100;
    const ratio = origW / origH;
    let { x, y } = shape;
    let w = origW, h = origH;

    if (handle.includes('n')) { y += dy; h -= dy; }
    if (handle.includes('s')) { h += dy; }
    if (handle.includes('w')) { x += dx; w -= dx; }
    if (handle.includes('e')) { w += dx; }

    if (handle === 'e' || handle === 'w') {
      const newH = w / ratio; y = shape.y + (origH - newH) / 2; h = newH;
    } else if (handle === 'n' || handle === 's') {
      const newW = h * ratio; x = shape.x + (origW - newW) / 2; w = newW;
    } else {
      if (Math.abs(w * origH) > Math.abs(h * origW)) {
        const newH = w / ratio; if (handle.includes('n')) y += (h - newH); h = newH;
      } else {
        const newW = h * ratio; if (handle.includes('w')) x += (w - newW); w = newW;
      }
    }

    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }
    return { x, y, width: w, height: h };
  }
}
