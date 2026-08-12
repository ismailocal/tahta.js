import { describe, expect, it } from 'vitest';
import type { Shape } from '../core/types';
import { exportToSvg } from './Export';

describe('canvas export', () => {
  it('exports the main shape families with a bounded viewBox', () => {
    const shapes = [
      { id: 'rect', type: 'rectangle', x: -20, y: 5, width: 100, height: 50, text: 'Başlık' },
      { id: 'diamond', type: 'diamond', x: 150, y: 50, width: 80, height: 80 },
      { id: 'line', type: 'line', x: 20, y: 100, width: 30, height: 20, points: [{ x: 0, y: 0 }, { x: 30, y: 20 }] },
    ] as unknown as Shape[];

    const svg = exportToSvg(shapes, '#ffffff');

    expect(svg).toContain('<rect');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<path');
    expect(svg).toContain('viewBox="0 0');
  });

  it('rejects a non-exportable image instead of drawing a fallback', () => {
    const shape = {
      id: 'unsafe',
      type: 'image',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      imageSrc: 'data:image/svg+xml,<svg onload="alert(1)">',
      text: '<script>alert(1)</script>',
      fontFamily: '" onload="alert(1)',
    } as unknown as Shape;

    expect(() => exportToSvg([shape], '"/><script>alert(1)</script>')).toThrowError(/no exportable asset/);
  });
});
