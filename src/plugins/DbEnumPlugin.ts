import type { Shape, PointerPayload, ICanvasAPI } from '../core/types';
import { BaseDbPlugin } from './BaseDbPlugin';

export interface DbEnumData { enumName: string; values: string[]; }

function getEnumData(shape: Shape): DbEnumData {
  const data = shape.data as DbEnumData | undefined;
  return { enumName: data?.enumName || 'Enum', values: data?.values || [] };
}

export class DbEnumPlugin extends BaseDbPlugin {
  type = 'db-enum';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', opacity: 1 };
  defaultProperties = ['stroke', 'opacity', 'layer', 'action'];
  protected readonly DEFAULT_WIDTH = 160;
  protected readonly DEFAULT_HEIGHT = 110;
  protected readonly HEADER_HEIGHT = 36;
  protected readonly ROW_HEIGHT = 26;
  protected readonly BADGE_HEIGHT = 0;

  protected getRowCount(shape: Shape): number {
    const values = ((shape.data as DbEnumData | undefined)?.values) ?? [];
    return values.length;
  }

  protected getRowLabels(shape: Shape): string[] {
    const { values } = getEnumData(shape);
    return values;
  }

  render(_rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const { enumName, values } = getEnumData(shape);
    const { x, y } = shape;
    const w = shape.width ?? this.DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const isLight = theme === 'light';
    const accent = shape.stroke || (isLight ? '#475569' : '#cbd5e0');

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.clip();

    ctx.fillStyle = isLight ? '#ffffff' : '#1a0a1e';
    ctx.fill();

    this.renderHeaderBackground(
      ctx, x, y, w,
      isLight ? '#fdf2f8' : '#2d0a2e',
      accent
    );

    ctx.fillStyle = accent;
    ctx.font = 'bold 9px "Architects Daughter", cursive';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ENUM', x + 10, y + 10);

    ctx.fillStyle = isLight ? '#be185d' : '#fdf4ff';
    ctx.font = 'bold 13px "Architects Daughter", cursive';
    ctx.fillText(enumName, x + 10, y + this.HEADER_HEIGHT / 2 + 6, w - 20);

    values.forEach((val, i) => {
      const rowY = y + this.HEADER_HEIGHT + this.BADGE_HEIGHT + i * this.ROW_HEIGHT;
      if (rowY >= y + h) return;

      this.renderRowSeparator(
        ctx, x, rowY, w,
        isLight ? '#fce7f3' : '#3d1045'
      );

      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x + 14, rowY + this.ROW_HEIGHT / 2, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isLight ? '#be185d' : '#f9a8d4';
      ctx.font = '12px "Architects Daughter", cursive';
      ctx.textAlign = 'left';
      ctx.fillText(val, x + 24, rowY + this.ROW_HEIGHT / 2, w - 34);
    });

    ctx.restore();

    this.renderBorder(ctx, x, y, w, h, accent);
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
