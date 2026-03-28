import type { Shape, PointerPayload, Point, ConnectionPoint } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';

export interface DbColumn {
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  nullable?: boolean;
}

export interface DbTableData {
  tableName: string;
  columns: DbColumn[];
}

const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 120;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 28;

function getTableData(shape: Shape): DbTableData {
  const data = shape.data as DbTableData | undefined;
  return {
    tableName: data?.tableName || 'Table',
    columns: data?.columns || [],
  };
}

export class DbTablePlugin extends BaseRectPlugin {
  type = 'db-table';
  defaultStyle: Partial<Shape> = { stroke: '#60a5fa', opacity: 1 };
  defaultProperties = ['layer', 'action'];
  protected minWidth = 80;
  protected minHeight = 40;

  getCornerRadius(): number { return 6; }

  getDefaultHeight(shape: Shape): number {
    const columns = (shape.data?.columns as any[]) ?? [];
    return HEADER_HEIGHT + Math.max(1, columns.length) * ROW_HEIGHT;
  }

  getBounds(shape: Shape) {
    const w = shape.width ?? DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    return { x: shape.x, y: shape.y, width: w, height: h };
  }

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape) {
    const { tableName, columns } = getTableData(shape);
    const { x, y } = shape;
    const w = shape.width ?? DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const accent = shape.stroke || '#60a5fa';

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.clip();

    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    ctx.fillStyle = '#16213e';
    ctx.beginPath();
    ctx.rect(x, y, w, HEADER_HEIGHT);
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.fillRect(x, y + HEADER_HEIGHT - 2, w, 2);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tableName, x + 12, y + HEADER_HEIGHT / 2, w - 24);

    columns.forEach((col, i) => {
      const rowY = y + HEADER_HEIGHT + i * ROW_HEIGHT;
      if (rowY >= y + h) return;

      ctx.strokeStyle = '#2d2d4e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, rowY);
      ctx.lineTo(x + w, rowY);
      ctx.stroke();

      let badgeOffset = x + 12;
      if (col.pk) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 9px "Inter", system-ui, sans-serif';
        ctx.fillText('PK', badgeOffset, rowY + ROW_HEIGHT / 2);
        badgeOffset += 22;
      } else if (col.fk) {
        ctx.fillStyle = '#a78bfa';
        ctx.font = 'bold 9px "Inter", system-ui, sans-serif';
        ctx.fillText('FK', badgeOffset, rowY + ROW_HEIGHT / 2);
        badgeOffset += 22;
      }

      ctx.fillStyle = col.pk ? '#fde68a' : col.fk ? '#ddd6fe' : '#e2e8f0';
      ctx.font = '12px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(col.name + (col.nullable ? '?' : ''), badgeOffset, rowY + ROW_HEIGHT / 2, w * 0.55 - badgeOffset + x);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(col.type, x + w - 10, rowY + ROW_HEIGHT / 2);
      ctx.textAlign = 'left';
    });

    ctx.restore();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.stroke();
  }

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const { columns } = getTableData(shape);
    const { x, y } = shape;
    const w = shape.width ?? DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const points: ConnectionPoint[] = [];
    columns.forEach((col, i) => {
      const rowY = y + HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2;
      if (rowY > y + h) return;
      points.push({ id: `col-${i}-left`,  x,     y: rowY, label: col.name, side: 'left'  });
      points.push({ id: `col-${i}-right`, x: x + w, y: rowY, label: col.name, side: 'right' });
    });
    return points;
  }

  onDrawInit(payload: PointerPayload): Partial<Shape> {
    const defaultColumns = [
      { name: 'id', type: 'INT', pk: true },
      { name: 'name', type: 'VARCHAR' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ];
    return {
      x: payload.world.x, y: payload.world.y, width: 0, height: 0,
      data: { tableName: 'Table', columns: defaultColumns } as DbTableData,
    };
  }
}
