import rough from 'roughjs';
import type { Shape, CanvasState } from '../core/types';
import { PluginRegistry } from '../plugins/index';
import { renderGrid } from './GridRenderer';
import { renderWelcome, renderOverlays } from './OverlayRenderer';
import { renderShape } from './ShapeRenderer';
import { isShapeVisible } from '../geometry/Geometry';
import { clearElbowCache, setSkipObstacles } from '../geometry/lineUtils';

let staticCanvas: HTMLCanvasElement | null = null;
let isStaticValid = false;
let lastDragState = false;
let lastViewport = { x: 0, y: 0, zoom: 1 };
let lastEditingShapeId: string | null = null;
let lastShapesRef: Shape[] | null = null;

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

/** Call on canvas destroy to release the off-screen static canvas pixel buffer. */
export function clearRendererState() {
  if (staticCanvas) {
    staticCanvas.width = 0;
    staticCanvas.height = 0;
  }
  staticCanvas = null;
  isStaticValid = false;
  lastDragState = false;
  lastViewport = { x: 0, y: 0, zoom: 1 };
  lastEditingShapeId = null;
  lastShapesRef = null;
}

export function renderScene(canvas: HTMLCanvasElement, state: CanvasState): { total: number, rendered: number } {
  setSkipObstacles(state.isDraggingSelection || !!state.drawingShapeId);

  const activeToolPlugin = PluginRegistry.getPluginForTool(state.activeTool);
  const isBindingTool = !!(activeToolPlugin as any)?.canBind;
  const showPorts = isBindingTool ||
    (!state.drawingShapeId && state.selectedIds.some(id => {
      const s = state.shapes.find(x => x.id === id);
      return s && PluginRegistry.hasPlugin(s.type) && !!(PluginRegistry.getPlugin(s.type) as any).canBind;
    }));

  const ctx = canvas.getContext('2d');
  if (!ctx) return { total: 0, rendered: 0 };

  let renderedCount = 0;
  const totalCount = state.shapes.length;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    isStaticValid = false;
  }

  const rc = rough.canvas(canvas);

  if (lastViewport.x !== state.viewport.x || lastViewport.y !== state.viewport.y || lastViewport.zoom !== state.viewport.zoom) {
    isStaticValid = false; lastViewport = { ...state.viewport };
  }
  if (state.editingShapeId !== lastEditingShapeId) {
    isStaticValid = false; lastEditingShapeId = state.editingShapeId || null;
  }
  if (state.shapes !== lastShapesRef) {
    isStaticValid = false; lastShapesRef = state.shapes;
  }

  const isDrawnAction = state.isDraggingSelection || !!state.drawingShapeId;
  const dynamicIds = isDrawnAction ? getDynamicIds(state) : new Set(state.selectedIds);
  if (isDrawnAction && !lastDragState) isStaticValid = false;
  lastDragState = isDrawnAction;

  if (isDrawnAction) {
    if (!isStaticValid || !staticCanvas) {
      if (!staticCanvas) staticCanvas = document.createElement('canvas');
      staticCanvas.width = canvas.width; staticCanvas.height = canvas.height;
      const sCtx = staticCanvas.getContext('2d')!;
      sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sRc = rough.canvas(staticCanvas);

      sCtx.clearRect(0, 0, rect.width, rect.height);
      renderGrid(sCtx, state, rect.width, rect.height);
      if (!state.shapes.length) renderWelcome(staticCanvas, sCtx, state.theme);

      sCtx.save(); sCtx.translate(state.viewport.x, state.viewport.y); sCtx.scale(state.viewport.zoom, state.viewport.zoom);
      state.shapes.filter(s => !dynamicIds.has(s.id)).forEach((shape) => {
        if (isShapeVisible(shape, state.viewport, rect.width, rect.height)) {
          renderShape(sRc, sCtx, shape, false, false, state.shapes, shape.id === state.editingShapeId, false, showPorts, state.theme);
        }
      });
      sCtx.restore(); isStaticValid = true;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = state.theme === 'light' ? '#f8fafc' : '#131316';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticCanvas!, 0, 0, canvas.width, canvas.height);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save(); ctx.translate(state.viewport.x, state.viewport.y); ctx.scale(state.viewport.zoom, state.viewport.zoom);
    state.shapes.filter(s => dynamicIds.has(s.id)).forEach((shape) => {
      renderShape(rc, ctx, shape, state.selectedIds.includes(shape.id), false, state.shapes, shape.id === state.editingShapeId, shape.id === state.hoveredShapeId, showPorts, state.theme, shape.id === state.drawingShapeId);
      renderedCount++;
    });
  } else {
    isStaticValid = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = state.theme === 'light' ? '#f8fafc' : '#131316';
    ctx.fillRect(0, 0, rect.width, rect.height);
    renderGrid(ctx, state, rect.width, rect.height);
    if (!state.shapes.length) renderWelcome(canvas, ctx, state.theme);
    ctx.save(); ctx.translate(state.viewport.x, state.viewport.y); ctx.scale(state.viewport.zoom, state.viewport.zoom);
    state.shapes.forEach((shape) => {
      if (isShapeVisible(shape, state.viewport, rect.width, rect.height)) {
        const isErasing = state.erasingShapeIds?.includes(shape.id) || false;
        renderShape(rc, ctx, shape, state.selectedIds.includes(shape.id), isErasing, state.shapes, shape.id === state.editingShapeId, shape.id === state.hoveredShapeId, showPorts, state.theme, shape.id === state.drawingShapeId);
        renderedCount++;
      }
    });
  }

  renderOverlays(ctx, state);
  ctx.restore();
  return { total: totalCount, rendered: renderedCount };
}

