export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'text' | 'image';
export type ArrowheadStyle = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'bar';

export interface Point {
  x: number;
  y: number;
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
  startBinding?: { elementId: string };
  endBinding?: { elementId: string };
  groupId?: string;
  locked?: boolean;
}

export interface CanvasState {
  shapes: Shape[];
  selectedIds: string[];
  activeTool: string;
  viewport: { x: number; y: number; zoom: number };
  hoveredShapeId: string | null;
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
  getState: () => CanvasState;
  setState: (updater: Partial<CanvasState> | ((state: CanvasState) => CanvasState)) => void;
  addShape: (shape: Shape) => void;
  updateShape: (id: string, patch: Partial<Shape>, force?: boolean) => void;
  replaceShape: (id: string, shape: Shape) => void;
  deleteShape: (id: string) => void;
  setSelection: (ids: string[]) => void;
  setViewport: (viewport: CanvasState['viewport']) => void;
  setTool: (tool: string) => void;
  reorderShape: (id: string, direction: 'forward' | 'backward' | 'front' | 'back') => void;
  commitState: () => void;
  undo: () => void;
  redo: () => void;
  batchUpdate: (fn: () => void) => void;
  getSpatialIndex: () => any; // Use any to avoid circular import if needed, or import from SpatialIndex
}

export interface ToolDefinition {
  onPointerDown?: (payload: PointerPayload, api: ICanvasAPI) => void;
  onPointerMove?: (payload: PointerPayload, api: ICanvasAPI) => void;
  onPointerUp?: (payload: PointerPayload, api: ICanvasAPI) => void;
  onKeyDown?: (event: KeyboardEvent, api: ICanvasAPI) => void;
  onDoubleClick?: (payload: PointerPayload, api: ICanvasAPI) => void;
}
