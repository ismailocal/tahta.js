import { describe, expect, it } from 'vitest';
import { createCanvasEngine } from '../core/CanvasEngine';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import { shapesToSnapshot, snapshotToShapes } from '../core/projection';
import { instantiateTemplate, TEMPLATES } from './templates';

const ORIGIN = { x: 320, y: 180 };

describe('built-in canvas templates', () => {
  it.each(Object.entries(TEMPLATES))(
    '%s produces a valid V2 document without changing the renderer projection',
    (templateId, template) => {
      const registry = createBuiltinShapeRegistry();
      const shapes = instantiateTemplate(template, ORIGIN);
      const snapshot = shapesToSnapshot(templateId, shapes, registry, {
        canvasBackground: '#f8fafc',
        showGrid: false,
        gridSize: 20,
      });
      const engine = createCanvasEngine({
        documentId: templateId,
        registry,
        initialSnapshot: snapshot,
      });

      expect(engine.getSnapshot()).toEqual(snapshot);
      expect(snapshotToShapes(engine.getSnapshot(), registry)).toEqual(
        shapes.map((shape, zIndex) => ({
          ...shape,
          opacity: shape.opacity ?? 1,
          locked: shape.locked ?? false,
          zIndex,
        })),
      );
      expect(snapshot.records).toHaveLength(template.shapes.length);
      expect(snapshot.records.every(({ parentId }) => parentId === 'root')).toBe(true);

      const shapeIds = new Set(snapshot.records.map(({ id }) => id));
      for (const binding of snapshot.bindings) {
        expect(shapeIds.has(binding.connectorId)).toBe(true);
        if (binding.start) expect(shapeIds.has(binding.start.shapeId)).toBe(true);
        if (binding.end) expect(shapeIds.has(binding.end.shapeId)).toBe(true);
      }

      engine.destroy();
    },
  );

  it('generates fresh shape ids while preserving relative positions and bindings', () => {
    const template = TEMPLATES['decision-tree'];
    const first = instantiateTemplate(template, ORIGIN);
    const second = instantiateTemplate(template, ORIGIN);

    expect(first.map(({ id }) => id)).not.toEqual(second.map(({ id }) => id));
    expect(first.map(({ x, y, type, text }) => ({ x, y, type, text }))).toEqual(
      second.map(({ x, y, type, text }) => ({ x, y, type, text })),
    );

    const firstIds = new Set(first.map(({ id }) => id));
    for (const shape of first) {
      if (shape.startBinding) expect(firstIds.has(shape.startBinding.elementId)).toBe(true);
      if (shape.endBinding) expect(firstIds.has(shape.endBinding.elementId)).toBe(true);
    }
  });
});
