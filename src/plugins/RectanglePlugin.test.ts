import { describe, it, expect, vi } from 'vitest';

// Break circular dependency: BaseRectPlugin → Utils → PluginRegistry → index → plugins
vi.mock('../core/Utils', () => ({
  drawLockIcon: vi.fn(),
  createId: () => 'mock-id',
  getThemeAdjustedStroke: (_stroke: string, _theme: string) => _stroke ?? '#64748b',
}));

// Also mock lineUtils to avoid its own Utils import
vi.mock('../geometry/lineUtils', () => ({
  buildRoughOptions: (_shape: unknown, _theme: string) => ({
    stroke: '#64748b',
    fill: undefined,
    strokeWidth: 1.8,
    roughness: 0,
  }),
  calculateArrowPath: vi.fn(),
}));

import { RectanglePlugin } from './RectanglePlugin';
import { EllipsePlugin } from './EllipsePlugin';
import type { Shape } from '../core/types';

function makeShape(overrides: Partial<Shape> = {}): Shape {
  return {
    id: 'test',
    type: 'rectangle' as Shape['type'],
    x: 10,
    y: 20,
    width: 100,
    height: 60,
    roughness: 0,
    ...overrides,
  };
}

// Minimal rough generator mock
function makeGenerator() {
  return {
    path: vi.fn().mockReturnValue({ opSetList: [{ ops: [{ type: 'move', data: [0, 0] }] }] }),
    rectangle: vi.fn().mockReturnValue({ opSetList: [{ ops: [{ type: 'move', data: [0, 0] }] }] }),
    ellipse: vi.fn().mockReturnValue({ opSetList: [{ ops: [{ type: 'move', data: [0, 0] }] }] }),
  };
}

describe('RectanglePlugin.getDrawable', () => {
  const plugin = new RectanglePlugin();

  it('returns drawable for a normal shape', () => {
    const gen = makeGenerator();
    const result = plugin.getDrawable(gen, makeShape(), [], 'light');
    expect(result).toHaveLength(1);
    expect(gen.rectangle).toHaveBeenCalledWith(10, 20, 100, 60, expect.any(Object));
  });

  it('returns empty array when width is 0 — prevents roughjs crash', () => {
    const gen = makeGenerator();
    const result = plugin.getDrawable(gen, makeShape({ width: 0 }), [], 'light');
    expect(result).toHaveLength(0);
    expect(gen.rectangle).not.toHaveBeenCalled();
    expect(gen.path).not.toHaveBeenCalled();
  });

  it('returns empty array when height is 0 — prevents roughjs crash', () => {
    const gen = makeGenerator();
    const result = plugin.getDrawable(gen, makeShape({ height: 0 }), [], 'light');
    expect(result).toHaveLength(0);
  });

  it('returns empty array when width is undefined — prevents roughjs crash', () => {
    const gen = makeGenerator();
    const result = plugin.getDrawable(gen, makeShape({ width: undefined }), [], 'light');
    expect(result).toHaveLength(0);
  });

  it('returns empty array when height is undefined — prevents roughjs crash', () => {
    const gen = makeGenerator();
    const result = plugin.getDrawable(gen, makeShape({ height: undefined }), [], 'light');
    expect(result).toHaveLength(0);
  });

  it('uses path (not rectangle) for roundness=round shapes', () => {
    const gen = makeGenerator();
    const result = plugin.getDrawable(gen, makeShape({ roundness: 'round' }), [], 'light');
    expect(result).toHaveLength(1);
    expect(gen.path).toHaveBeenCalled();
    expect(gen.rectangle).not.toHaveBeenCalled();
  });

  it('returns empty for roundness=round with zero width — previously crashed roughjs', () => {
    const gen = makeGenerator();
    // This is the exact scenario that caused "Cannot read properties of undefined (reading 'type')"
    const result = plugin.getDrawable(gen, makeShape({ width: 0, height: 0, roundness: 'round' }), [], 'light');
    expect(result).toHaveLength(0);
    expect(gen.path).not.toHaveBeenCalled();
  });
});

describe('EllipsePlugin.getDrawable', () => {
  const plugin = new EllipsePlugin();

  it('returns drawable for a normal shape', () => {
    const gen = makeGenerator();
    const shape = makeShape({ type: 'ellipse' as Shape['type'] });
    const result = plugin.getDrawable(gen, shape, [], 'light');
    expect(result).toHaveLength(1);
    expect(gen.ellipse).toHaveBeenCalled();
  });

  it('returns empty array when width is 0 — prevents roughjs crash', () => {
    const gen = makeGenerator();
    const result = plugin.getDrawable(gen, makeShape({ type: 'ellipse' as Shape['type'], width: 0 }), [], 'light');
    expect(result).toHaveLength(0);
    expect(gen.ellipse).not.toHaveBeenCalled();
  });

  it('returns empty array when height is undefined', () => {
    const gen = makeGenerator();
    const result = plugin.getDrawable(gen, makeShape({ type: 'ellipse' as Shape['type'], height: undefined }), [], 'light');
    expect(result).toHaveLength(0);
  });
});
