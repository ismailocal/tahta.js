/** Open string type — no core change needed to add new shape types. */
export type ShapeType = string & { readonly __brand: 'ShapeType' };
export type ArrowheadStyle = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'bar';

export interface Point {
  x: number;
  y: number;
}

/** A named connection port on a shape (e.g. a table row for DB diagrams). */
export interface ConnectionPoint {
  id: string;
  x: number; // world coords
  y: number;
  label?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/** Binding from a connector endpoint to a target shape, optionally to a named port. */
export interface ShapeBinding {
  elementId: string;
  portId?: string;
  /** Click position relative to the bound shape's origin (shape.x / shape.y). Preserved on move. */
  offsetX?: number;
  offsetY?: number;
  /** Normalized attachment point (0..1) relative to the bound shape's bounding box. Used for floating ports. */
  normalX?: number;
  normalY?: number;
}

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  seed?: number;
  width?: number;
  height?: number;
  points?: Point[];
  text?: string;
  imageSrc?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  roughness?: number;
  fillStyle?: string;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  edgeStyle?: 'straight' | 'elbow' | 'curved';
  startArrowhead?: ArrowheadStyle;
  endArrowhead?: ArrowheadStyle;
  roundness?: 'sharp' | 'round';
  zIndex?: number;
  startBinding?: ShapeBinding;
  endBinding?: ShapeBinding;
  groupId?: string;
  locked?: boolean;
  /** Type-specific data payload for custom plugins. */
  data?: Record<string, unknown>;
  /** Text layout */
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  textVerticalAlign?: 'top' | 'middle' | 'bottom';
  textPaddingX?: number;
  textPaddingY?: number;
  /** 'wrap' clips to shape bounds and wraps; 'clip' clips without wrapping; 'overflow' allows overflow (default) */
  textOverflow?: 'wrap' | 'clip' | 'overflow';
}

export interface CanvasState {
  shapes: Shape[];
  selectedIds: string[];
  activeTool: string;
  viewport: { x: number; y: number; zoom: number };
  userToFollow?: { socketId: string; username: string } | null;
  collaborators?: Map<string, any>;
  hoveredShapeId: string | null;
  hoveredPortShapeId?: string | null;
  hoveredPortId?: string | null;
  drawingShapeId: string | null;
  isDraggingSelection: boolean;
  isPanning: boolean;
  isSpacePanning: boolean;
  showGrid?: boolean;
  gridSize?: number;
  selectionBox?: { x: number; y: number; width: number; height: number } | null;
  erasingPath?: Point[] | null;
  erasingShapeIds?: string[];
  editingShapeId?: string | null;
  snapLines?: { x1: number; y1: number; x2: number; y2: number }[];
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  version: number;
}

export interface PointerPayload {
  nativeEvent: PointerEvent;
  screen: Point;
  world: Point;
  button: number;
  pointerId: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface ICanvasAPI {
  bus: any;
  getState: () => CanvasState;
  setState: (updater: Partial<CanvasState> | ((state: CanvasState) => CanvasState), forceVersion?: number) => void;
  addShape: (shape: Shape) => void;
  updateShape: (id: string, patch: Partial<Shape>, force?: boolean) => void;
  replaceShape: (id: string, shape: Shape) => void;
  deleteShape: (id: string) => void;
  setSelection: (ids: string[]) => void;
  setViewport: (viewport: CanvasState['viewport']) => void;
  setTool: (tool: string, keepSelection?: boolean) => void;
  reorderShape: (id: string, direction: 'forward' | 'backward' | 'front' | 'back') => void;
  commitState: () => void;
  undo: () => void;
  redo: () => void;
  batchUpdate: (fn: () => void) => void;
  getSpatialIndex: () => any;
  scrollToContent: () => void;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe: (fn: (state: CanvasState) => void) => () => void;
}

export interface ToolDefinition {
  onPointerDown?: (payload: PointerPayload, api: ICanvasAPI) => void;
  onPointerMove?: (payload: PointerPayload, api: ICanvasAPI) => void;
  onPointerUp?: (payload: PointerPayload, api: ICanvasAPI) => void;
  onKeyDown?: (event: KeyboardEvent, api: ICanvasAPI) => void;
  onDoubleClick?: (payload: PointerPayload, api: ICanvasAPI) => void;
}
