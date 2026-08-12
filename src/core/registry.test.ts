import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ShapeRegistry, type ShapeDefinition } from './registry';

const definition = (type = 'test', version = 1): ShapeDefinition<{ width: number; height: number }> => ({
  type,
  version,
  schema: z.object({ width: z.number().positive(), height: z.number().positive() }).strict(),
  defaults: () => ({ width: 100, height: 80 }),
  geometry: {
    getBounds: (record) => ({ x: record.x, y: record.y, width: record.props.width, height: record.props.height }),
    containsPoint: (record, point) => point.x >= record.x && point.y >= record.y,
  },
  render: vi.fn(),
  exportSvg: () => '<rect/>',
});

const record = (type = 'test', version = 1) => ({
  id: 'shape', type, typeVersion: version, parentId: 'root', index: 'a0',
  x: 0, y: 0, rotation: 0, opacity: 1, locked: false, hidden: false,
  props: { width: 100, height: 80 },
});

describe('ShapeRegistry', () => {
  it('registers, lists and validates complete shape definitions', () => {
    const registry = new ShapeRegistry();
    const shape = definition();
    registry.register(shape);
    expect(registry.has('test')).toBe(true);
    expect(registry.list()).toEqual([shape]);
    expect(registry.get('test')).toBe(shape);
    expect(registry.validate(record())).toMatchObject({ id: 'shape', props: { width: 100, height: 80 } });
  });

  it('rejects invalid, duplicate, unknown and unsupported definitions explicitly', () => {
    const registry = new ShapeRegistry();
    expect(() => registry.register(definition('', 1))).toThrow('positive integer version');
    expect(() => registry.register(definition('bad', 0))).toThrow('positive integer version');
    registry.register(definition());
    expect(() => registry.register(definition())).toThrow('already registered');
    expect(() => registry.get('missing')).toThrow('not registered');
    expect(() => registry.validate(record('test', 2))).toThrow('expected version 1');
    expect(() => registry.validate({ ...record(), props: { width: -1, height: 80 } })).toThrow();
  });

  it('keeps runtime adapters instance-scoped and unique', () => {
    const registry = new ShapeRegistry();
    registry.register(definition());
    const runtime = { draw: vi.fn() };
    expect(registry.hasRuntime('test')).toBe(false);
    registry.attachRuntime('test', runtime);
    expect(registry.hasRuntime('test')).toBe(true);
    expect(registry.getRuntime('test')).toBe(runtime);
    expect(() => registry.attachRuntime('test', {})).toThrow('already attached');

    const isolated = new ShapeRegistry();
    isolated.register(definition());
    expect(() => isolated.getRuntime('test')).toThrow('not attached');
    expect(() => isolated.attachRuntime('missing', {})).toThrow('not registered');
  });
});
