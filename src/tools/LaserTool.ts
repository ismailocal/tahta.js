import type { ICanvasAPI, PointerPayload, ToolDefinition } from '../core/types.js';
import { appendLaserPoint } from '../core/laser.js';

export class LaserTool implements ToolDefinition {
  private drawing = false;

  onPointerDown(payload: PointerPayload, api: ICanvasAPI): void {
    if (payload.button !== 0) return;
    this.drawing = true;
    api.setState({
      laserTrail: appendLaserPoint([], payload.world, Date.now(), api.getState().viewport.zoom),
    });
  }

  onPointerMove(payload: PointerPayload, api: ICanvasAPI): void {
    if (!this.drawing) return;
    const state = api.getState();
    const next = appendLaserPoint(state.laserTrail ?? [], payload.world, Date.now(), state.viewport.zoom);
    if (next.length !== state.laserTrail?.length) api.setState({ laserTrail: next });
  }

  onPointerUp(payload: PointerPayload, api: ICanvasAPI): void {
    if (!this.drawing) return;
    this.drawing = false;
    const state = api.getState();
    const next = appendLaserPoint(state.laserTrail ?? [], payload.world, Date.now(), state.viewport.zoom);
    if (next.length !== state.laserTrail?.length) api.setState({ laserTrail: next });
  }
}
