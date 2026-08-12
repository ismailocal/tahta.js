import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { plainText, readRichText, richTextDocumentSchema, richTextFromString, writeRichText } from './richText';

describe('collaborative rich text', () => {
  it('round-trips paragraphs, lists, marks, links and hard breaks', () => {
    const document = richTextDocumentSchema.parse({
      type: 'doc',
      content: [
        { type: 'paragraph', align: 'right', content: [{ text: 'A\nB', marks: [{ type: 'bold' }, { type: 'link', href: 'https://tahta.io' }] }] },
        { type: 'bullet-item', content: [{ text: 'Bullet', marks: [{ type: 'italic' }] }] },
        { type: 'ordered-item', align: 'center', content: [{ text: 'Ordered', marks: [{ type: 'strike' }, { type: 'code' }] }] },
      ],
    });
    const ydoc = new Y.Doc();
    const fragment = ydoc.getXmlFragment('content');
    expect(writeRichText(fragment, document)).toEqual(document);
    expect(readRichText(fragment)).toEqual(document);
    expect(plainText(document)).toBe('A\nB\nBullet\nOrdered');
    ydoc.destroy();
  });

  it('normalizes empty content and rejects unsafe links', () => {
    expect(richTextFromString()).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', align: 'left', content: [{ text: '', marks: [] }] }],
    });
    const ydoc = new Y.Doc();
    expect(readRichText(ydoc.getXmlFragment('empty'))).toEqual(richTextFromString());
    expect(() => richTextDocumentSchema.parse({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ text: 'bad', marks: [{ type: 'link', href: 'javascript:alert(1)' }] }] }],
    })).toThrow('Only HTTP and HTTPS links are allowed');
    ydoc.destroy();
  });
});
