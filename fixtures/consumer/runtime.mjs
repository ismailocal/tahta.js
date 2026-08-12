import { createBuiltinShapeRegistry, createCanvasEngine } from 'tahta.js/core';

const engine = createCanvasEngine({ documentId: 'runtime-fixture', registry: createBuiltinShapeRegistry() });
if (engine.getSnapshot().schemaVersion !== 2) throw new Error('tahta.js core runtime fixture failed');
engine.destroy();
