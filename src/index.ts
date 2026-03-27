import { WhiteboardStore } from './core/Store';
import { EventBus } from './core/EventBus';
import { InputManager } from './core/InputManager';
import { renderScene } from './core/Renderer';

import { SelectTool } from './tools/SelectTool';
import { HandTool } from './tools/HandTool';
import { ShapeTool } from './tools/ShapeTool';
import { TextTool } from './tools/TextTool';
import { EraserTool } from './tools/EraserTool';
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
    line: new ShapeTool('line'),
    arrow: new ShapeTool('arrow'),
    freehand: new ShapeTool('freehand'),
    eraser: new EraserTool(),
    text: new TextTool(),
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
