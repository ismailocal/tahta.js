import { describe, expect, it } from 'vitest';
import {
  assertCanReparent,
  composeTransform,
  getWorldTransform,
  resizeFramePreservingChildTransforms,
  rotatePoint,
  toLocalTransform,
} from './transforms';
import type { ShapeRecord } from './model';

function record(id: string, parentId: string, x: number, y: number, rotation = 0): ShapeRecord {
  return { id, type: 'frame', typeVersion: 1, parentId, index: id, x, y, rotation, opacity: 1, locked: false, hidden: false, props: {} };
}

describe('canvas transforms', () => {
  it('round-trips composed world and local transforms', () => {
    expect(rotatePoint({ x: 2, y: 0 }, Math.PI / 2)).toEqual(expect.objectContaining({ x: expect.closeTo(0), y: expect.closeTo(2) }));
    const parent = { x: 10, y: 20, rotation: Math.PI / 2 };
    const local = { x: 4, y: 6, rotation: 0.25 };
    const world = composeTransform(parent, local);
    expect(toLocalTransform(parent, world)).toEqual(expect.objectContaining({ x: expect.closeTo(4), y: expect.closeTo(6), rotation: expect.closeTo(0.25) }));
  });

  it('resolves nested world transforms and rejects missing or cyclic hierarchies', () => {
    const records = new Map<string, ShapeRecord>([
      ['frame', record('frame', 'root', 10, 20)],
      ['child', record('child', 'frame', 5, 6)],
    ]);
    expect(getWorldTransform('child', records)).toMatchObject({ x: 15, y: 26 });
    expect(() => getWorldTransform('missing', records)).toThrow('does not exist');
    records.set('frame', record('frame', 'child', 10, 20));
    expect(() => getWorldTransform('child', records)).toThrow('cycle');
  });

  it('rejects reparenting into missing parents and descendants', () => {
    const records = new Map<string, ShapeRecord>([
      ['frame', record('frame', 'root', 0, 0)],
      ['child', record('child', 'frame', 0, 0)],
    ]);
    expect(() => assertCanReparent(['frame'], 'child', records)).toThrow('descendant');
    expect(() => assertCanReparent(['child'], 'missing', records)).toThrow('does not exist');
    expect(() => assertCanReparent(['child'], 'root', records)).not.toThrow();
  });

  it('resizes a frame without moving or scaling its children', () => {
    const frame = { ...record('frame', 'root', 100, 80), props: { width: 300, height: 200 } };
    const child = {
      ...record('child', 'frame', 40, 50),
      type: 'rectangle',
      locked: true,
      props: { width: 100, height: 80 },
    };
    const records = new Map<string, ShapeRecord>([['frame', frame], ['child', child]]);

    const resized = resizeFramePreservingChildTransforms(
      'frame',
      { x: 60, y: 40, props: { width: 340, height: 240 } },
      records,
      (value) => value,
    );
    const resizedRecords = new Map(resized.map((value) => [value.id, value]));

    expect(getWorldTransform('child', resizedRecords)).toMatchObject({ x: 140, y: 130 });
    expect(resizedRecords.get('child')?.props).toEqual({ width: 100, height: 80 });
    expect(resizedRecords.get('child')).toMatchObject({ locked: true, x: 80, y: 90 });
  });
});
