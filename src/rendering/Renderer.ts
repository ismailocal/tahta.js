import rough from 'roughjs';
import type { Shape, CanvasState } from '../core/types';
import { PluginRegistry } from '../plugins/index';
import { renderGrid } from './GridRenderer';
import { renderWelcome, renderOverlays } from './OverlayRenderer';
import { renderShape } from './ShapeRenderer';
import { RENDERING_CONSTANTS } from './RenderingConstants';
import { createShapeSpatialIndex, type Quadtree } from '../geometry/SpatialIndex';

interface RendererState {
  staticCanvas: HTMLCanvasElement | null;
  isStaticValid: boolean;
  lastDragState: boolean;
  lastViewport: { x: number; y: number; zoom: number };
  lastEditingShapeId: string | null;
  lastShapesRef: Shape[] | null;
  lastTheme: string | null;
  lastGen: number;
  spatialIndex: Quadtree | null;
  shapeOrder: Map<string, number>;
}

const rendererStateMap = new WeakMap<HTMLCanvasElement, RendererState>();

// Cache rough.canvas() instances per canvas element to avoid per-frame allocation
const roughCanvasCache = new WeakMap<HTMLCanvasElement, ReturnType<typeof rough.canvas>>();
function getRoughCanvas(canvas: HTMLCanvasElement): ReturnType<typeof rough.canvas> {
  let rc = roughCanvasCache.get(canvas);
  if (!rc) {
    rc = rough.canvas(canvas);
    roughCanvasCache.set(canvas, rc);
  }
  return rc;
}

function getRendererState(canvas: HTMLCanvasElement): RendererState {
  if (!rendererStateMap.has(canvas)) {
    rendererStateMap.set(canvas, {
      staticCanvas: null,
      isStaticValid: false,
      lastDragState: false,
      lastViewport: { x: 0, y: 0, zoom: 1 },
      lastEditingShapeId: null,
      lastShapesRef: null,
      lastTheme: null,
      lastGen: 0,
      spatialIndex: null,
      shapeOrder: new Map(),
    });
  }
  return rendererStateMap.get(canvas)!;
}

function setupCanvas(canvas: HTMLCanvasElement, rs: RendererState, rect: DOMRect, dpr: number): boolean {
  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);

  if (rs.lastGen !== currentGen) {
    rs.isStaticValid = false;
    rs.lastGen = currentGen;
  }

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    rs.isStaticValid = false;
    return true;
  }
  return false;
}

function shouldInvalidateStatic(state: CanvasState, rs: RendererState): boolean {
  if (rs.lastViewport.x !== state.viewport.x || rs.lastViewport.y !== state.viewport.y || rs.lastViewport.zoom !== state.viewport.zoom) {
    rs.isStaticValid = false;
    rs.lastViewport = { ...state.viewport };
  }
  if (state.editingShapeId !== rs.lastEditingShapeId) {
    rs.isStaticValid = false;
    rs.lastEditingShapeId = state.editingShapeId || null;
  }
  if (state.shapes !== rs.lastShapesRef) {
    rs.isStaticValid = false;
    rs.lastShapesRef = state.shapes;
  }
  return rs.isStaticValid;
}

function renderStaticLayer(
  rs: RendererState,
  canvas: HTMLCanvasElement,
  state: CanvasState,
  rect: DOMRect,
  dpr: number,
  dynamicIds: Set<string>,
  showPorts: boolean,
  visibleShapes: Shape[],
): void {
  if (!rs.isStaticValid || !rs.staticCanvas) {
    if (!rs.staticCanvas) rs.staticCanvas = document.createElement('canvas');
    rs.staticCanvas.width = canvas.width;
    rs.staticCanvas.height = canvas.height;
    const sCtx = rs.staticCanvas.getContext('2d')!;
    sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sRc = rough.canvas(rs.staticCanvas);

    sCtx.clearRect(0, 0, rect.width, rect.height);
    renderGrid(sCtx, state, rect.width, rect.height);
    if (!state.shapes.length) renderWelcome(rs.staticCanvas, sCtx, state.theme);

    sCtx.save();
    sCtx.translate(state.viewport.x, state.viewport.y);
    sCtx.scale(state.viewport.zoom, state.viewport.zoom);
    visibleShapes.filter(s => !dynamicIds.has(s.id)).forEach((shape) => {
        const activePortId = shape.id === state.hoveredPortShapeId ? state.hoveredPortId : null;
        renderShape(sRc, sCtx, shape, state.shapes, {
          isSelected: false,
          isErasing: false,
          isEditingText: shape.id === state.editingShapeId,
          isHovered: false,
          showPorts,
          theme: state.theme || 'light',
          isDrawing: false,
          activePortId
        });
    });
    sCtx.restore();
    rs.isStaticValid = true;
  }
}

