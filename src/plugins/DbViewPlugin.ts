import type { Shape, PointerPayload, ICanvasAPI } from '../core/types';
import { BaseDbPlugin } from './BaseDbPlugin';

export interface DbViewColumn { name: string; type: string; }
export interface DbViewData { viewName: string; columns: DbViewColumn[]; }

function getViewData(shape: Shape): DbViewData {
  const data = shape.data as DbViewData | undefined;
  return { viewName: data?.viewName || 'View', columns: data?.columns || [] };
}

export class DbViewPlugin extends BaseDbPlugin {
  type = 'db-view';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', opacity: 1 };
  defaultProperties = ['stroke', 'opacity', 'layer', 'action'];
  protected readonly DEFAULT_WIDTH = 220;
  protected readonly DEFAULT_HEIGHT = 110;
  protected readonly HEADER_HEIGHT = 36;
  protected readonly ROW_HEIGHT = 28;
  protected readonly BADGE_HEIGHT = 0;

  protected getRowCount(shape: Shape): number {
    const columns = ((shape.data as DbViewData | undefined)?.columns) ?? [];
    return columns.length;
  }

  protected getRowLabels(shape: Shape): string[] {
    const { columns } = getViewData(shape);
    return columns.map(col => col.name);
  }

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const { viewName, columns } = getViewData(shape);
    const { x, y } = shape;
    const w = shape.width ?? this.DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const isLight = theme === 'light';
    const accent = shape.stroke || (isLight ? '#475569' : '#cbd5e0');

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.clip();

    ctx.fillStyle = isLight ? '#ffffff' : '#0f2027';
    ctx.fill();

    this.renderHeaderBackground(
      ctx, x, y, w,
      isLight ? '#f1f5f9' : '#0a1628',
      accent
    );

    ctx.fillStyle = accent;
    ctx.font = 'bold 9px "Architects Daughter", cursive';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('VIEW', x + 12, y + 10);

    ctx.fillStyle = isLight ? '#1e293b' : '#f0fdf4';
    ctx.font = 'bold 13px "Architects Daughter", cursive';
    ctx.fillText(viewName, x + 12, y + this.HEADER_HEIGHT / 2 + 6, w - 24);

    columns.forEach((col, i) => {
      const rowY = y + this.HEADER_HEIGHT + this.BADGE_HEIGHT + i * this.ROW_HEIGHT;
      if (rowY >= y + h) return;

      this.renderRowSeparator(
        ctx, x, rowY, w,
        isLight ? '#ecfdf5' : '#1a3a2a'
      );

      ctx.fillStyle = isLight ? '#065f46' : '#d1fae5';
      ctx.font = '12px "Architects Daughter", cursive';
      ctx.textAlign = 'left';
      ctx.fillText(col.name, x + 12, rowY + this.ROW_HEIGHT / 2, w * 0.6);

      ctx.fillStyle = isLight ? '#64748b' : '#64748b';
      ctx.font = '11px "Architects Daughter", cursive';
      ctx.textAlign = 'right';
      ctx.fillText(col.type, x + w - 10, rowY + this.ROW_HEIGHT / 2);
      ctx.textAlign = 'left';
    });

    ctx.restore();

    this.renderBorder(ctx, x, y, w, h, accent, true);
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
