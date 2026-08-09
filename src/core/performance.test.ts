import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createCanvasEngine } from './CanvasEngine';
import { EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID, type CanvasSnapshotV2, type ShapeRecord } from './model';
import { ShapeRegistry, type ShapeDefinition } from './registry';

const definition: ShapeDefinition<{ width: number; height: number }> = { type: 'perf', version: 1, schema: z.object({ width: z.number(), height: z.number() }), defaults: () => ({ width: 10, height: 10 }), geometry: { getBounds: (record) => ({ x: record.x, y: record.y, width: 10, height: 10 }), containsPoint: () => false }, render: vi.fn(), exportSvg: () => '<rect/>' };
function fixture(count: number): CanvasSnapshotV2 { const records: ShapeRecord[] = Array.from({ length: count }, (_, index) => ({ id: `shape-${index}`, type: 'perf', typeVersion: 1, parentId: ROOT_PARENT_ID, index: `a${index.toString().padStart(6, '0')}`, x: index % 500, y: Math.floor(index / 500), rotation: 0, opacity: 1, locked: false, hidden: false, props: { width: 10, height: 10 } })); return { ...structuredClone(EMPTY_CANVAS_SNAPSHOT), records }; }

describe.each([10_000, 50_000])('$shapeCount-record performance fixture', (shapeCount) => {
  it('keeps single-record command p95 below 33 ms without a full-scene update payload', () => {
    const registry = new ShapeRegistry(); registry.register(definition); const engine = createCanvasEngine({ documentId: `perf-${shapeCount}`, registry, initialSnapshot: fixture(shapeCount) });
    const payloadSizes: number[] = []; const unsubscribe = engine.onDocumentUpdate((update) => payloadSizes.push(update.byteLength)); const times: number[] = [];
    for (let index = 0; index < 20; index++) { const started = performance.now(); engine.dispatch({ type: 'shape.update', id: 'shape-0', patch: { x: index } }); times.push(performance.now() - started); }
    times.sort((a, b) => a - b); expect(times[Math.floor(times.length * .95)]).toBeLessThan(33); expect(Math.max(...payloadSizes)).toBeLessThan(10_000); unsubscribe(); engine.destroy();
  }, 20_000);
});
