import type { ICanvasAPI } from './types';
import { WhiteboardStore } from './Store';

/**
 * Creates a framed, type-safe API for interacting with the whiteboard store.
 * This is primarily used by tools, plugins, and React components to avoid
 * direct store manipulation.
 * 
 * @param store - The source-of-truth WhiteboardStore instance.
 * @returns An implementation of ICanvasAPI proxying to the store methods.
 */
export function createWhiteboardAPI(store: WhiteboardStore): ICanvasAPI {
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
    subscribe: (fn) => store.subscribe(fn)
  };
}
