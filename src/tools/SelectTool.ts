import type { ICanvasAPI, PointerPayload, ToolDefinition, Shape } from '../core/types';
import { getTopShapeAtPoint, getHandleAtPoint } from '../geometry/Geometry';
import type { HandleType } from '../geometry/Geometry';
import { updateBoxSelection } from './SelectBoxHelper';
import { dragHandle, translateSelection } from './SelectDragHelper';
import { openDbTableEditor } from '../canvas/ui/DbTableEditor';
import { getShapePlugin } from '../plugins/index';
import type { ShapeRegistry } from '../core/registry';
import { createId, randomSeed } from '../core/Utils';
import { getStylePreset, UI_CONSTANTS } from '../core/constants';
import { ROOT_PARENT_ID } from '../core/model';
import { commonParentId, resolveFrameDrop, topLevelSelectionIds } from './FrameContainment';

const HANDLE_CURSORS: Record<string, string> = {
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
  w: 'w-resize', e: 'e-resize',
  sw: 'sw-resize', s: 's-resize', se: 'se-resize',
  start: 'crosshair', end: 'crosshair',
};

function setCanvasCursor(event: PointerEvent, cursor: string) {
  const el = event.target as HTMLElement;
  if (el) el.style.cursor = cursor;
}

function setFrameDropTarget(api: ICanvasAPI, targetId: string | null): void {
  if ((api.getState().frameDropTargetId ?? null) !== targetId) {
    api.setState({ frameDropTargetId: targetId });
  }
}

function getNearestPort(shape: Shape, world: { x: number; y: number }, registry: ShapeRegistry) {
  const plugin = getShapePlugin(registry, shape.type);
  if (!plugin.getConnectionPoints) return null;
  const ports = plugin.getConnectionPoints(shape);
  for (const port of ports) {
    if (Math.hypot(world.x - port.x, world.y - port.y) <= UI_CONSTANTS.PORT_HIT_RADIUS) return port;
  }
  return null;
}

// Helper to check if a plugin supports binding
function isBindingPlugin(type: string, registry: ShapeRegistry): boolean {
  return !!getShapePlugin(registry, type).canBind;
}

export class SelectTool implements ToolDefinition {
  private dragStartWorld: { x: number; y: number } | null = null;
  private initialSnapshot: Shape[] = [];
  private activeHandle: HandleType | null = null;
  private activeShapeId: string | null = null;
  private isBoxSelecting = false;
  private framePreviewParentId: string | null = null;
  private framePreviewHighlightTargetId: string | null = null;

  // Arrow drawing from port
  private arrowId: string | null = null;
  private arrowStartShapeId: string | null = null;

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    setFrameDropTarget(api, null);
    this.framePreviewParentId = null;
    this.framePreviewHighlightTargetId = null;
    const state = api.getState();

