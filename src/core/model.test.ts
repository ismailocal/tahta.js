import { describe, expect, it } from 'vitest';
import {
  CanvasReadonlyError,
  CanvasValidationError,
  assertJsonSize,
  compareFractionalIndex,
  viewportSchema,
} from './model';

describe('canvas model validation', () => {
  it('orders fractional indexes deterministically', () => {
    expect(compareFractionalIndex('a0', 'a0')).toBe(0);
    expect(compareFractionalIndex('a0', 'a1')).toBe(-1);
    expect(compareFractionalIndex('a1', 'a0')).toBe(1);
  });

  it('rejects non-finite and out-of-range viewports', () => {
    expect(viewportSchema.parse({ x: 1, y: 2, zoom: 1 })).toEqual({ x: 1, y: 2, zoom: 1 });
    expect(() => viewportSchema.parse({ x: Number.NaN, y: 0, zoom: 1 })).toThrow();
    expect(() => viewportSchema.parse({ x: 0, y: 0, zoom: 0.01 })).toThrow();
    expect(() => viewportSchema.parse({ x: 0, y: 0, zoom: 33 })).toThrow();
  });

  it('enforces JSON byte limits and exposes actionable error types', () => {
    expect(() => assertJsonSize({ value: 'ok' }, 100, 'metadata')).not.toThrow();
    expect(() => assertJsonSize({ value: 'ğ'.repeat(20) }, 10, 'metadata')).toThrow('metadata exceeds 10 bytes');
    const validation = new CanvasValidationError('invalid', 'TEST_CODE');
    expect(validation).toMatchObject({ name: 'CanvasValidationError', code: 'TEST_CODE', message: 'invalid' });
    expect(new CanvasReadonlyError()).toMatchObject({ name: 'CanvasReadonlyError', message: 'The canvas is read-only' });
  });
});
