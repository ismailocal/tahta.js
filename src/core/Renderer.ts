import rough from 'roughjs';
import type { Shape, CanvasState } from './types';
import { PluginRegistry } from '../plugins/index';
import { renderGrid } from './GridRenderer';
import { renderWelcome, renderOverlays } from './OverlayRenderer';
import { renderShape } from './ShapeRenderer';
import { isShapeVisible } from './Geometry';
import { clearElbowCache, setSkipObstacles } from './lineUtils';



let staticCanvas: HTMLCanvasElement | null = null;
let isStaticValid = false;
let lastDragState = false;
let lastViewport = { x: 0, y: 0, zoom: 1 };
let lastEditingShapeId: string | null = null;

export function renderScene(canvas: HTMLCanvasElement, state: CanvasState) {
  // clearElbowCache(); // DISABLED: Clearing cache every frame makes it useless. Rely on the robust cache key instead.
  setSkipObstacles(state.isDraggingSelection || !!state.drawingShapeId);

  const activeToolPlugin = PluginRegistry.getPluginForTool(state.activeTool);
  const isBindingTool = !!(activeToolPlugin as any)?.canBind;
  const showPorts = isBindingTool ||
    (!state.drawingShapeId && state.selectedIds.some(id => {
      const s = state.shapes.find(x => x.id === id);
      return s && PluginRegistry.hasPlugin(s.type) && !!(PluginRegistry.getPlugin(s.type) as any).canBind;
    }));

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

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

  const viewportChanged = lastViewport.x !== state.viewport.x || lastViewport.y !== state.viewport.y || lastViewport.zoom !== state.viewport.zoom;
  if (viewportChanged) isStaticValid = false;
  lastViewport = { ...state.viewport };

  if (state.editingShapeId !== lastEditingShapeId) {
    isStaticValid = false;
    lastEditingShapeId = state.editingShapeId || null;
  }

  if (state.isDraggingSelection) {
    const dynamicIds = new Set(state.selectedIds);
    state.shapes.forEach(s => {
      if (PluginRegistry.hasPlugin(s.type) && PluginRegistry.getPlugin(s.type).isConnector) {
        if ((s.startBinding && dynamicIds.has(s.startBinding.elementId)) ||
            (s.endBinding && dynamicIds.has(s.endBinding.elementId))) {
          dynamicIds.add(s.id);
        }
      }
    });
    // Hovered shape must be dynamic so it re-renders with isHovered=true (shows ports)
    if (state.hoveredShapeId) dynamicIds.add(state.hoveredShapeId);

    if (!lastDragState || !isStaticValid) {
      if (!staticCanvas) staticCanvas = document.createElement('canvas');
      staticCanvas.width = canvas.width;
      staticCanvas.height = canvas.height;
      const sCtx = staticCanvas.getContext('2d')!;
      sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sRc = rough.canvas(staticCanvas);

      sCtx.clearRect(0, 0, rect.width, rect.height);
      renderGrid(sCtx, state, rect.width, rect.height);

      if (!state.shapes.length) {
        renderWelcome(staticCanvas, sCtx);
      }

      sCtx.save();
      sCtx.translate(state.viewport.x, state.viewport.y);
      sCtx.scale(state.viewport.zoom, state.viewport.zoom);
      
      const staticShapes = state.shapes
        .filter(s => !dynamicIds.has(s.id));

      staticShapes.forEach((shape) => {
        if (isShapeVisible(shape, state.viewport, rect.width, rect.height)) {
          renderShape(sRc, sCtx, shape, false, false, state.shapes, shape.id === state.editingShapeId, false, showPorts);
        }
      });
      sCtx.restore();
      isStaticValid = true;
    }

    // Main draw
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#131316';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticCanvas!, 0, 0, canvas.width, canvas.height);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.translate(state.viewport.x, state.viewport.y);
    ctx.scale(state.viewport.zoom, state.viewport.zoom);

    const dynamicShapes = state.shapes
      .filter(s => dynamicIds.has(s.id));

    dynamicShapes.forEach((shape) => {
      renderShape(rc, ctx, shape, state.selectedIds.includes(shape.id), false, state.shapes, shape.id === state.editingShapeId, shape.id === state.hoveredShapeId, showPorts);
    });

  } else {
    isStaticValid = false;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#131316';
    ctx.fillRect(0, 0, rect.width, rect.height);

    renderGrid(ctx, state, rect.width, rect.height);

    if (!state.shapes.length) {
      renderWelcome(canvas, ctx);
    }

    ctx.save();
    ctx.translate(state.viewport.x, state.viewport.y);
    ctx.scale(state.viewport.zoom, state.viewport.zoom);

    const sortedShapes = state.shapes;
    sortedShapes.forEach((shape) => {
      if (isShapeVisible(shape, state.viewport, rect.width, rect.height)) {
        const isErasing = state.erasingShapeIds?.includes(shape.id) || false;
        renderShape(rc, ctx, shape, state.selectedIds.includes(shape.id), isErasing, state.shapes, shape.id === state.editingShapeId, shape.id === state.hoveredShapeId, showPorts);
      }
    });
  }
  
  lastDragState = state.isDraggingSelection;

  renderOverlays(ctx, state);

  ctx.restore();
}
