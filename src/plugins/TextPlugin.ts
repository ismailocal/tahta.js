import type { IShapePlugin } from './IShapePlugin';
import type { Shape, PointerPayload, Point } from '../core/types';
import { getTextMetrics, drawLockIcon } from '../core/Utils';

export class TextPlugin implements IShapePlugin {
  type = 'text';
  defaultStyle: Partial<Shape> = { stroke: '#f8fafc', fontSize: 24, opacity: 1 };
  defaultProperties = ['stroke', 'layer', 'action'];

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean) {
    if (!shape.text) return;
    const fontSize = shape.fontSize || 20;
    ctx.fillStyle = shape.stroke || '#f8fafc';
    ctx.font = `${fontSize}px ${shape.fontFamily || "'Architects Daughter', cursive"}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    shape.text.split('\n').forEach((line, index) => ctx.fillText(line, shape.x, shape.y + index * fontSize * 1.2));
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const bounds = this.getBounds(shape);
    if (shape.locked) {
      drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
    }
  }

  getBounds(shape: Shape) {
    const metrics = getTextMetrics(shape);
    return { x: shape.x, y: shape.y, width: metrics.width, height: metrics.height };
  }

  getHandleAtPoint(shape: Shape, point: Point): string | null {
    const d = 12;
    const bounds = this.getBounds(shape);
    const b = { x: bounds.x - 6, y: bounds.y - 6, w: bounds.width + 12, h: bounds.height + 12 };
    
    if (Math.abs(point.x - b.x) <= d && Math.abs(point.y - b.y) <= d) return 'nw';
    if (Math.abs(point.x - (b.x + b.w)) <= d && Math.abs(point.y - b.y) <= d) return 'ne';
    if (Math.abs(point.x - b.x) <= d && Math.abs(point.y - (b.y + b.h)) <= d) return 'sw';
    if (Math.abs(point.x - (b.x + b.w)) <= d && Math.abs(point.y - (b.y + b.h)) <= d) return 'se';
    return null;
  }

  isPointInside(point: Point, shape: Shape): boolean {
    const bounds = this.getBounds(shape);
    const margin = 6;
    return (
      point.x >= bounds.x - margin &&
      point.x <= bounds.x + bounds.width + margin &&
      point.y >= bounds.y - margin &&
      point.y <= bounds.y + bounds.height + margin
    );
  }

  onDrawInit(payload: PointerPayload): Partial<Shape> {
    return { x: payload.world.x, y: payload.world.y, width: 200, height: 40 };
  }

  onDrawUpdate(): Partial<Shape> {
    return {};
  }

  onDragHandle(shape: Shape, handle: string, payload: PointerPayload, dragStart: Point): Partial<Shape> {
    const dx = payload.world.x - dragStart.x;
    const dy = payload.world.y - dragStart.y;
    
    const bounds = this.getBounds(shape);
    if (bounds.width === 0 || bounds.height === 0) return {};

    let newW = bounds.width;
    let newH = bounds.height;

    if (handle.includes('e')) newW += dx;
    if (handle.includes('w')) newW -= dx;
    if (handle.includes('s')) newH += dy;
    if (handle.includes('n')) newH -= dy;

    // Use ratio to scale fontSize proportionally
    const scale = (handle.includes('e') || handle.includes('w')) ? (newW / bounds.width) : (newH / bounds.height);
    const newFontSize = Math.max(8, (shape.fontSize || 20) * scale);
    
    // Back-calculate exact X/Y based on the new dimensions from pivot
    const actualScale = newFontSize / (shape.fontSize || 20);
    const actualNewW = bounds.width * actualScale;
    const actualNewH = bounds.height * actualScale;

    let newX = shape.x;
    let newY = shape.y;

    if (handle.includes('w')) newX = bounds.x + bounds.width - actualNewW;
    if (handle.includes('n')) newY = bounds.y + bounds.height - actualNewH;

    return { x: newX, y: newY, fontSize: newFontSize };
  }
}
