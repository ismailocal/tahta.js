import { createBuiltinShapeRegistry, createCanvasEngine } from 'tahta.js/core';

const engine = createCanvasEngine({ documentId: 'runtime-fixture', registry: createBuiltinShapeRegistry() });
if (engine.getSnapshot().schemaVersion !== 2) throw new Error('tahta.js core runtime fixture failed');
if (typeof engine.setLocalAwarenessPointer !== 'function') {
  throw new Error('tahta.js awareness API is missing from the compiled package');
}
engine.setLocalAwarenessPointer({
  cursor: { x: 0, y: 0 },
  button: 'up',
  viewportZoom: 1,
  pointerTool: 'pointer',
});
engine.destroy();
