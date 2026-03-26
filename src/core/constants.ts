export const STYLE_PRESETS: Record<string, any> = {
  rectangle: { stroke: '#8b5cf6', fill: 'transparent', strokeWidth: 1, roughness: 0, roundness: 'sharp', opacity: 1 },
  ellipse: { stroke: '#06b6d4', fill: 'transparent', strokeWidth: 1, roughness: 0, opacity: 1 },
  line: { stroke: '#f8fafc', strokeWidth: 1, roughness: 0, edgeStyle: 'straight', opacity: 1 },
  arrow: { stroke: '#e5e7eb', strokeWidth: 1, roughness: 0, edgeStyle: 'straight', startArrowhead: 'none', endArrowhead: 'arrow', opacity: 1 },
  freehand: { stroke: '#f59e0b', strokeWidth: 1, roughness: 0, opacity: 1 },
  text: { stroke: '#f8fafc', fontSize: 24, opacity: 1 },
};

export type ToolbarItem = {
  key: string;
  label?: string;
  shortcut?: string;
  icon?: string;
  isSeparator?: boolean;
};

export const TOOLBAR_ITEMS: ToolbarItem[] = [
  { key: 'hand', label: 'Hand', shortcut: 'H', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v4H14V5a2 2 0 0 0-4 0v5H10V4a2 2 0 0 0-4 0v10a6 6 0 0 0 12 0z"></path></svg>` },
  { key: 'select', label: 'Select', shortcut: 'V', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l7.07 16.97 2.51-7.39 7.39-2.51L4 4z"/></svg>` },
  { key: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>` },
  { key: 'ellipse', label: 'Ellipse', shortcut: 'E', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>` },
  { key: 'arrow', label: 'Arrow', shortcut: 'A', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/></svg>` },
  { key: 'line', label: 'Line', shortcut: 'L', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>` },
  { key: 'freehand', label: 'Draw', shortcut: 'P', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>` },
  { key: 'text', label: 'Text', shortcut: 'T', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3M12 4v16M9 20h6"/></svg>` },
  { key: 'image', label: 'Image', shortcut: 'I', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>` },
  { key: 'eraser', label: 'Eraser', shortcut: 'X', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z"/></svg>` },
  { isSeparator: true, key: 'sep1' },
  { key: 'undo', label: 'Geri Al', shortcut: 'Ctrl+Z', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>` },
  { key: 'redo', label: 'İleri Al', shortcut: 'Ctrl+Y', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>` },
  { key: 'export', label: 'JSON Dışa Aktar', shortcut: 'Alt+S', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>` },
];
