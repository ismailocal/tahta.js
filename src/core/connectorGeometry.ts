export interface ConnectorPoint { x: number; y: number }

export type ConnectorEdgeStyle = 'straight' | 'elbow' | 'curved';

export interface ConnectorRoute {
  kind: 'polyline' | 'quadratic';
  points: readonly ConnectorPoint[];
  control?: ConnectorPoint;
}

interface ConnectorBounds { x: number; y: number; width: number; height: number }
interface InflatedBounds { left: number; right: number; top: number; bottom: number }
interface RouteNode { xIndex: number; yIndex: number; direction: number; cost: number; parent: RouteNode | null }
const ROUTE_CLEARANCE = 20;
const ROUTE_DIRECTIONS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }] as const;

function routeExit(point: ConnectorPoint, bounds: ConnectorBounds | undefined, fallback: ConnectorPoint): ConnectorPoint {
  if (!bounds) return Math.abs(fallback.x - point.x) >= Math.abs(fallback.y - point.y) ? { x: fallback.x > point.x ? 1 : -1, y: 0 } : { x: 0, y: fallback.y > point.y ? 1 : -1 };
  const distances = [Math.abs(point.x - (bounds.x + bounds.width)), Math.abs(point.y - (bounds.y + bounds.height)), Math.abs(point.x - bounds.x), Math.abs(point.y - bounds.y)];
  const direction = distances.indexOf(Math.min(...distances)); return ROUTE_DIRECTIONS[direction]!;
}

function routeDirectionIndex(direction: ConnectorPoint): number { if (direction.x > 0) return 0; if (direction.y > 0) return 1; if (direction.x < 0) return 2; return 3; }
function inflateBounds(bounds: ConnectorBounds, padding: number): InflatedBounds { return { left: bounds.x - padding, right: bounds.x + bounds.width + padding, top: bounds.y - padding, bottom: bounds.y + bounds.height + padding }; }
function routeBlocked(start: ConnectorPoint, end: ConnectorPoint, bounds: readonly InflatedBounds[]): boolean { const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }; return bounds.some((value) => midpoint.x > value.left && midpoint.x < value.right && midpoint.y > value.top && midpoint.y < value.bottom); }
function collapseRoute(points: readonly ConnectorPoint[]): ConnectorPoint[] { const result: ConnectorPoint[] = []; points.forEach((point, index) => { const previous = result.at(-1); const next = points[index + 1]; if (previous && next && ((Math.abs(previous.x - point.x) < 0.5 && Math.abs(point.x - next.x) < 0.5) || (Math.abs(previous.y - point.y) < 0.5 && Math.abs(point.y - next.y) < 0.5))) return; result.push(point); }); return result; }

export function elbowPath(start: ConnectorPoint, end: ConnectorPoint, startBounds?: ConnectorBounds, endBounds?: ConnectorBounds): ConnectorPoint[] {
  const startDirection = routeExit(start, startBounds, end); const endDirection = endBounds ? routeExit(end, endBounds, start) : { x: -startDirection.x, y: -startDirection.y };
  const startExit = { x: start.x + startDirection.x * ROUTE_CLEARANCE, y: start.y + startDirection.y * ROUTE_CLEARANCE }; const endExit = { x: end.x + endDirection.x * ROUTE_CLEARANCE, y: end.y + endDirection.y * ROUTE_CLEARANCE };
  const blockedBounds = [startBounds, endBounds].filter((value): value is ConnectorBounds => Boolean(value)).map((value) => inflateBounds(value, ROUTE_CLEARANCE * 0.4));
  const xValues = new Set([startExit.x, endExit.x]); const yValues = new Set([startExit.y, endExit.y]);
  [startBounds, endBounds].forEach((bounds) => { if (!bounds) return; xValues.add(bounds.x - ROUTE_CLEARANCE); xValues.add(bounds.x + bounds.width + ROUTE_CLEARANCE); yValues.add(bounds.y - ROUTE_CLEARANCE); yValues.add(bounds.y + bounds.height + ROUTE_CLEARANCE); });
  const xs = [...xValues].sort((left, right) => left - right); const ys = [...yValues].sort((left, right) => left - right); const startX = xs.indexOf(startExit.x); const startY = ys.indexOf(startExit.y); const endX = xs.indexOf(endExit.x); const endY = ys.indexOf(endExit.y);
  const scores = Array.from({ length: xs.length }, () => Array.from({ length: ys.length }, () => new Array<number>(4).fill(Number.POSITIVE_INFINITY))); const bendCost = Math.max((Math.abs(startExit.x - endExit.x) + Math.abs(startExit.y - endExit.y)) ** 2, 1); const startDirectionIndex = routeDirectionIndex(startDirection);
  const open: RouteNode[] = [{ xIndex: startX, yIndex: startY, direction: startDirectionIndex, cost: 0, parent: null }]; scores[startX]![startY]![startDirectionIndex] = 0; let found: RouteNode | null = null;
  while (open.length) {
    const current = open.shift()!; if (current.cost > scores[current.xIndex]![current.yIndex]![current.direction]!) continue; if (current.xIndex === endX && current.yIndex === endY) { found = current; break; }
    ROUTE_DIRECTIONS.forEach((direction, directionIndex) => {
      const nextX = current.xIndex + direction.x; const nextY = current.yIndex + direction.y; if (nextX < 0 || nextX >= xs.length || nextY < 0 || nextY >= ys.length || directionIndex === (current.direction + 2) % 4) return;
      const from = { x: xs[current.xIndex]!, y: ys[current.yIndex]! }; const to = { x: xs[nextX]!, y: ys[nextY]! }; if (routeBlocked(from, to, blockedBounds)) return;
      const cost = current.cost + Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + (directionIndex === current.direction ? 0 : bendCost); if (cost >= scores[nextX]![nextY]![directionIndex]!) return;
      scores[nextX]![nextY]![directionIndex] = cost; const node = { xIndex: nextX, yIndex: nextY, direction: directionIndex, cost, parent: current }; const heuristic = (value: RouteNode) => value.cost + Math.abs(xs[value.xIndex]! - endExit.x) + Math.abs(ys[value.yIndex]! - endExit.y); let index = 0; while (index < open.length && heuristic(open[index]!) <= heuristic(node)) index++; open.splice(index, 0, node);
    });
  }
  if (!found) return collapseRoute([start, startExit, endExit, end]); const route: ConnectorPoint[] = []; for (let current: RouteNode | null = found; current; current = current.parent) route.push({ x: xs[current.xIndex]!, y: ys[current.yIndex]! }); return collapseRoute([start, ...route.reverse(), end]);
}

