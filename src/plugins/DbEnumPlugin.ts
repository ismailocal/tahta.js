import type { Shape, PointerPayload, Point, ConnectionPoint, ICanvasAPI } from '../core/types';
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
  defaultStyle: Partial<Shape> = { stroke: '#64748b', opacity: 1 };
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

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const { enumName, values } = getEnumData(shape);
    const { x, y } = shape;
    const w = shape.width ?? DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const isLight = theme === 'light';
    const accent = shape.stroke || (isLight ? '#475569' : '#cbd5e0');

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.clip();

    ctx.fillStyle = isLight ? '#ffffff' : '#1a0a1e'; ctx.fill();
 
    ctx.fillStyle = isLight ? '#fdf2f8' : '#2d0a2e';
    ctx.beginPath(); ctx.rect(x, y, w, HEADER_HEIGHT); ctx.fill();

    ctx.fillStyle = accent;
    ctx.fillRect(x, y + HEADER_HEIGHT - 2, w, 2);

    ctx.fillStyle = accent;
    ctx.font = 'bold 9px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('ENUM', x + 10, y + 10);

    ctx.fillStyle = isLight ? '#be185d' : '#fdf4ff';
    ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
    ctx.fillText(enumName, x + 10, y + HEADER_HEIGHT / 2 + 6, w - 20);

    values.forEach((val, i) => {
      const rowY = y + HEADER_HEIGHT + BADGE_HEIGHT + i * ROW_HEIGHT;
      if (rowY >= y + h) return;

      ctx.strokeStyle = isLight ? '#fce7f3' : '#3d1045'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, rowY); ctx.lineTo(x + w, rowY); ctx.stroke();

      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(x + 14, rowY + ROW_HEIGHT / 2, 3, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = isLight ? '#be185d' : '#f9a8d4';
      ctx.font = '12px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(val, x + 24, rowY + ROW_HEIGHT / 2, w - 34);
    });

    ctx.restore();

    ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.stroke();
  }

onDrawInit(payload: PointerPayload, _shapes: Shape[], api: ICanvasAPI): Partial<Shape> {
    const theme = api.getState().theme || 'dark';
    const defaultColor = '#64748b';
    const defaultValues = ['ACTIVE', 'INACTIVE', 'PENDING'];
    return {
      x: payload.world.x, y: payload.world.y, width: 0, height: 0,
      stroke: defaultColor,
      data: { enumName: 'Status', values: defaultValues } as any,
    };
  }
}
