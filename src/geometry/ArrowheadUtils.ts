import type { Point, ArrowheadStyle } from '../core/types';

/**
 * Draws an arrowhead at a given point with a specific angle and style.
 * Dispatches to generator/renderer methods.
 */
export function drawArrowhead(rc: any, ctx: CanvasRenderingContext2D, point: Point, angle: number, style: ArrowheadStyle, options: any, theme: 'light' | 'dark' = 'dark') {
  const drawables = getArrowheadDrawable(rc.generator, point, angle, style, options, theme);
  drawables.forEach(d => rc.draw(d));
}

/**
 * Generates Rough.js drawables for an arrowhead.
 */
export function getArrowheadDrawable(generator: any, point: Point, angle: number, style: ArrowheadStyle, options: any, theme: 'light' | 'dark' = 'dark'): any[] {
  if (style === 'none') return [];
  const size = Math.max(12, Math.min(30, (options.strokeWidth || 1) * 6 + 8));

  if (style === 'arrow') {
    const p1 = { x: point.x - size * Math.cos(angle - Math.PI / 6), y: point.y - size * Math.sin(angle - Math.PI / 6) };
    const p2 = { x: point.x - size * Math.cos(angle + Math.PI / 6), y: point.y - size * Math.sin(angle + Math.PI / 6) };
    return [
      generator.line(point.x, point.y, p1.x, p1.y, options),
      generator.line(point.x, point.y, p2.x, p2.y, options)
    ];
  } else if (style === 'triangle') {
    const p1 = { x: point.x - size * Math.cos(angle - Math.PI / 6), y: point.y - size * Math.sin(angle - Math.PI / 6) };
    const p2 = { x: point.x - size * Math.cos(angle + Math.PI / 6), y: point.y - size * Math.sin(angle + Math.PI / 6) };
    return [generator.polygon([[point.x, point.y], [p1.x, p1.y], [p2.x, p2.y]], { ...options, fill: options.stroke, fillStyle: 'solid' })];
  } else if (style === 'circle') {
    const cx = point.x - (size/2) * Math.cos(angle), cy = point.y - (size/2) * Math.sin(angle);
    return [generator.ellipse(cx, cy, size, size, { ...options, fill: theme === 'light' ? '#ffffff' : '#1e1e24', fillStyle: 'solid' })];
  } else if (style === 'diamond') {
    const cx = point.x - (size/2) * Math.cos(angle), cy = point.y - (size/2) * Math.sin(angle), hw = size / 2.5;
    const p1 = point, p2 = { x: cx - hw * Math.sin(angle), y: cy + hw * Math.cos(angle) }, p3 = { x: point.x - size * Math.cos(angle), y: point.y - size * Math.sin(angle) }, p4 = { x: cx + hw * Math.sin(angle), y: cy - hw * Math.cos(angle) };
    return [generator.polygon([[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y], [p4.x, p4.y]], { ...options, fill: theme === 'light' ? '#ffffff' : '#1e1e24', fillStyle: 'solid' })];
  } else if (style === 'bar') {
    const hw = size / 2;
    const p1 = { x: point.x - hw * Math.sin(angle), y: point.y + hw * Math.cos(angle) }, p2 = { x: point.x + hw * Math.sin(angle), y: point.y - hw * Math.cos(angle) };
    return [generator.line(p1.x, p1.y, p2.x, p2.y, options)];
  }
  return [];
}
