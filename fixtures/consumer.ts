import { createBuiltinShapeRegistry, createCanvasEngine } from 'tahta.js/core';
import { mountCanvas } from 'tahta.js/dom';
import { CanvasWorkspace, TahtaCanvas, useTahtaEngine } from 'tahta.js/react';
import { parseDsl } from 'tahta.js/dsl';

const engine = createCanvasEngine({ documentId: 'consumer-fixture', registry: createBuiltinShapeRegistry() });
const root = document.createElement('div'); const view = mountCanvas({ root, engine, toolbar: false });
parseDsl('node start rectangle "Start"');
void CanvasWorkspace; void TahtaCanvas; void useTahtaEngine;
view.destroy(); engine.destroy();
