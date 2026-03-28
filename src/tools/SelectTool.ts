import type { ICanvasAPI, PointerPayload, ToolDefinition, Shape } from '../core/types';
import { getTopShapeAtPoint, getHandleAtPoint } from '../core/Geometry';
import type { HandleType } from '../core/Geometry';
import { updateBoxSelection } from './SelectBoxHelper';
import { dragHandle, translateSelection } from './SelectDragHelper';
import { openDbTableEditor } from '../ui/DbTableEditor';
import { PluginRegistry } from '../plugins/index';
import { createId } from '../core/Utils';
import { getStylePreset } from '../core/constants';

const PORT_HIT_RADIUS = 12;
function isBindingPlugin(type: string): boolean {
  return PluginRegistry.hasPlugin(type) && !!(PluginRegistry.getPlugin(type) as any).canBind;
}

const HANDLE_CURSORS: Record<string, string> = {
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
  w:  'w-resize',                 e:  'e-resize',
  sw: 'sw-resize', s: 's-resize', se: 'se-resize',
  start: 'crosshair', end: 'crosshair',
};

function setCanvasCursor(event: PointerEvent, cursor: string) {
  const el = event.target as HTMLElement;
  if (el) el.style.cursor = cursor;
}

function getNearestPort(shape: Shape, world: { x: number; y: number }) {
  if (!PluginRegistry.hasPlugin(shape.type)) return null;
  const plugin = PluginRegistry.getPlugin(shape.type);
  if (!plugin.getConnectionPoints) return null;
  const ports = plugin.getConnectionPoints(shape);
  for (const port of ports) {
    if (Math.hypot(world.x - port.x, world.y - port.y) <= PORT_HIT_RADIUS) return port;
  }
  return null;
}

export class SelectTool implements ToolDefinition {
  private dragStartWorld: { x: number; y: number } | null = null;
  private initialSnapshot: Shape[] = [];
  private activeHandle: HandleType | null = null;
  private activeShapeId: string | null = null;
  private isBoxSelecting = false;

  // Arrow drawing from port
  private arrowId: string | null = null;
  private arrowStartShapeId: string | null = null;

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    const state = api.getState();

    // Check if clicking on a connection port of the hovered shape (only when ports are visible)
    const selectedHasConnector = !state.drawingShapeId && state.selectedIds.some(id => {
      const s = state.shapes.find(x => x.id === id);
      return s && isBindingPlugin(s.type);
    });
    const portsVisible = isBindingPlugin(state.activeTool) || selectedHasConnector;
    if (portsVisible && state.hoveredShapeId) {
      const hoveredShape = state.shapes.find(s => s.id === state.hoveredShapeId);
      if (hoveredShape) {
        const port = getNearestPort(hoveredShape, payload.world);
        if (port) {
          // Start drawing an arrow from this port
          const preset = getStylePreset('arrow');
          const arrowShape: Shape = {
            ...preset,
            id: createId(),
            type: 'arrow',
            x: port.x,
            y: port.y,
            seed: Math.floor(Math.random() * 2 ** 31),
            points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
            startBinding: { elementId: hoveredShape.id, portId: port.id },
          } as unknown as Shape;
          this.arrowId = arrowShape.id;
          this.arrowStartShapeId = hoveredShape.id;
          this.dragStartWorld = payload.world;
          api.addShape(arrowShape);
          api.setSelection([arrowShape.id]);
          api.setState({ drawingShapeId: arrowShape.id, hoveredShapeId: null });
          return;
        }
      }
    }

    const hit = getTopShapeAtPoint(state.shapes, payload.world, api.getSpatialIndex());

    // Check handle on hovered/hit shape first, then fall back to selected shape
    const selectedShape = state.selectedIds.length === 1 ? state.shapes.find(s => s.id === state.selectedIds[0]) : null;
    const targetShape = hit || selectedShape;

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

    // Dragging arrow from port
    if (this.arrowId && this.dragStartWorld) {
      const arrow = state.shapes.find(s => s.id === this.arrowId);
      if (arrow) {
        const plugin = PluginRegistry.getPlugin('arrow');
        if (plugin.onDrawUpdate) {
          const patch = plugin.onDrawUpdate(arrow, payload, this.dragStartWorld, state.shapes, api);
          api.updateShape(this.arrowId, patch);
        }
      }
      return;
    }

    const hovered = getTopShapeAtPoint(state.shapes, payload.world, api.getSpatialIndex());
    const hoveredId = hovered?.id || null;
    if (hoveredId !== state.hoveredShapeId) {
      api.setState({ hoveredShapeId: hoveredId });
    }

    // Cursor: check handle on selected OR hovered shape, then ports
    if (!state.isDraggingSelection) {
      let cursor = 'default';

      // Priority 1: handle on selected shape
      const selectedShape = state.selectedIds.length === 1
        ? state.shapes.find(s => s.id === state.selectedIds[0])
        : null;
      if (selectedShape) {
        const handle = getHandleAtPoint(selectedShape, payload.world, state.shapes);
        if (handle && HANDLE_CURSORS[handle]) {
          cursor = HANDLE_CURSORS[handle];
          setCanvasCursor(payload.nativeEvent, cursor);
          return;
        }
      }

      // Priority 2: handle on hovered shape (even if not selected)
      if (hovered && !state.selectedIds.includes(hovered.id)) {
        const handle = getHandleAtPoint(hovered, payload.world, state.shapes);
        if (handle && HANDLE_CURSORS[handle]) {
          cursor = HANDLE_CURSORS[handle];
          setCanvasCursor(payload.nativeEvent, cursor);
          return;
        }
      }

      // Priority 3: port
      if (hovered) {
        const port = getNearestPort(hovered, payload.world);
        cursor = port ? 'crosshair' : 'move';
      }

      setCanvasCursor(payload.nativeEvent, cursor);
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

  onPointerUp(payload: PointerPayload, api: ICanvasAPI) {
    setCanvasCursor(payload.nativeEvent, 'default');

    // Finalize arrow drawn from port
    if (this.arrowId && this.dragStartWorld) {
      const state = api.getState();
      const arrow = state.shapes.find(s => s.id === this.arrowId);
      if (arrow) {
        const plugin = PluginRegistry.getPlugin('arrow');
        if (plugin.onDrawUpdate) {
          const patch = plugin.onDrawUpdate(arrow, payload, this.dragStartWorld, state.shapes, api);
          api.updateShape(this.arrowId, patch);
        }
        // Delete if no movement
        const dx = payload.world.x - this.dragStartWorld.x;
        const dy = payload.world.y - this.dragStartWorld.y;
        if (Math.hypot(dx, dy) < 4) {
          api.deleteShape(this.arrowId);
          api.setSelection([]);
        } else {
          api.commitState();
        }
      }
      this.arrowId = null;
      this.arrowStartShapeId = null;
      this.dragStartWorld = null;
      api.setState({ drawingShapeId: null, hoveredShapeId: null });
      return;
    }

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
      if (hit.type === 'db-table' || hit.type === 'db-view' || hit.type === 'db-enum') {
        openDbTableEditor(hit.id, api, payload.nativeEvent.target as HTMLCanvasElement);
      } else {
        api.setState({ editingShapeId: hit.id, selectedIds: [] });
      }
    }
  }
}
