import * as Y from 'yjs';
import { z } from 'zod';

const textMarkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['bold', 'italic', 'strike', 'code']) }),
  z.object({ type: z.literal('link'), href: z.url().max(2_048).refine((value) => { const protocol = new URL(value).protocol; return protocol === 'http:' || protocol === 'https:'; }, 'Only HTTP and HTTPS links are allowed') }),
]);

export const richTextDocumentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.object({
    type: z.enum(['paragraph', 'bullet-item', 'ordered-item']),
    align: z.enum(['left', 'center', 'right']).default('left'),
    content: z.array(z.object({
      text: z.string().max(20_000),
      marks: z.array(textMarkSchema).max(8).default([]),
    })).max(1_000),
  })).max(1_000),
});

export type RichTextDocument = z.infer<typeof richTextDocumentSchema>;
export function plainText(document: RichTextDocument): string { return document.content.map((block) => block.content.map((run) => run.text).join('')).join('\n'); }
export function richTextFromString(text = '', align: 'left' | 'center' | 'right' = 'left'): RichTextDocument { return { type: 'doc', content: [{ type: 'paragraph', align, content: [{ text, marks: [] }] }] }; }

function markAttributes(marks: RichTextDocument['content'][number]['content'][number]['marks']): Record<string, unknown> {
  return Object.fromEntries(marks.map((mark) => mark.type === 'link' ? ['link', { href: mark.href }] : [mark.type, {}]));
}

function appendParagraph(parent: Y.XmlFragment | Y.XmlElement, block: RichTextDocument['content'][number]): void {
  const paragraph = new Y.XmlElement('paragraph');
  parent.insert(parent.length, [paragraph]);
  paragraph.setAttribute('align', block.align);
  block.content.forEach((run) => {
    const lines = run.text.split('\n');
    lines.forEach((line, index) => {
      if (line) { const text = new Y.XmlText(); paragraph.insert(paragraph.length, [text]); text.insert(0, line, markAttributes(run.marks)); }
      if (index < lines.length - 1) paragraph.insert(paragraph.length, [new Y.XmlElement('hard_break')]);
    });
  });
}

export function writeRichText(fragment: Y.XmlFragment, value: unknown): RichTextDocument {
  const document = richTextDocumentSchema.parse(value);
  if (fragment.length) fragment.delete(0, fragment.length);
  document.content.forEach((block) => {
    if (block.type === 'paragraph') { appendParagraph(fragment, block); return; }
    const list = new Y.XmlElement(block.type === 'bullet-item' ? 'bullet_list' : 'ordered_list');
    fragment.insert(fragment.length, [list]);
    const item = new Y.XmlElement('list_item'); list.insert(0, [item]); appendParagraph(item, { ...block, type: 'paragraph' });
  });
  return document;
}

function readRuns(text: Y.XmlText): RichTextDocument['content'][number]['content'] {
  const runs: RichTextDocument['content'][number]['content'] = [];
  (text.toDelta() as { insert?: unknown; attributes?: Record<string, unknown> }[]).forEach((delta) => {
    const value = typeof delta.insert === 'string' ? delta.insert : ''; if (!value) return;
    const marks: RichTextDocument['content'][number]['content'][number]['marks'] = [];
    Object.entries(delta.attributes ?? {}).forEach(([type, attribute]) => {
      if (type === 'link' && attribute && typeof attribute === 'object' && 'href' in attribute) marks.push({ type: 'link', href: String((attribute as { href: unknown }).href) });
      else if (type === 'bold' || type === 'italic' || type === 'strike' || type === 'code') marks.push({ type });
    });
    runs.push({ text: value, marks });
  });
  return runs;
}

function readParagraph(element: Y.XmlElement, type: 'paragraph' | 'bullet-item' | 'ordered-item'): RichTextDocument['content'][number] {
  const content: RichTextDocument['content'][number]['content'] = [];
  const push = (run: RichTextDocument['content'][number]['content'][number]) => {
    const previous = content.at(-1);
    if (previous && JSON.stringify(previous.marks) === JSON.stringify(run.marks)) previous.text += run.text;
    else content.push(run);
  };
  element.toArray().forEach((node) => {
    if (node instanceof Y.XmlText) readRuns(node).forEach(push);
    else if (node instanceof Y.XmlElement && node.nodeName === 'hard_break') {
      const previous = content.at(-1);
      if (previous) previous.text += '\n';
      else content.push({ text: '\n', marks: [] });
    }
  });
  const align = element.getAttribute('align');
  return { type, align: align === 'center' || align === 'right' ? align : 'left', content: content.length ? content : [{ text: '', marks: [] }] };
}

export function readRichText(fragment: Y.XmlFragment): RichTextDocument {
  const content: RichTextDocument['content'] = [];
  fragment.toArray().forEach((node) => {
    if (!(node instanceof Y.XmlElement)) return;
    if (node.nodeName === 'paragraph') content.push(readParagraph(node, 'paragraph'));
    if (node.nodeName === 'bullet_list' || node.nodeName === 'ordered_list') {
      node.toArray()
        .filter((child): child is Y.XmlElement => child instanceof Y.XmlElement && child.nodeName === 'list_item')
        .forEach((item) => {
          const paragraph = item.toArray().find((child): child is Y.XmlElement => child instanceof Y.XmlElement && child.nodeName === 'paragraph');
          if (paragraph) content.push(readParagraph(paragraph, node.nodeName === 'bullet_list' ? 'bullet-item' : 'ordered-item'));
        });
    }
  });
  return richTextDocumentSchema.parse({ type: 'doc', content: content.length ? content : richTextFromString('').content });
}
