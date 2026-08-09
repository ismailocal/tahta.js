import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it } from 'vitest';
import { createCanvasEngine } from './CanvasEngine';
import { EMPTY_CANVAS_SNAPSHOT, ROOT_PARENT_ID } from './model';
import { createBuiltinShapeRegistry, plainText, richTextFromString } from '../shapes';
import { readRichText, writeRichText, type RichTextDocument } from './richText';
import * as Y from 'yjs';

function engine(update?: Uint8Array) { return createCanvasEngine({ documentId: 'collab', registry: createBuiltinShapeRegistry(), ...(update ? { initialUpdate: update } : { initialSnapshot: structuredClone(EMPTY_CANVAS_SNAPSHOT) }) }); }

describe('collaborative rich text and table cells', () => {
  it('round-trips every list item, hard break, alignment, and supported mark through Y.XmlFragment', () => {
    const yDocument = new Y.Doc();
    const fragment = yDocument.getXmlFragment('rich-text');
    const document: RichTextDocument = {
      type: 'doc',
      content: [
        { type: 'paragraph', align: 'center', content: [{ text: 'First\nsecond', marks: [{ type: 'bold' }, { type: 'italic' }] }] },
        { type: 'bullet-item', align: 'left', content: [{ text: 'One', marks: [{ type: 'strike' }] }] },
        { type: 'bullet-item', align: 'right', content: [{ text: 'Two', marks: [{ type: 'code' }, { type: 'link', href: 'https://tahta.io/docs' }] }] },
      ],
    };

    writeRichText(fragment, document);

    expect(readRichText(fragment)).toEqual(document);
    yDocument.destroy();
  });

  it('stores rich text in a Y.XmlFragment and merges remote state', () => {
    const first = engine(); const definition = first.registry.get('rectangle');
    first.dispatch({ type: 'shape.create', record: first.registry.validate({ id: 'shape', type: 'rectangle', typeVersion: 1, parentId: ROOT_PARENT_ID, index: generateKeyBetween(null, null), x: 0, y: 0, rotation: 0, opacity: 1, locked: false, hidden: false, props: definition.defaults() }) });
    first.dispatch({ type: 'text.replace', shapeId: 'shape', document: richTextFromString('Collaborative') });
    expect(first.getRichTextFragment('shape').length).toBeGreaterThan(0);
    const second = engine(first.encodeState()); expect(plainText((second.getSnapshot().records[0]!.props as { text: ReturnType<typeof richTextFromString> }).text)).toBe('Collaborative');
    second.dispatch({ type: 'text.replace', shapeId: 'shape', document: richTextFromString('Remote') }); first.applyRemoteUpdate(second.encodeDiff(first.encodeStateVector()));
    expect(plainText((first.getSnapshot().records[0]!.props as { text: ReturnType<typeof richTextFromString> }).text)).toBe('Remote'); first.destroy(); second.destroy();
  });

  it('converges concurrent character inserts in the same rich-text fragment', () => {
    const seed = engine(); const definition = seed.registry.get('rectangle');
    seed.dispatch({ type: 'shape.create', record: seed.registry.validate({ id: 'shape', type: 'rectangle', typeVersion: 1, parentId: ROOT_PARENT_ID, index: 'a0', x: 0, y: 0, rotation: 0, opacity: 1, locked: false, hidden: false, props: definition.defaults() }) });
    seed.dispatch({ type: 'text.replace', shapeId: 'shape', document: richTextFromString('AB') });
    const state = seed.encodeState(); const vector = seed.encodeStateVector();
    const left = engine(state); const right = engine(state);
    const text = (value: ReturnType<typeof engine>) => ((value.getRichTextFragment('shape').toArray()[0] as Y.XmlElement).toArray()[0] as Y.XmlText);
    text(left).insert(1, 'L'); text(right).insert(1, 'R');
    const leftUpdate = left.encodeDiff(vector); const rightUpdate = right.encodeDiff(vector);
    left.applyRemoteUpdate(rightUpdate); right.applyRemoteUpdate(leftUpdate);
    const leftText = plainText((left.getSnapshot().records[0]!.props as { text: ReturnType<typeof richTextFromString> }).text);
    const rightText = plainText((right.getSnapshot().records[0]!.props as { text: ReturnType<typeof richTextFromString> }).text);
    expect(leftText).toBe(rightText); expect(leftText).toMatch(/^A(?:LR|RL)B$/u);
    seed.destroy(); left.destroy(); right.destroy();
  });

  it('stores table cell text in Y.Text', () => {
    const value = engine(); const definition = value.registry.get('table'); const props = definition.defaults() as { columns: { id: string }[]; rows: unknown[] };
    props.rows = [{ id: 'row', cells: {} }]; value.dispatch({ type: 'shape.create', record: value.registry.validate({ id: 'table', type: 'table', typeVersion: 1, parentId: ROOT_PARENT_ID, index: 'a0', x: 0, y: 0, rotation: 0, opacity: 1, locked: false, hidden: false, props }) });
    value.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: 'row', columnId: props.columns[0]!.id, text: 'Cell' });
    const snapshot = value.getSnapshot(); expect((snapshot.records[0]!.props as { rows: { cells: Record<string, string> }[] }).rows[0]!.cells[props.columns[0]!.id]).toBe('Cell'); value.destroy();
  });

  it('converges concurrent edits to independent table cells', () => {
    const seed = engine(); const definition = seed.registry.get('table');
    const props = definition.defaults() as { columns: { id: string; title: string; width: number }[]; rows: { id: string; cells: Record<string, string> }[] };
    props.columns = [{ id: 'first', title: 'First', width: 160 }, { id: 'second', title: 'Second', width: 160 }]; props.rows = [{ id: 'row', cells: {} }];
    seed.dispatch({ type: 'shape.create', record: seed.registry.validate({ id: 'table', type: 'table', typeVersion: 1, parentId: ROOT_PARENT_ID, index: 'a0', x: 0, y: 0, rotation: 0, opacity: 1, locked: false, hidden: false, props }) });
    const state = seed.encodeState(); const vector = seed.encodeStateVector(); const left = engine(state); const right = engine(state);
    left.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: 'row', columnId: 'first', text: 'Left' });
    right.dispatch({ type: 'table.cell.set', shapeId: 'table', rowId: 'row', columnId: 'second', text: 'Right' });
    const leftUpdate = left.encodeDiff(vector); const rightUpdate = right.encodeDiff(vector); left.applyRemoteUpdate(rightUpdate); right.applyRemoteUpdate(leftUpdate);
    const cells = (left.getSnapshot().records[0]!.props as typeof props).rows[0]!.cells;
    expect(cells).toEqual({ first: 'Left', second: 'Right' }); expect(right.getSnapshot()).toEqual(left.getSnapshot());
    seed.destroy(); left.destroy(); right.destroy();
  });
});
