export interface LaserPoint {
  x: number;
  y: number;
  timestamp: number;
  strokeId: number;
}

export const LASER_TRAIL_LIFETIME_MS = 1_600;
export const MAX_LASER_TRAIL_POINTS = 96;
const MIN_LASER_POINT_DISTANCE_PX = 2;

export function appendLaserPoint(
  points: LaserPoint[],
  point: { x: number; y: number },
  timestamp: number,
  zoom: number,
  strokeId: number,
): LaserPoint[] {
  if (
    !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || !Number.isFinite(timestamp)
    || !Number.isSafeInteger(strokeId)
    || strokeId < 0
  ) {
    throw new Error('Laser point must contain finite coordinates, timestamp and stroke ID');
  }
  const last = points.at(-1);
  const minimumWorldDistance = MIN_LASER_POINT_DISTANCE_PX / Math.max(zoom, 0.05);
  if (last?.strokeId === strokeId && Math.hypot(point.x - last.x, point.y - last.y) < minimumWorldDistance) {
    return points;
  }
  const next = [...points, { x: point.x, y: point.y, timestamp, strokeId }];
  return next.length > MAX_LASER_TRAIL_POINTS
    ? next.slice(next.length - MAX_LASER_TRAIL_POINTS)
    : next;
}

export function removeExpiredLaserPoints(points: readonly LaserPoint[], timestamp = Date.now()): LaserPoint[] {
  return points.filter((point) => timestamp - point.timestamp < LASER_TRAIL_LIFETIME_MS);
}

export function hasVisibleLaserPoints(points: readonly LaserPoint[], timestamp = Date.now()): boolean {
  return points.some((point) => timestamp - point.timestamp < LASER_TRAIL_LIFETIME_MS);
}

export function validateLaserTrail(value: unknown, timestamp = Date.now()): readonly LaserPoint[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_LASER_TRAIL_POINTS) {
    throw new Error('Laser trail exceeds its point limit');
  }
  const maximumFutureTimestamp = timestamp + 5_000;
  let previousTimestamp = -1;
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('Laser trail contains an invalid point');
    const point = candidate as { x?: unknown; y?: unknown; timestamp?: unknown; strokeId?: unknown };
    if (
      typeof point.x !== 'number' || !Number.isFinite(point.x)
      || typeof point.y !== 'number' || !Number.isFinite(point.y)
      || typeof point.timestamp !== 'number' || !Number.isFinite(point.timestamp)
      || point.timestamp < 0 || point.timestamp > maximumFutureTimestamp
      || typeof point.strokeId !== 'number' || !Number.isSafeInteger(point.strokeId) || point.strokeId < 0
    ) {
      throw new Error('Laser trail contains an invalid point');
    }
    const normalizedTimestamp = Math.min(point.timestamp, timestamp);
    if (normalizedTimestamp < previousTimestamp) throw new Error('Laser trail points are out of order');
    previousTimestamp = normalizedTimestamp;
    return { x: point.x, y: point.y, timestamp: normalizedTimestamp, strokeId: point.strokeId };
  });
}
