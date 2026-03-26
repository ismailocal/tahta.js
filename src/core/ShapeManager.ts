import type { Shape } from './types';

export class ShapeManager {
  private static ensureSorted(shapes: Shape[]): Shape[] {
    return [...shapes].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }

  static add(shapes: Shape[], shape: Shape): Shape[] {
    const maxZ = shapes.reduce((max, s) => Math.max(max, s.zIndex || 0), -1);
    const newShape = { ...shape, zIndex: maxZ + 1 };
    return this.ensureSorted([...shapes, newShape]);
  }

  static update(shapes: Shape[], shapeId: string, patch: Partial<Shape>, force = false): { shapes: Shape[], updated?: Shape } {
    let updated: Shape | undefined;
    const nextShapes = shapes.map((shape) => {
      if (shape.id !== shapeId) return shape;
      if (!force && shape.locked && patch.locked === undefined) return shape;
      updated = { ...shape, ...patch };
      return updated;
    });
    
    // If zIndex changed, we must re-sort
    const finalShapes = patch.zIndex !== undefined ? this.ensureSorted(nextShapes) : nextShapes;
    return { shapes: finalShapes, updated };
  }

  static replace(shapes: Shape[], shapeId: string, nextShape: Shape): Shape[] {
    const nextShapes = shapes.map((shape) => (shape.id === shapeId ? nextShape : shape));
    return this.ensureSorted(nextShapes);
  }

  static delete(shapes: Shape[], shapeId: string): Shape[] {
    const shape = shapes.find(s => s.id === shapeId);
    if (shape?.locked) return shapes;
    return shapes.filter((s) => s.id !== shapeId);
  }

  static reorder(shapes: Shape[], shapeId: string, direction: 'forward' | 'backward' | 'front' | 'back'): Shape[] {
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return shapes;
    
    // We assume incoming 'shapes' is already sorted
    const sorted = [...shapes];
    const index = sorted.findIndex(s => s.id === shapeId);
    if (index === -1) return shapes;

    if (direction === 'forward' && index < sorted.length - 1) {
      sorted[index] = sorted[index + 1];
      sorted[index + 1] = shape;
    } else if (direction === 'backward' && index > 0) {
      sorted[index] = sorted[index - 1];
      sorted[index - 1] = shape;
    } else if (direction === 'front') {
      sorted.splice(index, 1);
      sorted.push(shape);
    } else if (direction === 'back') {
      sorted.splice(index, 1);
      sorted.unshift(shape);
    }

    return sorted.map((s, i) => ({ ...s, zIndex: i }));
  }
}
