import type { ICanvasAPI, Shape, PointerPayload, Point, ConnectionPoint } from '../core/types';

export interface IShapePlugin {
  type: string;

  /**
   * True if this shape acts as a connector (line / arrow).
   * Affects: drag-binding detection, text-label background mask.
   */
  isConnector?: boolean;

  /** Default style applied when this shape type is created. */
  defaultStyle?: Partial<Shape>;

  /** Property panel keys shown when this shape type is selected. */
  defaultProperties?: string[];

  // 1. Rendering
  render(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean, isErasing: boolean, allShapes: Shape[]): void;
  renderSelection?(ctx: CanvasRenderingContext2D, shape: Shape, allShapes: Shape[]): void;

  // 2. Geometry
  getBounds(shape: Shape): { x: number, y: number, width: number, height: number };
  getHandleAtPoint(shape: Shape, point: Point, allShapes: Shape[]): string | null;
  isPointInside(point: Point, shape: Shape, allShapes: Shape[]): boolean;

  /**
   * World-space anchor for the shape's text label.
   * Return null to fall back to bounds center.
   * Connector shapes return their path midpoint here.
   */
  getTextAnchor?(shape: Shape, allShapes: Shape[]): Point | null;

  /**
   * Named connection ports exposed by this shape.
   * Arrows can bind to a port via startBinding.portId / endBinding.portId.
   * Used for DB table shapes where each row is a connectable port.
   */
  getConnectionPoints?(shape: Shape): ConnectionPoint[];

  // 3. Interactions: Creation
  onDrawInit?(payload: PointerPayload, allShapes: Shape[], api: ICanvasAPI): Partial<Shape>;
  onDrawUpdate?(shape: Shape, payload: PointerPayload, dragStart: Point, allShapes: Shape[], api: ICanvasAPI): Partial<Shape>;

  // 4. Interactions: Handle Dragging
  onDragHandle?(shape: Shape, handle: string, payload: PointerPayload, dragStart: Point): Partial<Shape>;

  // 5. Binding Mechanics
  onDragBindHandle?(shape: Shape, handle: string, payload: PointerPayload, allShapes: Shape[], activeShapeId: string, api: ICanvasAPI): Partial<Shape>;
  onBoundShapeChange?(shape: Shape, allShapes: Shape[], changedShapeIds: string[]): Partial<Shape> | null;
}
