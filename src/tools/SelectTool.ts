import type { ICanvasAPI, PointerPayload, ToolDefinition, Shape } from '../core/types';
import { getTopShapeAtPoint, getHandleAtPoint } from '../core/Geometry';
import type { HandleType } from '../core/Geometry';
import { updateBoxSelection } from './SelectBoxHelper';
import { dragHandle, translateSelection } from './SelectDragHelper';

export class SelectTool implements ToolDefinition {
  private dragStartWorld: { x: number; y: number } | null = null;
  private initialSnapshot: Shape[] = [];
  private activeHandle: HandleType | null = null;
  private activeShapeId: string | null = null;
  private isBoxSelecting = false;

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    const state = api.getState();
    const hit = getTopShapeAtPoint(state.shapes, payload.world, api.getSpatialIndex());
    
    const targetShape = hit || (state.selectedIds.length === 1 ? state.shapes.find(s => s.id === state.selectedIds[0]) : null);
    
    if (targetShape) {
      const handle = getHandleAtPoint(targetShape, payload.world, state.shapes);
      if (handle) {
        if (!state.selectedIds.includes(targetShape.id)) {
          api.setSelection([targetShape.id]);
        }
        this.activeShapeId = targetShape.id;
        this.activeHandle = handle;
        this.initialSnapshot = [structuredClone(targetShape)];
        this.dragStartWorld = payload.world;
        api.setState({ isDraggingSelection: true });
        return;
      }
    }

    if (hit) {
      let ids = state.selectedIds;
      const hitGroupId = hit.groupId;
      const shapesToAddOrRemove = hitGroupId 
        ? state.shapes.filter(s => s.groupId === hitGroupId).map(s => s.id) 
        : [hit.id];

      if (payload.shiftKey) {
        if (ids.includes(hit.id)) {
          ids = ids.filter(id => !shapesToAddOrRemove.includes(id));
        } else {
          ids = [...new Set([...ids, ...shapesToAddOrRemove])];
        }
      } else {
        ids = ids.includes(hit.id) ? ids : shapesToAddOrRemove;
      }
      
      api.setSelection(ids);
      this.dragStartWorld = payload.world;
      this.initialSnapshot = state.shapes.filter(s => ids.includes(s.id)).map(s => structuredClone(s));
      api.setState({ isDraggingSelection: true });
    } else {
      if (!payload.shiftKey) {
        api.setSelection([]);
      }
      this.isBoxSelecting = true;
      this.dragStartWorld = payload.world;
      api.setState({ selectionBox: { x: payload.world.x, y: payload.world.y, width: 0, height: 0 } });
    }
  }

  onPointerMove(payload: PointerPayload, api: ICanvasAPI) {
    const state = api.getState();
    const hovered = getTopShapeAtPoint(state.shapes, payload.world, api.getSpatialIndex());
    const hoveredId = hovered?.id || null;
    if (hoveredId !== state.hoveredShapeId) {
      api.setState({ hoveredShapeId: hoveredId });
    }

    if (this.isBoxSelecting && this.dragStartWorld) {
      updateBoxSelection(api, payload, this.dragStartWorld);
      return;
    }

    if (!state.isDraggingSelection || !this.dragStartWorld) return;

    if (this.activeHandle && this.activeShapeId) {
      dragHandle(api, payload, this.activeShapeId, this.activeHandle, this.initialSnapshot, this.dragStartWorld);
      return;
    }

    translateSelection(api, payload, this.initialSnapshot, this.dragStartWorld);
  }

  onPointerUp(_payload: PointerPayload, api: ICanvasAPI) {
    if (this.isBoxSelecting) {
      api.setState({ selectionBox: null });
      this.isBoxSelecting = false;
    }
    if (api.getState().hoveredShapeId) {
       api.setState({ hoveredShapeId: null });
    }
    if (api.getState().isDraggingSelection) {
      api.setState({ isDraggingSelection: false, snapLines: undefined });
      if (this.dragStartWorld) api.commitState();
    }
    this.dragStartWorld = null;
    this.initialSnapshot = [];
    this.activeHandle = null;
    this.activeShapeId = null;
  }

  onKeyDown(event: KeyboardEvent, api: ICanvasAPI) {
    const state = api.getState();
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedIds.length) {
      let changed = false;
      [...state.selectedIds].forEach((id) => {
        const shape = state.shapes.find(s => s.id === id);
        if (shape && !shape.locked) {
          api.deleteShape(id);
          changed = true;
        }
      });
      if (changed) {
        api.setSelection([]);
        api.commitState();
      }
    }
  }

  onDoubleClick(payload: PointerPayload, api: ICanvasAPI) {
    const state = api.getState();
    const hit = getTopShapeAtPoint(state.shapes, payload.world, api.getSpatialIndex());
    if (hit && !hit.locked) {
      api.setState({ editingShapeId: hit.id, selectedIds: [] });
    }
  }
}
