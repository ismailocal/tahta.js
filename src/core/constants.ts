import { PluginRegistry } from '../plugins/PluginRegistry';
import type { Shape } from './types';

export const STYLE_PRESETS: Record<string, any> = {
  rectangle: { stroke: '#64748b', fill: 'transparent', strokeWidth: 1.8, roughness: 0, roundness: 'sharp', opacity: 1 },
  ellipse: { stroke: '#64748b', fill: 'transparent', strokeWidth: 1.8, roughness: 0, opacity: 1 },
  line:        { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, opacity: 1 },
  'line-dashed': { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, opacity: 1, strokeStyle: 'dashed' },
  'line-dotted': { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, opacity: 1, strokeStyle: 'dotted' },
  arrow:         { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, edgeStyle: 'straight', startArrowhead: 'none',    endArrowhead: 'arrow',    opacity: 1 },
  'arrow-double': { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, edgeStyle: 'straight', startArrowhead: 'arrow',   endArrowhead: 'arrow',    opacity: 1 },
  'arrow-elbow':  { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, edgeStyle: 'elbow',    startArrowhead: 'none',    endArrowhead: 'arrow',    opacity: 1 },
  'arrow-curved': { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, edgeStyle: 'curved',   startArrowhead: 'none',    endArrowhead: 'arrow',    opacity: 1 },
  'arrow-filled': { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, edgeStyle: 'straight', startArrowhead: 'none',    endArrowhead: 'triangle', opacity: 1 },
  freehand:               { stroke: '#64748b', strokeWidth: 1,  roughness: 0, opacity: 1 },
  'freehand-thick':       { stroke: '#64748b', strokeWidth: 4,  roughness: 0, opacity: 1 },
  'freehand-highlighter': { stroke: '#fde047', strokeWidth: 14, roughness: 0, opacity: 0.35 },
  text: { stroke: '#64748b', fontSize: 24, opacity: 1 },
};

export type ToolbarItem = {
  key: string;
  label?: string;
  shortcut?: string;
  icon?: string;
  isSeparator?: boolean;
  isDropdown?: boolean;
  children?: ToolbarItem[];
};

