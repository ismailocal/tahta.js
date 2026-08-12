import type { ICanvasAPI, PointerPayload, ToolDefinition } from '../core/types.js';
import { appendLaserPoint, removeExpiredLaserPoints } from '../core/laser.js';

export class LaserTool implements ToolDefinition {
  private currentStrokeId: number | null = null;
  private strokeSequence = 0;

  onPointerDown(payload: PointerPayload, api: ICanvasAPI): void {
    if (payload.button !== 0) return;
    const timestamp = Date.now();
    const state = api.getState();
    this.currentStrokeId = this.strokeSequence;
    this.strokeSequence += 1;
    api.setState({
      laserTrail: appendLaserPoint(
        removeExpiredLaserPoints(state.laserTrail ?? [], timestamp),
        payload.world,
        timestamp,
        state.viewport.zoom,
        this.currentStrokeId,
      ),
    });
  }

  onPointerMove(payload: PointerPayload, api: ICanvasAPI): void {
    if (this.currentStrokeId === null) return;
    const state = api.getState();
    const current = state.laserTrail ?? [];
    const next = appendLaserPoint(current, payload.world, Date.now(), state.viewport.zoom, this.currentStrokeId);
    if (next !== current) api.setState({ laserTrail: next });
  }

  onPointerUp(payload: PointerPayload, api: ICanvasAPI): void {
    if (this.currentStrokeId === null) return;
    const state = api.getState();
    const current = state.laserTrail ?? [];
    const next = appendLaserPoint(current, payload.world, Date.now(), state.viewport.zoom, this.currentStrokeId);
    if (next !== current) api.setState({ laserTrail: next });
    this.currentStrokeId = null;
  }
}
