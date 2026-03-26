import type { ICanvasAPI, Shape, PointerPayload } from '../core/types';
import { getShapeBounds } from '../core/Geometry';

export function updateBoxSelection(api: ICanvasAPI, payload: PointerPayload, dragStartWorld: { x: number, y: number }) {
  const state = api.getState();
  const box = {
    x: Math.min(dragStartWorld.x, payload.world.x),
    y: Math.min(dragStartWorld.y, payload.world.y),
    width: Math.abs(payload.world.x - dragStartWorld.x),
    height: Math.abs(payload.world.y - dragStartWorld.y)
  };
  api.setState({ selectionBox: box });

  let hitIds = state.shapes.filter(s => {
    const sb = getShapeBounds(s);
    return !(sb.x > box.x + box.width || sb.x + sb.width < box.x || sb.y > box.y + box.height || sb.y + sb.height < box.y);
  }).map(s => s.id);

  const groupIds = new Set(state.shapes.filter(s => hitIds.includes(s.id) && s.groupId).map(s => s.groupId));
  if (groupIds.size > 0) {
    hitIds = state.shapes.filter(s => hitIds.includes(s.id) || (s.groupId && groupIds.has(s.groupId))).map(s => s.id);
  }

  api.setSelection(hitIds);
}
