import { describe, expect, it } from 'vitest';
import type { CanvasState, ICanvasAPI, PointerPayload } from '../core/types';
import { MAX_LASER_TRAIL_POINTS } from '../core/laser';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import { createCanvasEngine } from '../core/CanvasEngine';
import { WhiteboardStore } from '../core/Store';
import { createWhiteboardAPI } from '../core/StoreAPI';
import { LaserTool } from './LaserTool';

function payload(x: number, y: number): PointerPayload {
  return {
    nativeEvent: {} as PointerEvent,
    screen: { x, y },
    world: { x, y },
    button: 0,
    pointerId: 1,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  };
}

function createApi(): { api: ICanvasAPI; getState: () => CanvasState } {
  let state: CanvasState = {
    shapes: [],
    selectedIds: [],
    activeTool: 'laser',
    viewport: { x: 0, y: 0, zoom: 1 },
    hoveredShapeId: null,
    drawingShapeId: null,
    isDraggingSelection: false,
    laserTrail: [],
    isPanning: false,
    isSpacePanning: false,
    version: 0,
  };
  const api = {
    getState: () => state,
    setState: (updater: Partial<CanvasState> | ((current: CanvasState) => CanvasState)) => {
      state = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
    },
  } as ICanvasAPI;
  return { api, getState: () => state };
}

describe('LaserTool', () => {
  it('keeps recent strokes and continues updating after the point cap is reached', () => {
    const tool = new LaserTool();
    const { api, getState } = createApi();

    tool.onPointerDown(payload(0, 0), api);
    tool.onPointerMove(payload(10, 0), api);
    tool.onPointerUp(payload(20, 0), api);
    tool.onPointerDown(payload(30, 10), api);

    expect(new Set(getState().laserTrail?.map(({ strokeId }) => strokeId))).toEqual(new Set([0, 1]));

    for (let index = 1; index <= MAX_LASER_TRAIL_POINTS + 20; index += 1) {
      tool.onPointerMove(payload(30 + index * 3, 10), api);
    }

    expect(getState().laserTrail).toHaveLength(MAX_LASER_TRAIL_POINTS);
    expect(getState().laserTrail?.at(-1)?.x).toBe(30 + (MAX_LASER_TRAIL_POINTS + 20) * 3);
  });

  it('preserves consecutive strokes through the engine-backed DOM store', () => {
    const engine = createCanvasEngine({ documentId: 'laser-store', registry: createBuiltinShapeRegistry() });
    const store = new WhiteboardStore(engine);
    const api = createWhiteboardAPI(store, { offsetWidth: 800, offsetHeight: 600 } as HTMLCanvasElement);
    const tool = new LaserTool();

    tool.onPointerDown(payload(0, 0), api);
    tool.onPointerMove(payload(10, 0), api);
    tool.onPointerUp(payload(20, 0), api);
    tool.onPointerDown(payload(0, 20), api);
    tool.onPointerMove(payload(10, 20), api);
    tool.onPointerUp(payload(20, 20), api);

    expect(new Set(store.getState().laserTrail?.map(({ strokeId }) => strokeId))).toEqual(new Set([0, 1]));
    store.destroy();
    engine.destroy();
  });
});
