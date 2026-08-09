import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { createBuiltinShapeRegistry, createCanvasEngine } from '../dist/core.js';

const registry = createBuiltinShapeRegistry();
const source = createCanvasEngine({ documentId: 'package-runtime-source', registry });
const document = new Y.Doc();

try {
  Y.applyUpdate(document, source.encodeState());
  const restored = createCanvasEngine({
    documentId: 'package-runtime-restored',
    registry,
    document,
  });
  try {
    assert.equal(restored.getSnapshot().schemaVersion, 2);
  } finally {
    restored.destroy();
  }
} finally {
  source.destroy();
  if (!document.isDestroyed) document.destroy();
}
