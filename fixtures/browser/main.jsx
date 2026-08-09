import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBuiltinShapeRegistry, createCanvasEngine, EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID, exportCanvas, mountCanvas, richTextFromString } from '../../dist/index.js';
import { CanvasWorkspace } from '../../dist/react.js';
import '../../dist/styles.css';

const registry = createBuiltinShapeRegistry();
const engine = createCanvasEngine({ documentId: 'browser-fixture', registry, initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) });
const shape = (id, type, index, x, y, props = {}) => {
  const definition = registry.get(type);
  return registry.validate({ id, type, typeVersion: definition.version, parentId: ROOT_PARENT_ID, index, x, y, rotation: 0, opacity: 1, locked: false, hidden: false, props: { ...definition.defaults(), ...props } });
};
engine.dispatch({ type: 'batch', commands: [
  { type: 'shape.create', record: shape('start', 'rectangle', 'a0', 120, 120, { text: richTextFromString('Start') }) },
  { type: 'shape.create', record: shape('decision', 'diamond', 'a1', 430, 120, { text: richTextFromString('Ready?') }) },
  { type: 'shape.create', record: shape('note-a', 'sticky-note', 'a2', 160, 380, { text: richTextFromString('Customer onboarding'), tags: 'research, customer' }) },
  { type: 'shape.create', record: shape('note-b', 'sticky-note', 'a3', 410, 390, { text: richTextFromString('Customer activation'), tags: 'research, customer' }) },
  { type: 'shape.create', record: shape('frame-one', 'frame', 'a4', 900, 100, { name: 'Overview', width: 360, height: 240 }) },
  { type: 'shape.create', record: shape('frame-two', 'frame', 'a5', 1320, 100, { name: 'Details', width: 360, height: 240 }) },
] });
engine.setViewState({ selectedIds: ['start', 'decision'] });

async function runPerformanceFixture(count) {
  const performanceRegistry = createBuiltinShapeRegistry(); const definition = performanceRegistry.get('rectangle'); const defaults = definition.defaults();
  const records = Array.from({ length: count }, (_, index) => performanceRegistry.validate({ id: `perf-${index}`, type: 'rectangle', typeVersion: definition.version, parentId: ROOT_PARENT_ID, index: `a${index.toString().padStart(6, '0')}`, x: (index % 500) * 40, y: Math.floor(index / 500) * 40, rotation: 0, opacity: 1, locked: false, hidden: false, props: structuredClone(defaults) }));
  const performanceEngine = createCanvasEngine({ documentId: `browser-performance-${count}`, registry: performanceRegistry, initialSnapshot: { ...structuredClone(EMPTY_CANVAS_SNAPSHOT), records } });
  const root = document.createElement('div'); Object.assign(root.style, { position: 'fixed', left: '0', top: '0', width: '800px', height: '600px', opacity: '0', pointerEvents: 'none' }); document.body.append(root);
  const view = mountCanvas({ root, engine: performanceEngine, toolbar: false });
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const times = [];
  for (let index = 0; index < 30; index++) {
    performanceEngine.setViewState({ viewport: { x: -index * 90, y: -(index % 5) * 40, zoom: 1 } });
    await new Promise((resolve) => requestAnimationFrame(resolve)); times.push(view.getPerformanceMetrics().frameTime);
  }
  times.sort((left, right) => left - right); const result = { p95: times[Math.floor(times.length * 0.95)], rendered: view.getPerformanceMetrics().renderedRecords, total: view.getPerformanceMetrics().totalRecords };
  view.destroy(); performanceEngine.destroy(); root.remove(); return result;
}

window.__TAHTA_FIXTURE__ = { engine, exportCanvas, runPerformanceFixture };
createRoot(document.getElementById('root')).render(React.createElement(CanvasWorkspace, { engine }));
