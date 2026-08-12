import type { CanvasEngine } from '../core/CanvasEngine.js';
import type { Point, ShapeType } from '../core/types.js';
import { WhiteboardStore } from '../core/Store.js';
import { EventBus } from '../canvas/EventBus.js';
import { InputManager } from '../canvas/InputManager.js';
import { createUI } from '../canvas/ui/UIBuilder.js';
import { createWhiteboardAPI } from '../core/StoreAPI.js';
import { renderScene, clearRendererState, invalidateRendererState } from '../rendering/Renderer.js';
import { attachBuiltinShapeRuntimes } from '../plugins/index.js';
import { getShapePlugin } from '../plugins/index.js';
import { ImagePlugin } from '../plugins/ImagePlugin.js';
import { PerformanceMonitor, type PerformanceMetrics } from '../rendering/PerformanceMonitor.js';
import { SelectTool } from '../tools/SelectTool.js';
import { HandTool } from '../tools/HandTool.js';
import { ShapeTool } from '../tools/ShapeTool.js';
import { TextTool } from '../tools/TextTool.js';
import { EraserTool } from '../tools/EraserTool.js';
import { LaserTool } from '../tools/LaserTool.js';
import { TemplateTool } from '../tools/TemplateTool.js';
import { closeDbTableEditor } from '../canvas/ui/DbTableEditor.js';

export interface MountCanvasOptions {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  engine: CanvasEngine;
}

export interface CanvasView {
  focusShapes(ids?: string[]): void;
  getShapeAtPoint(point: Point): ReturnType<ReturnType<typeof createWhiteboardAPI>['getShapeAtPoint']>;
  getPerformanceMetrics(): PerformanceMetrics;
  destroy(): void;
}

export function mountCanvas({ root, canvas, engine }: MountCanvasOptions): CanvasView {
  const registry = engine.registry.fork();
  attachBuiltinShapeRuntimes(registry);
  const bus = new EventBus();
  const store = new WhiteboardStore(engine, {}, bus, registry);
  const api = createWhiteboardAPI(store, canvas);
  const tools = {
    select: new SelectTool(),
    hand: new HandTool(),
    rectangle: new ShapeTool('rectangle' as ShapeType),
    ellipse: new ShapeTool('ellipse' as ShapeType),
    diamond: new ShapeTool('diamond' as ShapeType),
    triangle: new ShapeTool('triangle' as ShapeType),
    'sticky-note': new ShapeTool('sticky-note' as ShapeType),
    frame: new ShapeTool('frame' as ShapeType),
    'db-table': new ShapeTool('db-table' as ShapeType),
    'db-view': new ShapeTool('db-view' as ShapeType),
    'db-enum': new ShapeTool('db-enum' as ShapeType),
    arrow: new ShapeTool('arrow' as ShapeType),
    freehand: new ShapeTool('freehand' as ShapeType),
    image: new ShapeTool('image' as ShapeType),
    eraser: new EraserTool(),
    laser: new LaserTool(),
    text: new TextTool(),
    'template-decision-tree': new TemplateTool('decision-tree'),
    'template-flowchart': new TemplateTool('flowchart'),
    'template-db-schema': new TemplateTool('db-schema'),
    'template-user-flow': new TemplateTool('user-flow'),
    'template-mind-map': new TemplateTool('mind-map'),
    'template-swot': new TemplateTool('swot'),
    'template-org-chart': new TemplateTool('org-chart'),
    'template-timeline': new TemplateTool('timeline'),
    'template-uml-class': new TemplateTool('uml-class'),
    'template-venn': new TemplateTool('venn'),
    'template-fishbone': new TemplateTool('fishbone'),
    'template-wireframe': new TemplateTool('wireframe'),
  };

  const disposeUI = createUI(root, store, canvas, api);
  const inputManager = new InputManager(canvas, api, tools);
  const performanceMonitor = new PerformanceMonitor();
  let renderFrame: number | null = null;
  let destroyed = false;

  const render = () => {
    if (renderFrame !== null || destroyed) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      if (destroyed) return;
      performanceMonitor.beginFrame();
      const { total, rendered, needsAnimation } = renderScene(canvas, store.getState(), registry, store.getSpatialIndex());
      performanceMonitor.endFrame(total, rendered);
      if (needsAnimation) render();
    });
  };
  const unsubscribeRender = store.subscribe(render);
  const invalidate = () => { invalidateRendererState(canvas); render(); };
  const imagePlugin = getShapePlugin(registry, 'image');
  if (!(imagePlugin instanceof ImagePlugin)) throw new Error('Image runtime is not configured');
  imagePlugin.setInvalidate(invalidate);
  window.addEventListener('resize', render);
  window.addEventListener('tahta-force-render', invalidate);
  window.addEventListener('tuval-force-render', invalidate);
  void document.fonts.ready.then(() => { if (!destroyed) render(); });
  render();

  return {
    focusShapes(ids) {
      const shapes = ids?.length ? store.getState().shapes.filter((shape) => ids.includes(shape.id)) : undefined;
      api.scrollToContent(shapes);
    },
    getShapeAtPoint: (point) => api.getShapeAtPoint(point),
    getPerformanceMetrics: () => performanceMonitor.getMetrics(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      unsubscribeRender();
      disposeUI();
      closeDbTableEditor(canvas);
      window.removeEventListener('resize', render);
      window.removeEventListener('tahta-force-render', invalidate);
      window.removeEventListener('tuval-force-render', invalidate);
      inputManager.destroy();
      store.destroy();
      imagePlugin.destroy();
      clearRendererState(canvas);
    },
  };
}
