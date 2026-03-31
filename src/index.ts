import { WhiteboardStore } from './core/Store';
import type { CanvasState } from './core/types';
import { EventBus } from './core/EventBus';
import { InputManager } from './core/InputManager';
import { renderScene, clearRendererState } from './core/Renderer';
import { clearImageCache } from './plugins/ImagePlugin';

import { SelectTool } from './tools/SelectTool';
import { HandTool } from './tools/HandTool';
import { ShapeTool } from './tools/ShapeTool';
import { TextTool } from './tools/TextTool';
import { EraserTool } from './tools/EraserTool';
import { TemplateTool } from './tools/TemplateTool';
import { createUI } from './ui/UIBuilder';
import { PluginRegistry } from './plugins/PluginRegistry';

import './styles.css';



export function mountCanvas(root: HTMLElement, canvas: HTMLCanvasElement, initialState: Partial<CanvasState> = {}) {
  const bus = new EventBus();
  const store = new WhiteboardStore(initialState, bus);
  const api = store.createAPI();

  const tools = {
    select: new SelectTool(),
    hand: new HandTool(),
    rectangle: new ShapeTool('rectangle'),
    ellipse: new ShapeTool('ellipse'),
    diamond: new ShapeTool('diamond'),
    'db-table': new ShapeTool('db-table'),
    'db-view': new ShapeTool('db-view'),
    'db-enum': new ShapeTool('db-enum'),
    line: new ShapeTool('line'),
    'line-dashed': new ShapeTool('line-dashed', 'line'),
    'line-dotted': new ShapeTool('line-dotted', 'line'),
    arrow: new ShapeTool('arrow'),
    'arrow-double': new ShapeTool('arrow-double', 'arrow'),
    'arrow-elbow':  new ShapeTool('arrow-elbow',  'arrow'),
    'arrow-curved': new ShapeTool('arrow-curved', 'arrow'),
    'arrow-filled': new ShapeTool('arrow-filled', 'arrow'),
    freehand: new ShapeTool('freehand'),
    'freehand-thick':       new ShapeTool('freehand-thick',       'freehand'),
    'freehand-highlighter': new ShapeTool('freehand-highlighter', 'freehand'),
  };

  // Register tool aliases so Renderer and other subsystems can resolve
  // tool keys to their underlying plugins without ad-hoc string manipulation.
  PluginRegistry.registerToolAlias('arrow-double', 'arrow');
  PluginRegistry.registerToolAlias('arrow-elbow',  'arrow');
  PluginRegistry.registerToolAlias('arrow-curved', 'arrow');
  PluginRegistry.registerToolAlias('arrow-filled', 'arrow');
  PluginRegistry.registerToolAlias('line-dashed',  'line');
  PluginRegistry.registerToolAlias('line-dotted',  'line');

  Object.assign(tools, {
    eraser: new EraserTool(),
    text: new TextTool(),
    'template-decision-tree': new TemplateTool('decision-tree'),
    'template-flowchart':     new TemplateTool('flowchart'),
    'template-db-schema':     new TemplateTool('db-schema'),
    'template-user-flow':     new TemplateTool('user-flow'),
    'template-mind-map':      new TemplateTool('mind-map'),
  });

  const disposeUI = createUI(root, store, canvas, api);
  const inputManager = new InputManager(canvas, api, tools);

  let renderPending = false;
  const render = () => {
    if (!renderPending) {
      renderPending = true;
      requestAnimationFrame(() => {
        renderScene(canvas, store.getState());
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
