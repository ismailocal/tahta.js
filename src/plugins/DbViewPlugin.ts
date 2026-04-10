import type { Shape, PointerPayload, Point, ConnectionPoint, ICanvasAPI } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';

export interface DbViewColumn { name: string; type: string; }
export interface DbViewData { viewName: string; columns: DbViewColumn[]; }

const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 110;
const HEADER_HEIGHT = 36;
const BADGE_H = 0;
const ROW_HEIGHT = 28;

function getViewData(shape: Shape): DbViewData {
  const data = shape.data as DbViewData | undefined;
  return { viewName: data?.viewName || 'View', columns: data?.columns || [] };
}

export class DbViewPlugin extends BaseRectPlugin {
  type = 'db-view';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', opacity: 1 };
  defaultProperties = ['stroke', 'opacity', 'layer', 'action'];
  protected minWidth = 80;
  protected minHeight = 40;

  getCornerRadius(): number { return 6; }

  getDefaultHeight(shape: Shape): number {
    const columns = ((shape.data as DbViewData | undefined)?.columns) ?? [];
    return HEADER_HEIGHT + Math.max(1, columns.length) * ROW_HEIGHT;
  }

  getBounds(shape: Shape) {
    return { x: shape.x, y: shape.y, width: shape.width ?? DEFAULT_WIDTH, height: shape.height ?? this.getDefaultHeight(shape) };
  }

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const { viewName, columns } = getViewData(shape);
    const { x, y } = shape;
    const w = shape.width ?? DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const isLight = theme === 'light';
    const accent = shape.stroke || (isLight ? '#475569' : '#cbd5e0');

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.clip();

    ctx.fillStyle = isLight ? '#ffffff' : '#0f2027'; ctx.fill();

    ctx.fillStyle = isLight ? '#f1f5f9' : '#0a1628';
    ctx.beginPath(); ctx.rect(x, y, w, HEADER_HEIGHT); ctx.fill();

    ctx.fillStyle = accent;
    ctx.fillRect(x, y + HEADER_HEIGHT - 2, w, 2);

    ctx.fillStyle = accent;
    ctx.font = 'bold 9px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('VIEW', x + 12, y + 10);

    ctx.fillStyle = isLight ? '#1e293b' : '#f0fdf4';
    ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
    ctx.fillText(viewName, x + 12, y + HEADER_HEIGHT / 2 + 6, w - 24);

    columns.forEach((col, i) => {
      const rowY = y + HEADER_HEIGHT + BADGE_H + i * ROW_HEIGHT;
      if (rowY >= y + h) return;

      ctx.strokeStyle = isLight ? '#ecfdf5' : '#1a3a2a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, rowY); ctx.lineTo(x + w, rowY); ctx.stroke();

      ctx.fillStyle = isLight ? '#065f46' : '#d1fae5';
      ctx.font = '12px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(col.name, x + 12, rowY + ROW_HEIGHT / 2, w * 0.6);

      ctx.fillStyle = isLight ? '#64748b' : '#64748b';
      ctx.font = '11px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(col.type, x + w - 10, rowY + ROW_HEIGHT / 2);
      ctx.textAlign = 'left';
    });

    ctx.restore();

    ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.stroke();
    ctx.setLineDash([]);
  }

getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const { columns } = getViewData(shape);
    const { x, y } = shape;
    const w = shape.width ?? DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const points: ConnectionPoint[] = [];
    columns.forEach((col, i) => {
      const rowY = y + HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2;
      if (rowY > y + h) return;
      points.push({ id: `col-${i}-left`,  x,         y: rowY, label: col.name, side: 'left'  });
      points.push({ id: `col-${i}-right`, x: x + w,  y: rowY, label: col.name, side: 'right' });
    });
    return points;
  }

  onDrawInit(payload: PointerPayload, _shapes: Shape[], api: ICanvasAPI): Partial<Shape> {
    const theme = api.getState().theme || 'dark';
    const defaultColor = '#64748b';
    const defaultColumns = [{ name: 'id', type: 'INT' }, { name: 'name', type: 'VARCHAR' }];
    return {
      x: payload.world.x, y: payload.world.y, width: 0, height: 0,
      stroke: defaultColor,
      data: { viewName: 'View', columns: defaultColumns } as any,
    };
  }
}
