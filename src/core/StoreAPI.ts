import type { ICanvasAPI } from './types';
import { WhiteboardStore } from './Store';

import { calculateCenteredViewport, animateViewport } from '../canvas/utils/Viewport';
import { getTopShapeAtPoint } from '../geometry/Geometry';

/**
 * Creates a framed, type-safe API for interacting with the whiteboard store.
 * This is primarily used by tools, plugins, and React components to avoid
 * direct store manipulation.
 * 
 * @param store - The source-of-truth WhiteboardStore instance.
 * @param canvas - The HTMLCanvasElement for viewport calculations.
 * @returns An implementation of ICanvasAPI proxying to the store methods.
 */
export function createWhiteboardAPI(store: WhiteboardStore, canvas: HTMLCanvasElement): ICanvasAPI {
  return {
    bus: store.bus,
    getState: () => store.getState(),
    setState: (updater) => store.setState(updater),
    addShape: (shape) => store.addShape(shape),
    updateShape: (id, patch, force) => store.updateShape(id, patch, force),
    replaceShape: (id, shape) => store.replaceShape(id, shape),
    deleteShape: (id) => store.deleteShape(id),
    setSelection: (ids) => store.setSelection(ids),
    setViewport: (viewport) => store.setViewport(viewport),
    setTool: (tool, keepSelection) => store.setTool(tool, keepSelection),
    reorderShape: (id, direction) => { 
      store.reorderShape(id, direction); 
      store.commitState(); 
    },
    commitState: () => store.commitState(),
    undo: () => store.undo(),
    redo: () => store.redo(),
    batchUpdate: (fn: () => void) => store.batchUpdate(fn),
    getSpatialIndex: () => store.getSpatialIndex(),
    getShapeAtPoint: (point) => {
      const state = store.getState();
      return getTopShapeAtPoint(state.shapes, point, store.getSpatialIndex());
    },
    forceNotify: () => store.forceNotify(),
    scrollToContent: (shapes) => {
      const state = store.getState();
      const targetViewport = calculateCenteredViewport(
        shapes?.length ? shapes : state.shapes,
        canvas.offsetWidth,
        canvas.offsetHeight
      );
      const startViewport = state.viewport || { x: 0, y: 0, zoom: 1 };
      animateViewport((vp) => store.setViewport(vp), startViewport, targetViewport);
    },
    subscribe: (fn) => store.subscribe(fn)
  };
}