    // Check if clicking on a connection port of the hovered shape (only when ports are visible)
    if (api.registry.hasRuntime(state.activeTool) && isBindingPlugin(state.activeTool, api.registry) && state.hoveredShapeId) {
      const hoveredShape = state.shapes.find(s => s.id === state.hoveredShapeId);
      if (hoveredShape) {
        const port = getNearestPort(hoveredShape, payload.world, api.registry);
        if (port) {
          // Start drawing an arrow from this port
          const preset = getStylePreset('arrow');
          const arrowShape: Shape = {
            ...preset,
            id: createId(),
            type: 'arrow',
            x: port.x,
            y: port.y,
            seed: randomSeed(),
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

    const hit = getTopShapeAtPoint(state.shapes, payload.world, api.registry, api.getSpatialIndex());

    // Check handles only on already-selected shapes — resize requires prior selection
    const selectedShape = state.selectedIds.length === 1 ? state.shapes.find(s => s.id === state.selectedIds[0]) : null;

    if (selectedShape) {
      const handle = getHandleAtPoint(selectedShape, payload.world, state.shapes, api.registry);
      if (handle) {
        this.activeShapeId = selectedShape.id;
        this.activeHandle = handle as HandleType;
        this.initialSnapshot = [structuredClone(selectedShape)];
        this.dragStartWorld = payload.world;
        api.setState({ isDraggingSelection: true, resizingShapeId: selectedShape.id });
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
      setCanvasCursor(payload.nativeEvent, 'move');
      const movableIds = topLevelSelectionIds(ids, state.shapes);
      this.framePreviewParentId = commonParentId(movableIds, state.shapes);
      this.dragStartWorld = payload.world;
      // Expand snapshot to include shapes bound to any connector in the selection
      const snapshotIds = new Set(ids);
      for (const id of ids) {
        const s = state.shapes.find(x => x.id === id);
        if (s && (s.type === 'arrow' || s.type === 'line')) {
          if (s.startBinding?.elementId) snapshotIds.add(s.startBinding.elementId);
          if (s.endBinding?.elementId) snapshotIds.add(s.endBinding.elementId);
        }
      }
      this.initialSnapshot = state.shapes.filter(s => snapshotIds.has(s.id)).map(s => structuredClone(s));
      api.setState({ isDraggingSelection: true });
    } else if (!payload.shiftKey && state.selectedIds.length > 0) {
      // Check if clicking on/near the selection frame of a selected shape
      const framePad = UI_CONSTANTS.FRAME_PAD + UI_CONSTANTS.FRAME_HIT_TOLERANCE;
      const selShapes = state.selectedIds
        .map(id => state.shapes.find(s => s.id === id))
        .filter((s): s is Shape => !!s);
      const frameHit = selShapes.find(sel => {
        const plugin = getShapePlugin(api.registry, sel.type);
        if (!plugin.getBounds) return false;
        const b = plugin.getBounds(sel);
        return payload.world.x >= b.x - framePad && payload.world.x <= b.x + b.width + framePad &&
               payload.world.y >= b.y - framePad && payload.world.y <= b.y + b.height + framePad;
      });
      if (frameHit) {
        setCanvasCursor(payload.nativeEvent, 'move');
        const movableIds = topLevelSelectionIds(state.selectedIds, state.shapes);
        this.framePreviewParentId = commonParentId(movableIds, state.shapes);
        this.dragStartWorld = payload.world;
        // Expand snapshot to include shapes bound to any connector in the selection
        const frameSnapshotIds = new Set(selShapes.map(s => s.id));
        for (const sel of selShapes) {
          if (sel.type === 'arrow' || sel.type === 'line') {
            if (sel.startBinding?.elementId) frameSnapshotIds.add(sel.startBinding.elementId);
            if (sel.endBinding?.elementId) frameSnapshotIds.add(sel.endBinding.elementId);
          }
        }
        this.initialSnapshot = state.shapes.filter(s => frameSnapshotIds.has(s.id)).map(s => structuredClone(s));
        api.setState({ isDraggingSelection: true });
      } else {
        api.setSelection([]);
        this.isBoxSelecting = true;
        this.dragStartWorld = payload.world;
        api.setState({ selectionBox: { x: payload.world.x, y: payload.world.y, width: 0, height: 0 } });
      }
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
        const plugin = getShapePlugin(api.registry, 'arrow');
        if (plugin.onDrawUpdate) {
          const patch = plugin.onDrawUpdate(arrow, payload, this.dragStartWorld, state.shapes, api);
          api.updateShape(this.arrowId, patch);
        }
      }
      return;
    }

    const hovered = getTopShapeAtPoint(state.shapes, payload.world, api.registry, api.getSpatialIndex());
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
        const handle = getHandleAtPoint(selectedShape, payload.world, state.shapes, api.registry);
        if (handle && HANDLE_CURSORS[handle]) {
          cursor = HANDLE_CURSORS[handle];
          setCanvasCursor(payload.nativeEvent, cursor);
          return;
        }
      }

      // Priority 2: hovering over a shape — always 'move' in selection mode
      if (hovered) {
        cursor = 'move';
      }

      // Priority 4: hovering on selection frame of selected shape (when not directly over a shape)
      if (!hovered && selectedShape) {
        const selPlugin = getShapePlugin(api.registry, selectedShape.type);
        if (selPlugin?.getBounds) {
          const b = selPlugin.getBounds(selectedShape);
          const framePad = UI_CONSTANTS.FRAME_PAD + UI_CONSTANTS.FRAME_HIT_TOLERANCE;
          if (payload.world.x >= b.x - framePad && payload.world.x <= b.x + b.width + framePad &&
              payload.world.y >= b.y - framePad && payload.world.y <= b.y + b.height + framePad) {
            cursor = 'move';
          }
        }
      }

      setCanvasCursor(payload.nativeEvent, cursor);
    }

    if (this.isBoxSelecting && this.dragStartWorld) {
      updateBoxSelection(api, payload, this.dragStartWorld);
      return;
    }

    if (!state.isDraggingSelection || !this.dragStartWorld) return;

    if (this.activeHandle && this.activeShapeId) {
      setFrameDropTarget(api, null);
      dragHandle(api, payload, this.activeShapeId, this.activeHandle, this.initialSnapshot, this.dragStartWorld);
      return;
    }

    setCanvasCursor(payload.nativeEvent, 'move');
    translateSelection(api, payload, this.initialSnapshot, this.dragStartWorld);
    const translatedState = api.getState();
    const movableIds = topLevelSelectionIds(translatedState.selectedIds, translatedState.shapes);
    const resolution = resolveFrameDrop(
      movableIds,
      translatedState.shapes,
      payload.world,
      api.registry,
    );
    const targetFrameId = resolution.parentId !== ROOT_PARENT_ID
      ? resolution.parentId
      : null;
    const reenteredTargetId = targetFrameId !== null
      && this.framePreviewParentId !== null
      && this.framePreviewParentId !== targetFrameId
      ? targetFrameId
      : null;
    const newHighlightTargetId = resolution.highlightTargetId ?? reenteredTargetId;
    const highlightTargetId = newHighlightTargetId
      ?? (this.framePreviewHighlightTargetId === targetFrameId ? targetFrameId : null);
    setFrameDropTarget(api, highlightTargetId);
    this.framePreviewParentId = resolution.parentId;
    this.framePreviewHighlightTargetId = highlightTargetId;
  }

  onPointerUp(payload: PointerPayload, api: ICanvasAPI) {
    setCanvasCursor(payload.nativeEvent, 'default');

    // Finalize arrow drawn from port
    if (this.arrowId && this.dragStartWorld) {
      const state = api.getState();
      const arrow = state.shapes.find(s => s.id === this.arrowId);
      if (arrow) {
        const plugin = getShapePlugin(api.registry, 'arrow');
        if (plugin.onDrawUpdate) {
          const patch = plugin.onDrawUpdate(arrow, payload, this.dragStartWorld, state.shapes, api);
          api.updateShape(this.arrowId, patch);
        }
        // Delete if no movement
        const dx = payload.world.x - this.dragStartWorld.x;
        const dy = payload.world.y - this.dragStartWorld.y;
        if (Math.hypot(dx, dy) < UI_CONSTANTS.DRAG_DELETE_THRESHOLD) {
          api.deleteShape(this.arrowId);
          api.setSelection([]);
        } else {
          api.commitState();
        }
      }
      this.arrowId = null;
      this.arrowStartShapeId = null;
      this.dragStartWorld = null;
      this.framePreviewParentId = null;
      this.framePreviewHighlightTargetId = null;
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
      api.setState({
        isDraggingSelection: false,
        resizingShapeId: null,
        frameDropTargetId: null,
        snapLines: undefined,
      });
      if (this.dragStartWorld) {
        const dx = payload.world.x - this.dragStartWorld.x;
        const dy = payload.world.y - this.dragStartWorld.y;
        const moved = Math.hypot(dx, dy) > UI_CONSTANTS.DRAG_COMMIT_THRESHOLD;
        if (moved) {
          const state = api.getState();
          const movableIds = topLevelSelectionIds(state.selectedIds, state.shapes);
          const { parentId: destinationParentId } = resolveFrameDrop(
            movableIds,
            state.shapes,
            payload.world,
            api.registry,
          );
          api.reparentShapes(movableIds, destinationParentId);
          api.commitState();
        }
      }
    }
    this.dragStartWorld = null;
    this.initialSnapshot = [];
    this.activeHandle = null;
    this.activeShapeId = null;
    this.framePreviewParentId = null;
    this.framePreviewHighlightTargetId = null;
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
    // Use bounds-based hit for double-click so clicking anywhere inside a shape works,
    // even if the shape has transparent fill (border-only isPointInside).
    const pt = payload.world;
    const hit = [...state.shapes].reverse().find(s => {
      const plugin = getShapePlugin(api.registry, s.type);
      if (!plugin.getBounds) return false;
      // Connectors (arrow/line): use isPointInside (distance-to-path check)
      if (plugin.isConnector) {
        return plugin.isPointInside ? plugin.isPointInside(pt, s, state.shapes) : false;
      }
      const b = plugin.getBounds(s);
      return pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height;
    });
    if (hit && !hit.locked) {
      if (hit.type === 'db-table' || hit.type === 'db-view' || hit.type === 'db-enum') {
        openDbTableEditor(hit.id, api, payload.nativeEvent.target as HTMLCanvasElement);
      } else {
        api.setState({ editingShapeId: hit.id, selectedIds: [] });
      }
    }
  }
}
