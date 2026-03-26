import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point } from '../core/types';
import { drawLockIcon } from '../core/Utils';

export const imageCache = new Map<string, HTMLImageElement>();

function drawHandle(ctx: CanvasRenderingContext2D, hx: number, hy: number) {
  const hw = 6;
  ctx.fillRect(hx - hw, hy - hw, hw * 2, hw * 2);
  ctx.strokeRect(hx - hw, hy - hw, hw * 2, hw * 2);
}

export class ImagePlugin implements IShapePlugin {
  type = 'image';

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean, isErasing: boolean) {
    const { x, y, width = 100, height = 100, imageSrc } = shape;
    
    if (imageSrc) {
      let img = imageCache.get(imageSrc);
      if (!img) {
        img = new Image();
        img.onload = () => {
          window.dispatchEvent(new CustomEvent('tuval-force-render'));
        };
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
    const isLocked = shape.locked;

    if (!isLocked) {
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 6, y - 6, width + 12, height + 12);
    }

    if (isLocked) {
      drawLockIcon(ctx, x + width + 6, y - 6);
      return;
    }

    ctx.setLineDash([]);
    ctx.fillStyle = '#1e1e24';
    ctx.strokeStyle = '#8b5cf6';
    
    const b = { x: x - 6, y: y - 6, w: width + 12, h: height + 12 };
    drawHandle(ctx, b.x, b.y); // nw
    drawHandle(ctx, b.x + b.w / 2, b.y); // n
    drawHandle(ctx, b.x + b.w, b.y); // ne
    drawHandle(ctx, b.x + b.w, b.y + b.h / 2); // e
    drawHandle(ctx, b.x + b.w, b.y + b.h); // se
    drawHandle(ctx, b.x + b.w / 2, b.y + b.h); // s
    drawHandle(ctx, b.x, b.y + b.h); // sw
    drawHandle(ctx, b.x, b.y + b.h / 2); // w
  }

  getBounds(shape: Shape) {
    return { x: shape.x, y: shape.y, width: shape.width || 100, height: shape.height || 100 };
  }

  isPointInside(point: Point, shape: Shape): boolean {
    const { x, y, width = 100, height = 100 } = shape;
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
  }

  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const { x, y, width = 100, height = 100 } = shape;
    const d = 15;
    
    if (Math.abs(point.x - x) <= d && Math.abs(point.y - y) <= d) return 'nw';
    if (Math.abs(point.x - (x + width / 2)) <= d && Math.abs(point.y - y) <= d) return 'n';
    if (Math.abs(point.x - (x + width)) <= d && Math.abs(point.y - y) <= d) return 'ne';
    if (Math.abs(point.x - x) <= d && Math.abs(point.y - (y + height / 2)) <= d) return 'w';
    if (Math.abs(point.x - (x + width)) <= d && Math.abs(point.y - (y + height / 2)) <= d) return 'e';
    if (Math.abs(point.x - x) <= d && Math.abs(point.y - (y + height)) <= d) return 'sw';
    if (Math.abs(point.x - (x + width / 2)) <= d && Math.abs(point.y - (y + height)) <= d) return 's';
    if (Math.abs(point.x - (x + width)) <= d && Math.abs(point.y - (y + height)) <= d) return 'se';
    return null;
  }

  onDrawInit(payload: PointerPayload): Partial<Shape> {
    return { x: payload.world.x, y: payload.world.y, width: 0, height: 0, imageSrc: '' };
  }

  onDrawUpdate(shape: Shape, payload: PointerPayload, dragStart: Pick<Point, "x"|"y">): Partial<Shape> {
    return { width: payload.world.x - dragStart.x, height: payload.world.y - dragStart.y };
  }

  onDragHandle(shape: Shape, handle: string, payload: PointerPayload, dragStart: Point): Partial<Shape> {
    const dx = payload.world.x - dragStart.x;
    const dy = payload.world.y - dragStart.y;
    
    const origW = shape.width || 100;
    const origH = shape.height || 100;
    const ratio = origW / origH;

    let { x, y } = shape;
    let w = origW;
    let h = origH;

    if (handle.includes('n')) { y += dy; h -= dy; }
    if (handle.includes('s')) { h += dy; }
    if (handle.includes('w')) { x += dx; w -= dx; }
    if (handle.includes('e')) { w += dx; }
    
    if (handle === 'e' || handle === 'w') {
        const newH = w / ratio;
        y = shape.y + (origH - newH) / 2;
        h = newH;
    } else if (handle === 'n' || handle === 's') {
        const newW = h * ratio;
        x = shape.x + (origW - newW) / 2;
        w = newW;
    } else {
        if (Math.abs(w * origH) > Math.abs(h * origW)) {
            const newH = w / ratio;
            if (handle.includes('n')) y += (h - newH);
            h = newH;
        } else {
            const newW = h * ratio;
            if (handle.includes('w')) x += (w - newW);
            w = newW;
        }
    }

    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }

    return { x, y, width: w, height: h };
  }
}
