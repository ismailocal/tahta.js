import type { Shape, PointerPayload, ICanvasAPI } from '../core/types';
import { BaseDbPlugin } from './BaseDbPlugin';

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

function getTableData(shape: Shape): DbTableData {
  const data = shape.data as DbTableData | undefined;
  return {
    tableName: data?.tableName || 'Table',
    columns: data?.columns || [],
  };
}

export class DbTablePlugin extends BaseDbPlugin {
  type = 'db-table';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', opacity: 1 };
  defaultProperties = ['stroke', 'opacity', 'layer', 'action'];
  protected readonly DEFAULT_WIDTH = 220;
  protected readonly DEFAULT_HEIGHT = 120;
  protected readonly HEADER_HEIGHT = 36;
  protected readonly ROW_HEIGHT = 28;
  protected readonly BADGE_HEIGHT = 0;

  protected getRowCount(shape: Shape): number {
    const columns = (shape.data?.columns as any[]) ?? [];
    return columns.length;
  }

  protected getRowLabels(shape: Shape): string[] {
    const { columns } = getTableData(shape);
    return columns.map(col => col.name);
  }

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const { tableName, columns } = getTableData(shape);
    const { x, y } = shape;
    const w = shape.width ?? this.DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const isLight = theme === 'light';
    const accent = shape.stroke || (isLight ? '#475569' : '#cbd5e0');

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.clip();

    ctx.fillStyle = isLight ? '#ffffff' : '#1a1a2e';
    ctx.fill();

    this.renderHeaderBackground(
      ctx, x, y, w,
      isLight ? '#f1f5f9' : '#16213e',
      accent
    );

    ctx.fillStyle = isLight ? '#1e293b' : '#f1f5f9';
    ctx.font = 'bold 13px "Architects Daughter", cursive';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tableName, x + 12, y + this.HEADER_HEIGHT / 2, w - 24);

    columns.forEach((col, i) => {
      const rowY = y + this.HEADER_HEIGHT + i * this.ROW_HEIGHT;
      if (rowY >= y + h) return;

      this.renderRowSeparator(
        ctx, x, rowY, w,
        isLight ? '#e2e8f0' : '#2d2d4e'
      );

      let badgeOffset = x + 12;
      if (col.pk) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 9px "Architects Daughter", cursive';
        ctx.fillText('PK', badgeOffset, rowY + this.ROW_HEIGHT / 2);
        badgeOffset += 22;
      } else if (col.fk) {
        ctx.fillStyle = '#a78bfa';
        ctx.font = 'bold 9px "Architects Daughter", cursive';
        ctx.fillText('FK', badgeOffset, rowY + this.ROW_HEIGHT / 2);
        badgeOffset += 22;
      }

      ctx.fillStyle = col.pk ? (isLight ? '#92400e' : '#fde68a') : col.fk ? (isLight ? '#5b21b6' : '#ddd6fe') : (isLight ? '#475569' : '#e2e8f0');
      ctx.font = '12px "Architects Daughter", cursive';
      ctx.textAlign = 'left';
      ctx.fillText(col.name + (col.nullable ? '?' : ''), badgeOffset, rowY + this.ROW_HEIGHT / 2, w * 0.55 - badgeOffset + x);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px "Architects Daughter", cursive';
      ctx.textAlign = 'right';
      ctx.fillText(col.type, x + w - 10, rowY + this.ROW_HEIGHT / 2);
      ctx.textAlign = 'left';
    });

    ctx.restore();

    this.renderBorder(ctx, x, y, w, h, accent);
  }


  onDrawInit(payload: PointerPayload, _shapes: Shape[], api: ICanvasAPI): Partial<Shape> {
    const theme = api.getState().theme || 'dark';
    const defaultColor = '#64748b';
    const defaultColumns = [
      { name: 'id', type: 'INT', pk: true },
      { name: 'name', type: 'VARCHAR' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ];
    return {
      x: payload.world.x, y: payload.world.y, width: 0, height: 0,
      stroke: defaultColor,
      data: { tableName: 'Table', columns: defaultColumns } as any,
    };
  }
}
