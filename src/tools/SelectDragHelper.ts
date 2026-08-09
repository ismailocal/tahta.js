import type { ICanvasAPI, Shape, PointerPayload } from '../core/types';
import type { HandleType } from '../geometry/Geometry';
import { getArrowClippedEndpoints, getShapeBounds } from '../geometry/Geometry';
import { updateDependentShapes } from '../core/Utils';
import { PluginRegistry } from '../plugins/index';

export function dragHandle(
  api: ICanvasAPI, 
  payload: PointerPayload, 
  activeShapeId: string, 
  activeHandle: HandleType, 
  initialSnapshot: Shape[], 
  dragStartWorld: { x: number, y: number }
) {
  const state = api.getState();
  const shape = initialSnapshot[0];
  if (!shape || shape.locked) return;
  
  if (PluginRegistry.hasPlugin(shape.type)) {
    const plugin = PluginRegistry.getPlugin(shape.type);
    if (plugin.onDragHandle) {
      const patch = plugin.onDragHandle(shape, activeHandle, payload, dragStartWorld);
      
      if (plugin.onDragBindHandle) {
        Object.assign(patch, plugin.onDragBindHandle(shape, activeHandle, payload, state.shapes, activeShapeId, api));
      }

      api.batchUpdate(() => {
        api.updateShape(activeShapeId, patch);
        updateDependentShapes(api.getState(), api, [activeShapeId]);
      });
    }
  }
}

export function translateSelection(
  api: ICanvasAPI,
  payload: PointerPayload,
  initialSnapshot: Shape[],
  dragStartWorld: { x: number, y: number }
) {
  const state = api.getState();
  let dx = payload.world.x - dragStartWorld.x;
  let dy = payload.world.y - dragStartWorld.y;

  if (initialSnapshot.length > 0 && !payload.metaKey) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    initialSnapshot.forEach(s => {
      const b = getShapeBounds(s);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });
    const width = maxX - minX;
    const height = maxY - minY;

    const newX = minX + dx;
    const newY = minY + dy;
    const newCx = newX + width / 2;
    const newCy = newY + height / 2;
    const newMaxX = newX + width;
    const newMaxY = newY + height;

    const snapLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const SNAP = 5 / Math.max(state.viewport.zoom, 0.1);
    let snappedX = false;
    let snappedY = false;

    // Optimization: Only check shapes within viewport + margin
    const viewportMargin = 500;
    const vpX = -state.viewport.x / state.viewport.zoom - viewportMargin;
    const vpY = -state.viewport.y / state.viewport.zoom - viewportMargin;
    const vpWidth = window.innerWidth / state.viewport.zoom + viewportMargin * 2;
    const vpHeight = window.innerHeight / state.viewport.zoom + viewportMargin * 2;

    const otherShapes = state.shapes.filter(s => {
      if (state.selectedIds.includes(s.id)) return false;
      const b = getShapeBounds(s);
      return b.x >= vpX && b.x <= vpX + vpWidth && b.y >= vpY && b.y <= vpY + vpHeight;
    });
    
    // We only take the unique guides within the viewport or reasonably close
    for (const os of otherShapes) {
      const b = getShapeBounds(os);
      if (b.width === 0 && b.height === 0) continue;
      
      const vGuides = [b.x, b.x + b.width / 2, b.x + b.width];
      const hGuides = [b.y, b.y + b.height / 2, b.y + b.height];

      if (!snappedX) {
        for (const vg of vGuides) {
          if (!snappedX && Math.abs(newX - vg) < SNAP) { dx = vg - minX; snappedX = true; snapLines.push({ x1: vg, y1: -10000, x2: vg, y2: 10000 }); }
          if (!snappedX && Math.abs(newCx - vg) < SNAP) { dx = vg - minX - width/2; snappedX = true; snapLines.push({ x1: vg, y1: -10000, x2: vg, y2: 10000 }); }
          if (!snappedX && Math.abs(newMaxX - vg) < SNAP) { dx = vg - minX - width; snappedX = true; snapLines.push({ x1: vg, y1: -10000, x2: vg, y2: 10000 }); }
        }
      }

      if (!snappedY) {
        for (const hg of hGuides) {
          if (!snappedY && Math.abs(newY - hg) < SNAP) { dy = hg - minY; snappedY = true; snapLines.push({ x1: -10000, y1: hg, x2: 10000, y2: hg }); }
          if (!snappedY && Math.abs(newCy - hg) < SNAP) { dy = hg - minY - height/2; snappedY = true; snapLines.push({ x1: -10000, y1: hg, x2: 10000, y2: hg }); }
          if (!snappedY && Math.abs(newMaxY - hg) < SNAP) { dy = hg - minY - height; snappedY = true; snapLines.push({ x1: -10000, y1: hg, x2: 10000, y2: hg }); }
        }
      }

      if (snappedX && snappedY) break;
    }

    if (snapLines.length > 0) {
      api.setState({ snapLines });
    } else if (state.snapLines) {
      api.setState({ snapLines: undefined });
    }
  }

  api.batchUpdate(() => {
    initialSnapshot.forEach(shape => {
      if (shape.locked) return;
      const patch: Partial<Shape> = { x: shape.x + dx, y: shape.y + dy };

      if ((shape.type === 'arrow' || shape.type === 'line')) {
        const snapshotIds = new Set(initialSnapshot.map(s => s.id));
        const isBoundToUnselected = (shape.startBinding && !snapshotIds.has(shape.startBinding.elementId)) ||
                                    (shape.endBinding && !snapshotIds.has(shape.endBinding.elementId));
        if (isBoundToUnselected) return;
      }

      api.updateShape(shape.id, patch);
    });

    updateDependentShapes(api.getState(), api, initialSnapshot.map(s => s.id));
  });
}
