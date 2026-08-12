import { createBuiltinShapeRegistry, createCanvasEngine, type CanvasSnapshotV2 } from 'tahta.js/core';
import type { CanvasView, MountCanvasOptions } from 'tahta.js/dom';

const registry = createBuiltinShapeRegistry();
const engine = createCanvasEngine({ documentId: 'consumer-fixture', registry });
const snapshot: CanvasSnapshotV2 = engine.getSnapshot();
const mountOptions = {} as MountCanvasOptions;
const view = {} as CanvasView;

void snapshot;
void mountOptions;
void view;
engine.destroy();
