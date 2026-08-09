import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { z } from 'zod';
import { CanvasValidationError, ROOT_PARENT_ID, type ShapeRecord } from './model';
import { ShapeRegistry, type ShapeDefinition } from './registry';
import { plainText, readRichText, richTextFromString, writeRichText } from './richText';
import { assertCanReparent, composeTransform, getWorldTransform, rotatePoint, toLocalTransform } from './transforms';

const schema = z.object({ width: z.number().positive(), height: z.number().positive() });
const definition: ShapeDefinition<z.infer<typeof schema>> = { type: 'box', version: 1, schema, defaults: () => ({ width: 10, height: 20 }), geometry: { getBounds: (record) => ({ x: record.x, y: record.y, width: record.props.width, height: record.props.height }), containsPoint: (record, point) => point.x >= record.x && point.y >= record.y }, render: vi.fn(), exportSvg: () => '<rect/>' };
const record = (id: string, parentId = ROOT_PARENT_ID): ShapeRecord => ({ id, type: 'box', typeVersion: 1, parentId, index: 'a0', x: 1, y: 2, rotation: 0, opacity: 1, locked: false, hidden: false, props: { width: 10, height: 20 } });

describe('registry, geometry, and rich-text primitives', () => {
  it('validates registry definitions, versions, schemas, and unknown types', () => {
    const registry = new ShapeRegistry(); registry.register(definition); expect(registry.has('box')).toBe(true); expect(registry.list()).toHaveLength(1); expect(registry.get('box')).toBe(definition);
    expect(() => registry.register(definition)).toThrow('already registered'); expect(() => registry.register({ ...definition, type: '', version: 0 })).toThrow('positive integer');
    expect(() => registry.get('missing')).toThrow('not registered'); expect(() => registry.validate({ ...record('a'), typeVersion: 2 })).toThrow('expected version'); expect(() => registry.validate({ ...record('a'), props: { width: -1, height: 2 } })).toThrow();
  });

  it('composes and reverses rotated transforms', () => {
    expect(rotatePoint({ x: 1, y: 0 }, Math.PI / 2).x).toBeCloseTo(0); const parent = { x: 10, y: 20, rotation: Math.PI / 4 }; const local = { x: 4, y: 6, rotation: Math.PI / 8 }; const world = composeTransform(parent, local); expect(toLocalTransform(parent, world)).toMatchObject({ x: expect.closeTo(4), y: expect.closeTo(6), rotation: expect.closeTo(Math.PI / 8) });
  });

  it('rejects missing parents, cycles, and hierarchy depth overflow', () => {
    expect(() => getWorldTransform('missing', new Map())).toThrow('does not exist'); const missing = new Map([['child', record('child', 'missing')]]); expect(() => getWorldTransform('child', missing)).toThrow('does not exist');
    const cycle = new Map([['a', record('a', 'b')], ['b', record('b', 'a')]]); expect(() => getWorldTransform('a', cycle)).toThrow('cycle'); expect(() => assertCanReparent(['a'], 'a', cycle)).toThrow('itself'); expect(() => assertCanReparent(['a'], 'missing', cycle)).toThrow('does not exist');
    const deep = new Map<string, ShapeRecord>(); for (let index = 0; index < 34; index++) deep.set(String(index), record(String(index), index === 33 ? ROOT_PARENT_ID : String(index + 1))); expect(() => getWorldTransform('0', deep)).toThrow('nesting');
  });

  it('round-trips paragraphs, lists, alignment, marks, and safe links through Y.XmlFragment', () => {
    const doc = new Y.Doc(); const fragment = doc.getXmlFragment('content'); const rich = { type: 'doc' as const, content: [
      { type: 'paragraph' as const, align: 'right' as const, content: [{ text: 'Bold', marks: [{ type: 'bold' as const }, { type: 'link' as const, href: 'https://tahta.io' }] }] },
      { type: 'bullet-item' as const, align: 'left' as const, content: [{ text: 'Bullet', marks: [{ type: 'italic' as const }] }] },
      { type: 'ordered-item' as const, align: 'center' as const, content: [{ text: 'Ordered', marks: [{ type: 'strike' as const }, { type: 'code' as const }] }] },
    ] };
    writeRichText(fragment, rich); const result = readRichText(fragment); expect(result).toEqual(rich); expect(plainText(result)).toBe('Bold\nBullet\nOrdered'); writeRichText(fragment, richTextFromString('reset')); expect(plainText(readRichText(fragment))).toBe('reset'); doc.destroy();
  });

  it('rejects unsafe rich-text links and malformed documents', () => {
    const fragment = new Y.Doc().getXmlFragment('content'); expect(() => writeRichText(fragment, { type: 'doc', content: [{ type: 'paragraph', align: 'left', content: [{ text: 'x', marks: [{ type: 'link', href: 'javascript:alert(1)' }] }] }] })).toThrow(); expect(() => writeRichText(fragment, { type: 'html', content: [] })).toThrow();
    expect(new CanvasValidationError('bad', 'CODE')).toMatchObject({ name: 'CanvasValidationError', code: 'CODE' });
  });
});
