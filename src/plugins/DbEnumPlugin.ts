import type { Shape, PointerPayload, Point, ConnectionPoint } from '../core/types';
import { drawLockIcon } from '../core/Utils';
import { BaseRectPlugin } from './BaseRectPlugin';

export interface DbEnumData { enumName: string; values: string[]; }

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 110;
const HEADER_HEIGHT = 36;
const BADGE_HEIGHT = 0;
const ROW_HEIGHT = 26;

function getEnumData(shape: Shape): DbEnumData {
  const data = shape.data as DbEnumData | undefined;
  return { enumName: data?.enumName || 'Enum', values: data?.values || [] };
}

export class DbEnumPlugin extends BaseRectPlugin {
  type = 'db-enum';
  defaultStyle: Partial<Shape> = { stroke: '#f472b6', opacity: 1 };
  defaultProperties = ['stroke', 'opacity', 'layer', 'action'];
  protected minWidth = 80;
  protected minHeight = 40;

  getCornerRadius(): number { return 6; }

  getDefaultHeight(shape: Shape): number {
    const values = ((shape.data as DbEnumData | undefined)?.values) ?? [];
    return HEADER_HEIGHT + Math.max(1, values.length) * ROW_HEIGHT;
  }

  getBounds(shape: Shape) {
    return { x: shape.x, y: shape.y, width: shape.width ?? DEFAULT_WIDTH, height: shape.height ?? this.getDefaultHeight(shape) };
  }

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const { enumName: _, values } = getEnumData(shape);
    const { x, y } = shape;
    const w = shape.width ?? DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const points: ConnectionPoint[] = [];
    values.forEach((val, i) => {
      const rowY = y + HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2;
      if (rowY > y + h) return;
      points.push({ id: `val-${i}-left`,  x,         y: rowY, label: val, side: 'left'  });
      points.push({ id: `val-${i}-right`, x: x + w,  y: rowY, label: val, side: 'right' });
    });
    return points;
  }

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape) {
    const { enumName, values } = getEnumData(shape);
    const { x, y } = shape;
    const w = shape.width ?? DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const accent = shape.stroke || '#f472b6';

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.clip();

    ctx.fillStyle = '#1a0a1e'; ctx.fill();

    ctx.fillStyle = '#2d0a2e';
    ctx.beginPath(); ctx.rect(x, y, w, HEADER_HEIGHT); ctx.fill();

    ctx.fillStyle = accent;
    ctx.fillRect(x, y + HEADER_HEIGHT - 2, w, 2);

    ctx.fillStyle = accent;
    ctx.font = 'bold 9px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('ENUM', x + 10, y + 10);

    ctx.fillStyle = '#fdf4ff';
    ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
    ctx.fillText(enumName, x + 10, y + HEADER_HEIGHT / 2 + 6, w - 20);

    values.forEach((val, i) => {
      const rowY = y + HEADER_HEIGHT + BADGE_HEIGHT + i * ROW_HEIGHT;
      if (rowY >= y + h) return;

      ctx.strokeStyle = '#3d1045'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, rowY); ctx.lineTo(x + w, rowY); ctx.stroke();

      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(x + 14, rowY + ROW_HEIGHT / 2, 3, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#f9a8d4';
      ctx.font = '12px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(val, x + 24, rowY + ROW_HEIGHT / 2, w - 34);
    });

    ctx.restore();

    ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.stroke();
  }

  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    const bounds = this.getBounds(shape);
    if (shape.locked) drawLockIcon(ctx, bounds.x + bounds.width + 6, bounds.y - 6);
  }

  onDrawInit(payload: PointerPayload): Partial<Shape> {
    const defaultValues = ['ACTIVE', 'INACTIVE', 'PENDING'];
    return {
      x: payload.world.x, y: payload.world.y, width: 0, height: 0,
      data: { enumName: 'Status', values: defaultValues } as DbEnumData,
    };
  }
}
