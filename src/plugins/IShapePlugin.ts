import type { Shape, PointerPayload, Point } from '../core/types';

export interface IShapePlugin {
  type: string;
  
  // 1. Rendering
  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean, isErasing: boolean, allShapes: Shape[]): void;
  renderSelection?(ctx: CanvasRenderingContext2D, shape: Shape, allShapes: Shape[]): void;
  
  // 2. Geometry
  getBounds(shape: Shape): { x: number, y: number, width: number, height: number };
  getHandleAtPoint(shape: Shape, point: Point, allShapes: Shape[]): string | null;
  isPointInside(point: Point, shape: Shape, allShapes: Shape[]): boolean;
  
  // 3. Interactions: Creation
  onDrawInit?(payload: PointerPayload, allShapes: Shape[], api: any): Partial<Shape>;
  onDrawUpdate?(shape: Shape, payload: PointerPayload, dragStart: Point, allShapes: Shape[], api: any): Partial<Shape>;
  
  // 4. Interactions: Handle Dragging
  // Returns the patch to apply to the shape mathematically
  onDragHandle?(shape: Shape, handle: string, payload: PointerPayload, dragStart: Point): Partial<Shape>;

  // 5. Binding Mechanics
  onDragBindHandle?(shape: Shape, handle: string, payload: PointerPayload, allShapes: Shape[], activeShapeId: string, api: any): Partial<Shape>;
  onBoundShapeChange?(shape: Shape, allShapes: Shape[], changedShapeIds: string[]): Partial<Shape> | null;
}
