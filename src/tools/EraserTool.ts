import type { ICanvasAPI, PointerPayload, ToolDefinition } from '../core/types';
import { getTopShapeAtPoint } from '../core/Geometry';

export class EraserTool implements ToolDefinition {
  private isDeleting = false;

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    this.isDeleting = true;
    api.setState({
      erasingPath: [payload.world],
      erasingShapeIds: [],
    });
    this.checkErase(payload, api);
  }

  onPointerMove(payload: PointerPayload, api: ICanvasAPI) {
    if (this.isDeleting) {
      const state = api.getState();
      const newPath = state.erasingPath ? [...state.erasingPath, payload.world] : [payload.world];
      // Keep only last 25 points so the tail disappears
      api.setState({ erasingPath: newPath.slice(-25) });
      this.checkErase(payload, api);
    }
  }

  onPointerUp(_payload: PointerPayload, api: ICanvasAPI) {
    if (this.isDeleting) {
      const state = api.getState();
      const idsToDelete = state.erasingShapeIds || [];
      idsToDelete.forEach(id => api.deleteShape(id));
      if (idsToDelete.length > 0) {
        api.commitState();
      }
      api.setState({
        erasingPath: null,
        erasingShapeIds: [],
      });
      this.isDeleting = false;
    }
  }

  private checkErase(payload: PointerPayload, api: ICanvasAPI) {
    const state = api.getState();
    const hitShape = getTopShapeAtPoint(state.shapes, payload.world);
    if (hitShape) {
       const currentIds = state.erasingShapeIds || [];
       if (!currentIds.includes(hitShape.id)) {
         api.setState({ erasingShapeIds: [...currentIds, hitShape.id] });
       }
    }
  }
}