export const TOOLBAR_ITEMS: ToolbarItem[] = [
  { key: 'hand', label: 'Hand', shortcut: 'H', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v4H14V5a2 2 0 0 0-4 0v5H10V4a2 2 0 0 0-4 0v10a6 6 0 0 0 12 0z"></path></svg>` },
  { key: 'select', label: 'Select', shortcut: 'V', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l7.07 16.97 2.51-7.39 7.39-2.51L4 4z"/></svg>` },
  {
    key: 'shapes-group', label: 'Shapes', shortcut: 'R', isDropdown: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
    children: [
      { key: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>` },
      { key: 'ellipse',   label: 'Ellipse',   shortcut: 'E', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>` },
      { key: 'diamond',   label: 'Diamond',   shortcut: 'D', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 12 12 22 2 12"/></svg>` },
    ],
  },
  {
    key: 'arrows-group', label: 'Arrows', shortcut: 'A', isDropdown: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/></svg>`,
    children: [
      { key: 'arrow',         label: 'Arrow',         shortcut: 'A', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/></svg>` },
      { key: 'arrow-double',  label: 'Double Arrow',  shortcut: '',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="11 5 4 12 11 19"/><polyline points="13 5 20 12 13 19"/></svg>` },
      { key: 'arrow-elbow',   label: 'Elbow Arrow',   shortcut: '',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 18 4 6 20 6"/><polyline points="13 1 20 6 13 11"/></svg>` },
      { key: 'arrow-curved',  label: 'Curved Arrow',  shortcut: '',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18 Q12 4 20 12"/><polyline points="14 7 20 12 15 17"/></svg>` },
      { key: 'arrow-filled',  label: 'Filled Arrow',  shortcut: '',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="17" y2="12"/><polygon points="17 7 23 12 17 17" fill="currentColor"/></svg>` },
    ],
  },
  {
    key: 'lines-group', label: 'Lines', shortcut: 'L', isDropdown: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>`,
    children: [
      { key: 'line',        label: 'Line',        shortcut: 'L', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>` },
      { key: 'line-dashed', label: 'Dashed Line', shortcut: '',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 3"><line x1="4" y1="20" x2="20" y2="4"/></svg>` },
      { key: 'line-dotted', label: 'Dotted Line', shortcut: '',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1.5 4"><line x1="4" y1="20" x2="20" y2="4"/></svg>` },
    ],
  },
  {
    key: 'draw-group', label: 'Draw', shortcut: 'P', isDropdown: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
    children: [
      { key: 'freehand',               label: 'Pen',         shortcut: 'P', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>` },
      { key: 'freehand-thick',         label: 'Thick Pen',   shortcut: '',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"    stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>` },
      { key: 'freehand-highlighter',   label: 'Highlighter', shortcut: '',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="18" height="8" rx="2" opacity="0.5" fill="currentColor"/><line x1="8" y1="18" x2="6" y2="22"/><line x1="16" y1="18" x2="18" y2="22"/></svg>` },
    ],
  },
  { key: 'text', label: 'Text', shortcut: 'T', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3M12 4v16M9 20h6"/></svg>` },
  { key: 'image', label: 'Image', shortcut: 'I', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>` },
  {
    key: 'db-group', label: 'Database', shortcut: 'B', isDropdown: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>`,
    children: [
      { key: 'db-table', label: 'Table', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>` },
      { key: 'db-view', label: 'View', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>` },
      { key: 'db-enum', label: 'Enum', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><circle cx="6" cy="9" r="1.5" fill="currentColor"/><circle cx="6" cy="15" r="1.5" fill="currentColor"/><line x1="11" y1="9" x2="19" y2="9"/><line x1="11" y1="15" x2="19" y2="15"/></svg>` },
    ],
  },
  {
    key: 'templates-group', label: 'Templates', shortcut: '', isDropdown: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    children: [
      { key: 'template-decision-tree', label: 'Karar Ağacı',      shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 21 12 12 21 3 12"/><line x1="3" y1="12" x2="3" y2="18"/><line x1="21" y1="12" x2="21" y2="18"/><rect x="0" y="18" width="6" height="4" rx="1"/><rect x="18" y="18" width="6" height="4" rx="1"/></svg>` },
      { key: 'template-flowchart',     label: 'Akış Şeması',       shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="4" rx="5" ry="2.5"/><rect x="7" y="9" width="10" height="5" rx="1"/><polygon points="12 17 17 21 7 21"/><line x1="12" y1="6.5" x2="12" y2="9"/><line x1="12" y1="14" x2="12" y2="17"/></svg>` },
      { key: 'template-db-schema',     label: 'DB Şeması',         shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="8" height="14" rx="1"/><rect x="14" y="4" width="8" height="14" rx="1"/><line x1="2" y1="9" x2="10" y2="9"/><line x1="14" y1="9" x2="22" y2="9"/><line x1="10" y1="11" x2="14" y2="11"/></svg>` },
      { key: 'template-user-flow',     label: 'Kullanıcı Akışı',   shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/><rect x="17" y="9" width="6" height="5" rx="1"/><line x1="6" y1="11.5" x2="9" y2="11.5"/><line x1="14" y1="11.5" x2="17" y2="11.5"/></svg>` },
      { key: 'template-mind-map',      label: 'Mind Map',           shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="9" width="8" height="6" rx="1"/><rect x="1" y="4" width="5" height="4" rx="1"/><rect x="1" y="16" width="5" height="4" rx="1"/><rect x="18" y="4" width="5" height="4" rx="1"/><rect x="18" y="16" width="5" height="4" rx="1"/><line x1="8" y1="11" x2="6" y2="6"/><line x1="8" y1="14" x2="6" y2="18"/><line x1="16" y1="11" x2="18" y2="6"/><line x1="16" y1="14" x2="18" y2="18"/></svg>` },
    ],
  },
  { key: 'eraser', label: 'Eraser', shortcut: 'X', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z"/></svg>` },
  { isSeparator: true, key: 'sep1' },
  { key: 'undo', label: 'Geri Al', shortcut: 'Ctrl+Z', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>` },
  { key: 'redo', label: 'İleri Al', shortcut: 'Ctrl+Y', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>` },
  { key: 'export', label: 'JSON Dışa Aktar', shortcut: 'Alt+S', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>` },
];

/**
 * Returns the default style for a shape type.
 * Prefers the plugin's declared defaultStyle, falls back to the legacy STYLE_PRESETS map.
 */
export function getStylePreset(type: string): Partial<Shape> {
  const fromPlugin = PluginRegistry.getDefaultStyle(type);
  if (Object.keys(fromPlugin).length > 0) return fromPlugin;
  return STYLE_PRESETS[type] ?? {};
}
