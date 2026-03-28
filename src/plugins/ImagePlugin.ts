import type { Shape, PointerPayload, Point } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { BaseRectPlugin } from './BaseRectPlugin';

export const imageCache = new Map<string, HTMLImageElement>();

export class ImagePlugin extends BaseRectPlugin {
  type = 'image';
  cornersOnly = true;
  defaultStyle: Partial<Shape> = {};
  defaultProperties = ['layer', 'action'];

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape) {
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

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const { x, y, width = 100, height = 100 } = shape;
    if (shape.locked) drawLockIcon(ctx, x + width + 6, y - 6);
  }

  getBounds(shape: Shape) {
    return { x: shape.x, y: shape.y, width: shape.width || 100, height: shape.height || 100 };
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

  onDrawInit(payload: PointerPayload): Partial<Shape> {
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
