import type { Shape, PointerPayload, ICanvasAPI } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';
import { getThemeAdjustedStroke } from '../core/lineUtils';

function getRoundRectPath(x: number, y: number, w: number, h: number, r: number) {
  return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} h -${w - 2 * r} a ${r} ${r} 0 0 1 -${r} -${r} v -${h - 2 * r} a ${r} ${r} 0 0 1 ${r} -${r} Z`;
}

export class RectanglePlugin extends BaseRectPlugin {
  type = 'rectangle';
  defaultStyle: Partial<Shape> = { stroke: '#8b5cf6', fill: 'transparent', strokeWidth: 1, roughness: 0, roundness: 'round', opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'fill', 'fillStyle', 'roughness', 'roundness', 'opacity', 'layer', 'action'];

  getCornerRadius(shape: Shape): number {
    const w = shape.width || 0, h = shape.height || 0;
    return shape.roundness === 'round' ? Math.min(16, w / 2, h / 2) : 0;
  }

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const isLight = theme === 'light';
    const options: any = {
      stroke: getThemeAdjustedStroke(shape.stroke, theme),
      fill: shape.fill && shape.fill !== 'transparent' ? shape.fill : undefined,
      strokeWidth: shape.strokeWidth || 1.8,
      roughness: shape.roughness ?? 1,
      fillStyle: shape.fillStyle || 'hachure',
      seed: shape.seed ?? 1,
    };

    if (shape.strokeStyle === 'dashed') options.strokeLineDash = [8, 8];
    else if (shape.strokeStyle === 'dotted') options.strokeLineDash = [2, 6];

    if (shape.roundness === 'round') {
      const r = Math.min(16, Math.abs(w) / 2, Math.abs(h) / 2);
      rc.path(getRoundRectPath(shape.x, shape.y, w, h, r), options);
    } else {
      rc.rectangle(shape.x, shape.y, w, h, options);
    }
  }
 

}
