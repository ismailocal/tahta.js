import type { Shape } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';

function frameStrokeDash(strokeStyle: Shape['strokeStyle']): number[] {
  if (strokeStyle === 'solid') return [];
  if (strokeStyle === 'dotted') return [2, 5];
  return [8, 6];
}

/** A named, presentation-ready board section. */
export class FramePlugin extends BaseRectPlugin {
  type = 'frame';
  protected minWidth = 160;
  protected minHeight = 90;
  defaultStyle: Partial<Shape> = {
    stroke: '#94a3b8',
    fill: 'transparent',
    strokeWidth: 1.5,
    strokeStyle: 'dashed',
    roughness: 0,
    roundness: 'round',
    opacity: 1,
    textColor: '#475569',
    fontSize: 18,
    textAlign: 'left',
    textVerticalAlign: 'top',
  };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'opacity', 'textLayout', 'layer', 'action'];

  onDrawInit(...args: Parameters<BaseRectPlugin['onDrawInit']>): Partial<Shape> {
    return { ...super.onDrawInit(...args), text: 'Yeni bölüm' };
  }

  render(
    _rc: unknown,
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    _isSelected: boolean,
    _isErasing: boolean,
    _allShapes: Shape[],
    theme: 'light' | 'dark',
  ): void {
    const width = shape.width ?? 0;
    const height = shape.height ?? 0;
    ctx.save();
    ctx.strokeStyle = shape.stroke ?? (theme === 'dark' ? '#64748b' : '#94a3b8');
    ctx.lineWidth = shape.strokeWidth ?? 1.5;
    ctx.setLineDash(frameStrokeDash(shape.strokeStyle));
    ctx.strokeRect(shape.x, shape.y, width, height);
    ctx.restore();
  }

  renderFast(ctx: CanvasRenderingContext2D, shape: Shape, theme: 'light' | 'dark'): void {
    this.render(null, ctx, shape, false, false, [], theme);
  }
}