function renderDynamicLayer(
  rc: ReturnType<typeof rough.canvas>,
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  rect: DOMRect,
  dpr: number,
  dynamicIds: Set<string>,
  showPorts: boolean,
  visibleShapes: Shape[],
): number {
  let renderedCount = 0;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.translate(state.viewport.x, state.viewport.y);
  ctx.scale(state.viewport.zoom, state.viewport.zoom);
  visibleShapes.filter(s => dynamicIds.has(s.id)).forEach((shape) => {
    const activePortId = shape.id === state.hoveredPortShapeId ? state.hoveredPortId : null;
    renderShape(rc, ctx, shape, state.shapes, {
      isSelected: state.selectedIds.includes(shape.id),
      isErasing: false,
      isEditingText: shape.id === state.editingShapeId,
      isHovered: shape.id === state.hoveredShapeId,
      showPorts,
      theme: state.theme || 'light',
      isDrawing: shape.id === state.drawingShapeId,
      activePortId
    });
    renderedCount++;
  });
  return renderedCount;
}

function renderFullScene(
  rc: ReturnType<typeof rough.canvas>,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: CanvasState,
  rect: DOMRect,
  dpr: number,
  showPorts: boolean,
  visibleShapes: Shape[],
): number {
  let renderedCount = 0;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = state.canvasBackground || (state.theme === 'light' ? RENDERING_CONSTANTS.THEME_LIGHT_BG : RENDERING_CONSTANTS.THEME_DARK_BG);
  ctx.fillRect(0, 0, rect.width, rect.height);
  renderGrid(ctx, state, rect.width, rect.height);
  if (!state.shapes.length) renderWelcome(canvas, ctx, state.theme);
  ctx.save();
  ctx.translate(state.viewport.x, state.viewport.y);
  ctx.scale(state.viewport.zoom, state.viewport.zoom);
  visibleShapes.forEach((shape) => {
      const isErasing = state.erasingShapeIds?.includes(shape.id) || false;
      const activePortId = shape.id === state.hoveredPortShapeId ? state.hoveredPortId : null;
      renderShape(rc, ctx, shape, state.shapes, {
        isSelected: state.selectedIds.includes(shape.id),
        isErasing,
        isEditingText: shape.id === state.editingShapeId,
        isHovered: shape.id === state.hoveredShapeId,
        showPorts,
        theme: state.theme || 'light',
        isDrawing: shape.id === state.drawingShapeId,
        activePortId
      });
      renderedCount++;
  });
  return renderedCount;
}

function getDynamicIds(state: CanvasState): Set<string> {
  const dynamicIds = new Set(state.selectedIds);
  if (state.drawingShapeId) dynamicIds.add(state.drawingShapeId);
  if (state.hoveredShapeId) dynamicIds.add(state.hoveredShapeId);

  // Perform a small number of passes to collect connected shapes and connectors
  // Usually 2 passes is enough: Connector -> Shape, Shape -> Connector
  for (let pass = 0; pass < 2; pass++) {
    let added = false;
    for (const s of state.shapes) {
      if (dynamicIds.has(s.id)) continue;
      if (PluginRegistry.hasPlugin(s.type) && PluginRegistry.getPlugin(s.type).isConnector) {
        // If shape is dynamic, its connectors should be dynamic
        if ((s.startBinding && dynamicIds.has(s.startBinding.elementId)) ||
            (s.endBinding && dynamicIds.has(s.endBinding.elementId))) {
          dynamicIds.add(s.id);
          added = true;
        }
        // If connector is dynamic, its bound shapes should be dynamic
        if (dynamicIds.has(s.id)) { // Re-check after possible addition above
          if (s.startBinding) dynamicIds.add(s.startBinding.elementId);
          if (s.endBinding) dynamicIds.add(s.endBinding.elementId);
          added = true;
        }
      }
    }
    if (!added) break;
  }
  return dynamicIds;
}

