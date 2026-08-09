import { useEffect, useMemo, useRef, useState } from 'react';
import { baseKeymap, setBlockType, toggleMark } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { Schema, type DOMOutputSpec, type MarkType, type Node as ProseMirrorNode } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes, wrapInList } from 'prosemirror-schema-list';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { yCursorPlugin, ySyncPlugin, yUndoPlugin, undo, redo } from 'y-prosemirror';
import type { Awareness } from 'y-protocols/awareness';
import type { CanvasEngine } from '../core/index.js';

const paragraph = {
  ...basicSchema.spec.nodes.get('paragraph')!,
  attrs: { align: { default: 'left' } },
  parseDOM: [{ tag: 'p', getAttrs: (node: HTMLElement) => ({ align: ['left', 'center', 'right'].includes(node.style.textAlign) ? node.style.textAlign : 'left' }) }],
  toDOM: (node: ProseMirrorNode): DOMOutputSpec => ['p', { style: `text-align:${String(node.attrs.align)}` }, 0],
};
const nodes = addListNodes(basicSchema.spec.nodes.update('paragraph', paragraph), 'paragraph block*', 'block');
const marks = basicSchema.spec.marks
  .remove('strong')
  .remove('em')
  .addToEnd('bold', basicSchema.spec.marks.get('strong')!)
  .addToEnd('italic', basicSchema.spec.marks.get('em')!)
  .addToEnd('strike', { parseDOM: [{ tag: 's' }, { style: 'text-decoration=line-through' }], toDOM: (): DOMOutputSpec => ['s', 0] });
const editorSchema = new Schema({ nodes, marks });

export interface RichTextEditorProps {
  engine: CanvasEngine;
  shapeId: string;
  field?: 'text' | 'label';
  awareness?: Awareness;
  className?: string;
  onClose?: () => void;
  readonly?: boolean;
}

export function RichTextEditor({ engine, shapeId, field = 'text', awareness, className, onClose, readonly = false }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [linkHref, setLinkHref] = useState('https://');
  const [linkError, setLinkError] = useState('');
  const fragment = useMemo(() => engine.getRichTextFragment(shapeId, field), [engine, field, shapeId]);
  const collaborativeAwareness = awareness ?? engine.awareness;

  useEffect(() => {
    const root = editorRef.current; if (!root) throw new Error('Rich text editor root is unavailable');
    const hardBreak = (state: EditorState, dispatch?: EditorView['dispatch']) => { const node = editorSchema.nodes.hard_break; if (!node) return false; dispatch?.(state.tr.replaceSelectionWith(node.create()).scrollIntoView()); return true; };
    const plugins = [ySyncPlugin(fragment), yCursorPlugin(collaborativeAwareness), yUndoPlugin(), keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo, 'Shift-Enter': hardBreak }), keymap(baseKeymap)];
    const view = new EditorView(root, {
      state: EditorState.create({ schema: editorSchema, plugins }),
      editable: () => !readonly,
    });
    viewRef.current = view; if (!readonly) view.focus();
    return () => { viewRef.current = null; view.destroy(); };
  }, [collaborativeAwareness, fragment, readonly]);

  useEffect(() => {
    const controls = toolbarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
    controls?.forEach((control, index) => { control.tabIndex = index === 0 ? 0 : -1; });
  }, [readonly]);

  const runMark = (mark: MarkType) => { const view = viewRef.current; if (view) toggleMark(mark)(view.state, view.dispatch, view); };
  const runList = (name: 'bullet_list' | 'ordered_list') => { const view = viewRef.current; if (view) wrapInList(editorSchema.nodes[name]!)(view.state, view.dispatch, view); };
  const runAlignment = (align: 'left' | 'center' | 'right') => { const view = viewRef.current; if (view) setBlockType(editorSchema.nodes.paragraph!, { align })(view.state, view.dispatch, view); };
  const applyLink = () => {
    const view = viewRef.current; if (!view) return;
    try {
      const url = new URL(linkHref); if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only HTTP and HTTPS links are allowed');
      setLinkError(''); toggleMark(editorSchema.marks.link!, { href: url.toString() })(view.state, view.dispatch, view);
    } catch (error) { setLinkError(error instanceof Error ? error.message : 'Invalid link URL'); }
  };

  return (
    <div className={className ?? 'tahta-rich-editor'} role="dialog" aria-label="Rich text editor" onKeyDown={(event) => { if (event.key === 'Escape') onClose?.(); }}>
      <div ref={toolbarRef} className="tahta-rich-toolbar" role="toolbar" aria-label="Text formatting" onFocusCapture={(event) => {
        const controls = [...toolbarRef.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')];
        controls.forEach((control) => { control.tabIndex = control === event.target ? 0 : -1; });
      }} onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const controls = [...toolbarRef.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')]; const current = controls.indexOf(document.activeElement as HTMLElement); if (current < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + controls.length) % controls.length;
        controls.forEach((control, index) => { control.tabIndex = index === next ? 0 : -1; }); controls[next]?.focus();
      }}>
        <button type="button" disabled={readonly} onClick={() => runMark(editorSchema.marks.bold!)} aria-label="Bold"><strong>B</strong></button>
        <button type="button" disabled={readonly} onClick={() => runMark(editorSchema.marks.italic!)} aria-label="Italic"><em>I</em></button>
        <button type="button" disabled={readonly} onClick={() => runMark(editorSchema.marks.strike!)} aria-label="Strikethrough"><s>S</s></button>
        <button type="button" disabled={readonly} onClick={() => runMark(editorSchema.marks.code!)} aria-label="Inline code">{'</>'}</button>
        <button type="button" disabled={readonly} onClick={() => runList('bullet_list')} aria-label="Bulleted list">• List</button>
        <button type="button" disabled={readonly} onClick={() => runList('ordered_list')} aria-label="Numbered list">1. List</button>
        <button type="button" disabled={readonly} onClick={() => runAlignment('left')} aria-label="Align left">Left</button>
        <button type="button" disabled={readonly} onClick={() => runAlignment('center')} aria-label="Align center">Center</button>
        <button type="button" disabled={readonly} onClick={() => runAlignment('right')} aria-label="Align right">Right</button>
        <input type="url" disabled={readonly} value={linkHref} onChange={(event) => setLinkHref(event.target.value)} aria-label="Link URL" />
        <button type="button" disabled={readonly} onClick={applyLink} aria-label="Apply link">Link</button>
        <button type="button" disabled={readonly} onClick={() => runMark(editorSchema.marks.link!)} aria-label="Remove link">Unlink</button>
        {onClose && <button type="button" onClick={onClose} aria-label="Close editor">Done</button>}
      </div>
      {linkError && <div className="tahta-rich-error" role="alert">{linkError}</div>}
      <div ref={editorRef} className="tahta-rich-content" />
    </div>
  );
}
