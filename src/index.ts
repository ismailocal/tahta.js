import { WhiteboardStore } from './core/Store';
import { EventBus } from './core/EventBus';
import { InputManager } from './core/InputManager';
import { renderScene } from './core/Renderer';

import { SelectTool } from './tools/SelectTool';
import { HandTool } from './tools/HandTool';
import { ShapeTool } from './tools/ShapeTool';
import { TextTool } from './tools/TextTool';
import { EraserTool } from './tools/EraserTool';
import { TemplateTool } from './tools/TemplateTool';
import { createUI } from './ui/UIBuilder';

import './styles.css';



export function mountCanvas(root: HTMLElement, canvas: HTMLCanvasElement) {
  const bus = new EventBus();
  const store = new WhiteboardStore({}, bus);
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
    eraser: new EraserTool(),
    text: new TextTool(),
    'template-decision-tree': new TemplateTool('decision-tree'),
    'template-flowchart':     new TemplateTool('flowchart'),
    'template-db-schema':     new TemplateTool('db-schema'),
    'template-user-flow':     new TemplateTool('user-flow'),
    'template-mind-map':      new TemplateTool('mind-map'),
  };

  createUI(root, store, canvas, api);
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
  store.subscribe(render);
  window.addEventListener('resize', render);
  window.addEventListener('tuval-force-render', render);
  render();

  return {
    store,
    bus,
    destroy: () => {
      window.removeEventListener('resize', render);
      window.removeEventListener('tuval-force-render', render);
      inputManager.destroy();
    },
  };
}
