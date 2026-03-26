import type { ICanvasAPI, PointerPayload, ToolDefinition } from '../core/types';

export class HandTool implements ToolDefinition {
  private panStartScreen: { x: number; y: number } | null = null;
  private initialViewport: { x: number; y: number; zoom: number } | null = null;

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    this.panStartScreen = payload.screen;
    this.initialViewport = api.getState().viewport;
    api.setState({ isPanning: true });
  }

  onPointerMove(payload: PointerPayload, api: ICanvasAPI) {
    if (!api.getState().isPanning || !this.panStartScreen || !this.initialViewport) return;
    
    api.setViewport({
      ...this.initialViewport,
      x: this.initialViewport.x + (payload.screen.x - this.panStartScreen.x),
      y: this.initialViewport.y + (payload.screen.y - this.panStartScreen.y),
    });
  }

  onPointerUp(_payload: PointerPayload, api: ICanvasAPI) {
    api.setState({ isPanning: false });
    this.panStartScreen = null;
    this.initialViewport = null;
  }
}
