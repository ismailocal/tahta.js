import type { Shape, Point } from '../core/types';
import { getShapeBounds } from './Geometry';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersects(a: Bounds, b: Bounds): boolean {
  return a.x <= b.x + b.width
    && a.x + a.width >= b.x
    && a.y <= b.y + b.height
    && a.y + a.height >= b.y;
}

export class Quadtree {
  private shapes: { shape: Shape; bounds: Bounds }[] = [];
  private children: Quadtree[] = [];
  private maxShapes = 10;
  private depth = 0;
  private maxDepth = 5;

  private bounds: Bounds;

  constructor(bounds: Bounds, depth = 0) {
    this.bounds = bounds;
    this.depth = depth;
  }

  insert(shape: Shape, bounds: Bounds) {
    if (this.children.length > 0) {
      const index = this.getQuadrantIndex(bounds);
      if (index !== -1) {
        this.children[index].insert(shape, bounds);
        return;
      }
    }

    this.shapes.push({ shape, bounds });

    if (this.shapes.length > this.maxShapes && this.depth < this.maxDepth) {
      if (this.children.length === 0) {
        this.split();
      }

      let i = 0;
      while (i < this.shapes.length) {
        const item = this.shapes[i];
        const index = this.getQuadrantIndex(item.bounds);
        if (index !== -1) {
          this.children[index].insert(item.shape, item.bounds);
          this.shapes.splice(i, 1);
        } else {
          i++;
        }
      }
    }
  }

  private split() {
    const subW = this.bounds.width / 2;
    const subH = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;

    this.children = [
      new Quadtree({ x: x + subW, y: y, width: subW, height: subH }, this.depth + 1),
      new Quadtree({ x: x, y: y, width: subW, height: subH }, this.depth + 1),
      new Quadtree({ x: x, y: y + subH, width: subW, height: subH }, this.depth + 1),
      new Quadtree({ x: x + subW, y: y + subH, width: subW, height: subH }, this.depth + 1),
    ];
  }

  private getQuadrantIndex(bounds: Bounds): number {
    const midX = this.bounds.x + this.bounds.width / 2;
    const midY = this.bounds.y + this.bounds.height / 2;

    const top = bounds.y < midY && bounds.y + bounds.height < midY;
    const bottom = bounds.y > midY;
    const left = bounds.x < midX && bounds.x + bounds.width < midX;
    const right = bounds.x > midX;

    if (top) {
      if (right) return 0;
      if (left) return 1;
    } else if (bottom) {
      if (left) return 2;
      if (right) return 3;
    }

    return -1;
  }

  queryPoint(point: Point, results: Shape[] = []) {
    if (this.children.length > 0) {
      const index = this.getQuadrantIndex({ x: point.x, y: point.y, width: 0, height: 0 });
      if (index !== -1) {
        this.children[index].queryPoint(point, results);
      } else {
        // If the point is on a boundary, check all children
        this.children.forEach(child => child.queryPoint(point, results));
      }
    }

    for (const item of this.shapes) {
      if (
        point.x >= item.bounds.x &&
        point.x <= item.bounds.x + item.bounds.width &&
        point.y >= item.bounds.y &&
        point.y <= item.bounds.y + item.bounds.height
      ) {
        results.push(item.shape);
      }
    }

    return results;
  }

  queryBounds(bounds: Bounds, results: Shape[] = []): Shape[] {
    if (!intersects(this.bounds, bounds)) return results;
    for (const item of this.shapes) {
      if (intersects(item.bounds, bounds)) results.push(item.shape);
    }
    this.children.forEach(child => child.queryBounds(bounds, results));
    return results;
  }
}

export function createShapeSpatialIndex(shapes: Shape[]): Quadtree {
  const extent = shapes.reduce((acc, shape) => {
    const bounds = getShapeBounds(shape);
    return {
      x: Math.min(acc.x, bounds.x),
      y: Math.min(acc.y, bounds.y),
      x2: Math.max(acc.x2, bounds.x + bounds.width),
      y2: Math.max(acc.y2, bounds.y + bounds.height),
    };
  }, { x: -1000, y: -1000, x2: 2000, y2: 2000 });
  const tree = new Quadtree({
    x: extent.x - 100,
    y: extent.y - 100,
    width: extent.x2 - extent.x + 200,
    height: extent.y2 - extent.y + 200,
  });
  shapes.forEach(shape => tree.insert(shape, getShapeBounds(shape)));
  return tree;
}
