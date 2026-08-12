import { describe, expect, it } from 'vitest';
import {
  LASER_TRAIL_LIFETIME_MS,
  MAX_LASER_TRAIL_POINTS,
  appendLaserPoint,
  hasVisibleLaserPoints,
  removeExpiredLaserPoints,
  validateLaserTrail,
} from './laser';

describe('laser trail', () => {
  it('samples nearby movement and keeps a bounded trail', () => {
    const timestamp = 1_000;
    const first = appendLaserPoint([], { x: 0, y: 0 }, timestamp, 1, 0);
    expect(appendLaserPoint(first, { x: 1, y: 0 }, timestamp + 1, 1, 0)).toBe(first);

    let points = first;
    for (let index = 1; index <= MAX_LASER_TRAIL_POINTS + 10; index += 1) {
      const previous = points;
      points = appendLaserPoint(points, { x: index * 3, y: 0 }, timestamp + index, 1, 0);
      expect(points).not.toBe(previous);
    }
    expect(points).toHaveLength(MAX_LASER_TRAIL_POINTS);
    expect(points[0]?.x).toBeGreaterThan(0);
  });

  it('expires points deterministically and rejects unsafe awareness payloads', () => {
    const timestamp = 10_000;
    const points = [{ x: 1, y: 2, timestamp, strokeId: 0 }];
    expect(hasVisibleLaserPoints(points, timestamp + LASER_TRAIL_LIFETIME_MS - 1)).toBe(true);
    expect(hasVisibleLaserPoints(points, timestamp + LASER_TRAIL_LIFETIME_MS)).toBe(false);
    expect(validateLaserTrail(points, timestamp)).toEqual(points);
    expect(removeExpiredLaserPoints(points, timestamp + LASER_TRAIL_LIFETIME_MS)).toEqual([]);
    expect(() => validateLaserTrail([{ x: Number.NaN, y: 2, timestamp, strokeId: 0 }], timestamp)).toThrow('invalid point');
    expect(() => validateLaserTrail([{ x: 1, y: 2, timestamp: timestamp + 5_001, strokeId: 0 }], timestamp)).toThrow('invalid point');
    expect(() => validateLaserTrail([{ x: 1, y: 2, timestamp, strokeId: -1 }], timestamp)).toThrow('invalid point');
    expect(() => validateLaserTrail([
      { x: 1, y: 2, timestamp, strokeId: 0 },
      { x: 2, y: 3, timestamp: timestamp - 1, strokeId: 0 },
    ], timestamp)).toThrow('out of order');
  });
});