function getVisibleShapes(state: CanvasState, rect: DOMRect, rs: RendererState): Shape[] {
  if (!rs.spatialIndex || rs.lastShapesRef !== state.shapes) {
    rs.spatialIndex = createShapeSpatialIndex(state.shapes);
    rs.shapeOrder = new Map(state.shapes.map((shape, index) => [shape.id, index]));
  }
  const zoom = state.viewport.zoom || 1;
  const overscan = 100 / zoom;
  const visible = rs.spatialIndex.queryBounds({
    x: -state.viewport.x / zoom - overscan,
    y: -state.viewport.y / zoom - overscan,
    width: rect.width / zoom + overscan * 2,
    height: rect.height / zoom + overscan * 2,
  });
  visible.sort((a, b) => (rs.shapeOrder.get(a.id) ?? 0) - (rs.shapeOrder.get(b.id) ?? 0));
  return visible;
}

/** Call on canvas destroy to release the off-screen static canvas pixel buffer. */
let currentGen = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('tuval-force-render', () => {
    currentGen++;
  });
}

export function clearRendererState(canvas?: HTMLCanvasElement) {
  if (canvas) {
    const rs = rendererStateMap.get(canvas);
    if (rs?.staticCanvas) {
      rs.staticCanvas.width = 0;
      rs.staticCanvas.height = 0;
    }
    rendererStateMap.delete(canvas);
    roughCanvasCache.delete(canvas);
  }
}

export function renderScene(canvas: HTMLCanvasElement, state: CanvasState): { total: number, rendered: number } {
  const rs = getRendererState(canvas);

  const activeToolPlugin = PluginRegistry.getPluginForTool(state.activeTool);
  const isBindingTool = !!activeToolPlugin?.canBind;
  const showPorts = isBindingTool ||
    (!state.drawingShapeId && state.selectedIds.some(id => {
      const s = state.shapes.find(x => x.id === id);
      return s && PluginRegistry.hasPlugin(s.type) && !!PluginRegistry.getPlugin(s.type).canBind;
    }));

  const ctx = canvas.getContext('2d');
  if (!ctx) return { total: 0, rendered: 0 };

  const totalCount = state.shapes.length;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const visibleShapes = getVisibleShapes(state, rect, rs);

  setupCanvas(canvas, rs, rect, dpr);
  shouldInvalidateStatic(state, rs);

  const rc = getRoughCanvas(canvas);

  const isDrawnAction = state.isDraggingSelection || !!state.drawingShapeId;
  const dynamicIds = isDrawnAction ? getDynamicIds(state) : new Set(state.selectedIds);
  if (state.hoveredPortShapeId) dynamicIds.add(state.hoveredPortShapeId);
  if (isDrawnAction && !rs.lastDragState) rs.isStaticValid = false;
  rs.lastDragState = isDrawnAction;

  let renderedCount: number;
  if (isDrawnAction) {
    renderStaticLayer(rs, canvas, state, rect, dpr, dynamicIds, showPorts, visibleShapes);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = state.canvasBackground || (state.theme === 'light' ? RENDERING_CONSTANTS.THEME_LIGHT_BG : RENDERING_CONSTANTS.THEME_DARK_BG);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(rs.staticCanvas!, 0, 0, canvas.width, canvas.height);

    renderedCount = renderDynamicLayer(rc, ctx, state, rect, dpr, dynamicIds, showPorts, visibleShapes);
  } else {
    renderedCount = renderFullScene(rc, ctx, canvas, state, rect, dpr, showPorts, visibleShapes);
  }

  renderOverlays(ctx, state);
  ctx.restore();
  return { total: totalCount, rendered: renderedCount };
}