export function curvedControlPoint(start: ConnectorPoint, end: ConnectorPoint): ConnectorPoint {
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = length * 0.35;
  return { x: midpoint.x - (dy / length) * offset, y: midpoint.y + (dx / length) * offset };
}

export function connectorRoute(points: readonly ConnectorPoint[], edgeStyle: ConnectorEdgeStyle): ConnectorRoute {
  if (points.length < 2) return { kind: 'polyline', points };
  if (points.length > 2 || edgeStyle === 'straight') return { kind: 'polyline', points };
  const start = points[0]!;
  const end = points[1]!;
  if (edgeStyle === 'curved') return { kind: 'quadratic', points: [start, end], control: curvedControlPoint(start, end) };
  return { kind: 'polyline', points: elbowPath(start, end) };
}

export function pointToSegmentDistance(point: ConnectorPoint, start: ConnectorPoint, end: ConnectorPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}

export function pointToConnectorDistance(point: ConnectorPoint, route: ConnectorRoute): number {
  if (route.kind === 'quadratic' && route.control && route.points.length === 2) {
    let minimum = Number.POSITIVE_INFINITY;
    let previous = route.points[0]!;
    for (let step = 1; step <= 32; step++) {
      const t = step / 32;
      const inverse = 1 - t;
      const current = {
        x: inverse * inverse * route.points[0]!.x + 2 * inverse * t * route.control.x + t * t * route.points[1]!.x,
        y: inverse * inverse * route.points[0]!.y + 2 * inverse * t * route.control.y + t * t * route.points[1]!.y,
      };
      minimum = Math.min(minimum, pointToSegmentDistance(point, previous, current));
      previous = current;
    }
    return minimum;
  }
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.points.length; index++) minimum = Math.min(minimum, pointToSegmentDistance(point, route.points[index - 1]!, route.points[index]!));
  return minimum;
}

export function connectorRouteBounds(route: ConnectorRoute): { x: number; y: number; width: number; height: number } {
  const points = route.control ? [...route.points, route.control] : [...route.points];
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

export function connectorRouteMidpoint(route: ConnectorRoute): ConnectorPoint {
  if (route.kind === 'quadratic' && route.control) {
    return {
      x: route.points[0]!.x * 0.25 + route.control.x * 0.5 + route.points[1]!.x * 0.25,
      y: route.points[0]!.y * 0.25 + route.control.y * 0.5 + route.points[1]!.y * 0.25,
    };
  }
  const lengths = route.points.slice(1).map((point, index) => Math.hypot(point.x - route.points[index]!.x, point.y - route.points[index]!.y));
  const half = lengths.reduce((sum, length) => sum + length, 0) / 2;
  let travelled = 0;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]!;
    if (travelled + length >= half) {
      const ratio = length ? (half - travelled) / length : 0;
      const start = route.points[index]!;
      const end = route.points[index + 1]!;
      return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
    }
    travelled += length;
  }
  return route.points.at(-1) ?? { x: 0, y: 0 };
}

export function connectorRouteSvgPath(route: ConnectorRoute): string {
  if (!route.points.length) return '';
  if (route.kind === 'quadratic' && route.control) return `M ${route.points[0]!.x} ${route.points[0]!.y} Q ${route.control.x} ${route.control.y} ${route.points[1]!.x} ${route.points[1]!.y}`;
  return route.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
}
