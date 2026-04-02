import { WhiteboardStore } from './core/Store';
import type { CanvasState } from './core/types';
import { EventBus } from './canvas/EventBus';
import { InputManager } from './canvas/InputManager';
import { createWhiteboardAPI } from './core/StoreAPI';
import { renderScene, clearRendererState } from './rendering/Renderer';
import { clearImageCache } from './plugins/ImagePlugin';

import { SelectTool } from './tools/SelectTool';
import { HandTool } from './tools/HandTool';
import { ShapeTool } from './tools/ShapeTool';
import { TextTool } from './tools/TextTool';
import { EraserTool } from './tools/EraserTool';
import { TemplateTool } from './tools/TemplateTool';
import { createUI } from './canvas/ui/UIBuilder';
import { PluginRegistry } from './plugins/PluginRegistry';
import { PerformanceMonitor } from './rendering/PerformanceMonitor';

import './styles.css';



import type { ShapeType } from './core/types';

/**
 * Initializes and mounts a tahta.js whiteboard instance onto a given container and canvas element.
 * 
 * @param root - The container element that will hold the UI overlays (toolbars, menus).
 * @param canvas - The HTMLCanvasElement where the drawing will be rendered.
 * @param initialState - Optional partial state to initialize the canvas with (e.g., shapes, viewport).
 * @returns An object containing the store, event bus, and a destroy function to clean up listeners.
 */
export function mountCanvas(root: HTMLElement, canvas: HTMLCanvasElement, initialState: Partial<CanvasState> = {}) {
  const bus = new EventBus();
  const store = new WhiteboardStore(initialState, bus);
  const api = createWhiteboardAPI(store);

  const tools = {
    select: new SelectTool(),
    hand: new HandTool(),
    rectangle: new ShapeTool('rectangle' as ShapeType),
    ellipse: new ShapeTool('ellipse' as ShapeType),
    diamond: new ShapeTool('diamond' as ShapeType),
    'db-table': new ShapeTool('db-table' as ShapeType),
    'db-view': new ShapeTool('db-view' as ShapeType),
    'db-enum': new ShapeTool('db-enum' as ShapeType),
    line: new ShapeTool('line' as ShapeType),
    'line-dashed': new ShapeTool('line-dashed' as ShapeType, 'line' as ShapeType),
    'line-dotted': new ShapeTool('line-dotted' as ShapeType, 'line' as ShapeType),
    arrow: new ShapeTool('arrow' as ShapeType),
    'arrow-double': new ShapeTool('arrow-double' as ShapeType, 'arrow' as ShapeType),
    'arrow-elbow': new ShapeTool('arrow-elbow' as ShapeType, 'arrow' as ShapeType),
    'arrow-curved': new ShapeTool('arrow-curved' as ShapeType, 'arrow' as ShapeType),
    'arrow-filled': new ShapeTool('arrow-filled' as ShapeType, 'arrow' as ShapeType),
    freehand: new ShapeTool('freehand' as ShapeType),
    'freehand-thick': new ShapeTool('freehand-thick' as ShapeType, 'freehand' as ShapeType),
    'freehand-highlighter': new ShapeTool('freehand-highlighter' as ShapeType, 'freehand' as ShapeType),
    image: new ShapeTool('image' as ShapeType),
  };

  // Register tool aliases so Renderer and other subsystems can resolve
  // tool keys to their underlying plugins without ad-hoc string manipulation.
  PluginRegistry.registerToolAlias('arrow-double', 'arrow');
  PluginRegistry.registerToolAlias('arrow-elbow', 'arrow');
  PluginRegistry.registerToolAlias('arrow-curved', 'arrow');
  PluginRegistry.registerToolAlias('arrow-filled', 'arrow');
  PluginRegistry.registerToolAlias('line-dashed', 'line');
  PluginRegistry.registerToolAlias('line-dotted', 'line');

  Object.assign(tools, {
    eraser: new EraserTool(),
    text: new TextTool(),
    'template-decision-tree': new TemplateTool('decision-tree'),
    'template-flowchart': new TemplateTool('flowchart'),
    'template-db-schema': new TemplateTool('db-schema'),
    'template-user-flow': new TemplateTool('user-flow'),
    'template-mind-map': new TemplateTool('mind-map'),
  });

  const disposeUI = createUI(root, store, canvas, api);
  const inputManager = new InputManager(canvas, api, tools);

  let renderPending = false;
  const perf = PerformanceMonitor.getInstance();

  const render = () => {
    if (!renderPending) {
      renderPending = true;
      requestAnimationFrame(() => {
        perf.beginFrame();
        const { total, rendered } = renderScene(canvas, store.getState());
        perf.endFrame(total, rendered);
        renderPending = false;
      });
    }
  };
  const unsubRender = store.subscribe(render);
  window.addEventListener('resize', render);
  window.addEventListener('tuval-force-render', render);

  // Re-render when fonts are loaded to ensure 'Architects Daughter' is applied
  document.fonts.ready.then(() => {
    if (renderPending) return;
    render();
  });

  render();

  return {
    store,
    bus,
    getPerformanceMetrics: () => perf.getMetrics(),
    destroy: () => {
      unsubRender();
      disposeUI();
      window.removeEventListener('resize', render);
      window.removeEventListener('tuval-force-render', render);
      inputManager.destroy();
      clearRendererState();
      clearImageCache();
    },
  };
}
