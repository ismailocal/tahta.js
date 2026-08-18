import { describe, expect, it, vi } from 'vitest';
import type { Shape } from '../core/types';
import { FramePlugin } from './FramePlugin';

function context(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    strokeRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('FramePlugin', () => {
  it.each([
    ['solid', []],
    ['dashed', [8, 6]],
    ['dotted', [2, 5]],
  ] as const)('renders the selected %s border style', (strokeStyle, expectedDash) => {
    const plugin = new FramePlugin();
    const ctx = context();
    const frame: Shape = {
      id: 'frame',
      type: 'frame',
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      stroke: '#a78bfa',
      strokeWidth: 3.5,
      strokeStyle,
    };

    plugin.render(null, ctx, frame, true, false, [], 'light');

    expect(ctx.setLineDash).toHaveBeenCalledWith(expectedDash);
    expect(ctx.strokeStyle).toBe('#a78bfa');
    expect(ctx.lineWidth).toBe(3.5);
    expect(ctx.strokeRect).toHaveBeenCalledWith(10, 20, 300, 200);
  });
});
