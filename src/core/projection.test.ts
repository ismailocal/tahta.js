import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it } from 'vitest';
import { createBuiltinShapeRegistry } from './builtinRegistry';
import { EMPTY_CANVAS_SNAPSHOT } from './model';
import {
  commandsForShapeReplacement,
  shapePatchToRecordPatch,
  shapeToBindingRecord,
  shapeToRecord,
  shapesToSnapshot,
  snapshotToShapes,
  toBinding,
} from './projection';
import type { Shape } from './types';

const rectangle = (id: string, patch: Partial<Shape> = {}): Shape => ({
  id,
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  stroke: '#111827',
  fill: '#ffffff',
  ...patch,
});

describe('legacy renderer projection', () => {
  it('maps optional binding fields without inventing values', () => {
    expect(toBinding(undefined)).toBeNull();
    expect(toBinding({ elementId: 'target' })).toEqual({ shapeId: 'target' });
    expect(toBinding({ elementId: 'target', portId: 'right', offsetX: 1, offsetY: 2, normalX: 0.5, normalY: 1 })).toEqual({
      shapeId: 'target', portId: 'right', offsetX: 1, offsetY: 2, normalX: 0.5, normalY: 1,
    });
  });

  it('round-trips the existing flat renderer shape contract immutably', () => {
    const registry = createBuiltinShapeRegistry();
    const shapes = [rectangle('a'), rectangle('hidden', { opacity: 0.5 })];
    const snapshot = shapesToSnapshot('board', shapes, registry, {
      canvasBackground: '#abcdef', showGrid: true, gridSize: 32,
    });
    snapshot.records[1] = { ...snapshot.records[1]!, hidden: true };
    const projected = snapshotToShapes(snapshot, registry);
    expect(snapshot.document).toMatchObject({ title: 'board', background: '#abcdef', grid: { enabled: true, size: 32 } });
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({ id: 'a', type: 'rectangle', x: 10, y: 20, zIndex: 0, opacity: 1, locked: false });
    expect(Object.isFrozen(projected[0])).toBe(true);
  });

  it('projects bindings and record patches with the current renderer defaults', () => {
    const registry = createBuiltinShapeRegistry();
    const arrow: Shape = {
      id: 'arrow', type: 'arrow', x: 0, y: 0, width: 100, height: 0,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      startBinding: { elementId: 'a' }, endBinding: { elementId: 'b', portId: 'left' },
    };
    const snapshot = shapesToSnapshot('board', [rectangle('a'), rectangle('b'), arrow], registry, {});
    expect(shapeToBindingRecord(arrow)).toEqual({
      id: 'arrow:binding', connectorId: 'arrow', start: { shapeId: 'a' }, end: { shapeId: 'b', portId: 'left' },
    });
    expect(snapshotToShapes(snapshot, registry).find(({ id }) => id === 'arrow')).toMatchObject({
      startBinding: { elementId: 'a' }, endBinding: { elementId: 'b', portId: 'left' },
    });
    expect(shapePatchToRecordPatch(rectangle('a', { opacity: 0.4, locked: true }))).toMatchObject({
      parentId: 'root', rotation: 0, opacity: 0.4, locked: true, hidden: false,
    });
    expect(shapeToRecord(rectangle('a'), generateKeyBetween(null, null), registry)).toMatchObject({
      id: 'a', typeVersion: 1, parentId: 'root', props: { width: 100, height: 80 },
    });
  });

  it('derives minimal typed commands for create, update, replace, delete and bindings', () => {
    const registry = createBuiltinShapeRegistry();
    const initial = shapesToSnapshot('board', [rectangle('a'), rectangle('gone')], registry, {});
    const target = [
      rectangle('a', { x: 44 }),
      { ...rectangle('gone'), type: 'ellipse' },
      rectangle('new'),
      {
        id: 'arrow', type: 'arrow', x: 0, y: 0, width: 100, height: 0,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], startBinding: { elementId: 'a' },
      } satisfies Shape,
    ];
    const commands = commandsForShapeReplacement(initial, target, registry);
    expect(commands.map(({ type }) => type)).toEqual([
      'shape.update', 'shape.delete', 'shape.create', 'shape.create', 'shape.create', 'binding.set',
    ]);

    const withBinding = shapesToSnapshot('board', target, registry, {});
    const removal = commandsForShapeReplacement(withBinding, [rectangle('a')], registry);
    expect(removal).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'shape.delete' }),
      { type: 'binding.delete', ids: ['arrow:binding'] },
    ]));
    expect(commandsForShapeReplacement(structuredClone(EMPTY_CANVAS_SNAPSHOT), [], registry)).toEqual([]);
  });
});
