import type { Shape, PointerPayload, ICanvasAPI } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';
import { buildRoughOptions } from '../core/lineUtils';

function getRoundRectPath(x: number, y: number, w: number, h: number, r: number) {
  return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} h -${w - 2 * r} a ${r} ${r} 0 0 1 -${r} -${r} v -${h - 2 * r} a ${r} ${r} 0 0 1 ${r} -${r} Z`;
}

export class RectanglePlugin extends BaseRectPlugin {
  type = 'rectangle';
  defaultStyle: Partial<Shape> = { stroke: '#64748b', fill: 'transparent', strokeWidth: 1, roughness: 0, roundness: 'round', opacity: 1 };
  defaultProperties = ['stroke', 'strokeWidth', 'strokeStyle', 'fill', 'fillStyle', 'roughness', 'roundness', 'opacity', 'layer', 'action'];

  getCornerRadius(shape: Shape): number {
    const w = shape.width || 0, h = shape.height || 0;
    return shape.roundness === 'round' ? Math.min(16, w / 2, h / 2) : 0;
  }

  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, _isSelected: boolean, _isErasing: boolean, _allShapes: Shape[], theme: 'light' | 'dark') {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const options = buildRoughOptions(shape, theme);

    if (shape.roundness === 'round') {
      const r = Math.min(16, Math.abs(w) / 2, Math.abs(h) / 2);
      rc.path(getRoundRectPath(shape.x, shape.y, w, h, r), options);
    } else {
      rc.rectangle(shape.x, shape.y, w, h, options);
    }
  }
 

}
