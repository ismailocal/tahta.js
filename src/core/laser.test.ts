import { describe, expect, it } from 'vitest';
import {
  LASER_TRAIL_LIFETIME_MS,
  MAX_LASER_TRAIL_POINTS,
  appendLaserPoint,
  hasVisibleLaserPoints,
  validateLaserTrail,
} from './laser';

describe('laser trail', () => {
  it('samples nearby movement and keeps a bounded trail', () => {
    const timestamp = 1_000;
    const first = appendLaserPoint([], { x: 0, y: 0 }, timestamp, 1);
    expect(appendLaserPoint(first, { x: 1, y: 0 }, timestamp + 1, 1)).toEqual(first);

    let points = first;
    for (let index = 1; index <= MAX_LASER_TRAIL_POINTS + 10; index += 1) {
      points = appendLaserPoint(points, { x: index * 3, y: 0 }, timestamp + index, 1);
    }
    expect(points).toHaveLength(MAX_LASER_TRAIL_POINTS);
    expect(points[0]?.x).toBeGreaterThan(0);
  });

  it('expires points deterministically and rejects unsafe awareness payloads', () => {
    const timestamp = 10_000;
    const points = [{ x: 1, y: 2, timestamp }];
    expect(hasVisibleLaserPoints(points, timestamp + LASER_TRAIL_LIFETIME_MS - 1)).toBe(true);
    expect(hasVisibleLaserPoints(points, timestamp + LASER_TRAIL_LIFETIME_MS)).toBe(false);
    expect(validateLaserTrail(points, timestamp)).toEqual(points);
    expect(() => validateLaserTrail([{ x: Number.NaN, y: 2, timestamp }], timestamp)).toThrow('invalid point');
    expect(() => validateLaserTrail([{ x: 1, y: 2, timestamp: timestamp + 5_001 }], timestamp)).toThrow('invalid point');
    expect(() => validateLaserTrail([
      { x: 1, y: 2, timestamp },
      { x: 2, y: 3, timestamp: timestamp - 1 },
    ], timestamp)).toThrow('out of order');
  });
});
