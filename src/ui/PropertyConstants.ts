// ─── Colour palettes (single source of truth) ─────────────────────────────────
// #64748b (slate-500) is the first entry: neutral grey visible in both dark and light mode.
export const STROKE_COLORS = [
  '#64748b', '#f87171', '#4ade80', '#60a5fa',
  '#fbbf24', '#a78bfa', '#f472b6', '#94a3b8',
];

export const FILL_COLORS = [
  'transparent',
  '#7f1d1d', '#14532d', '#1e3a8a', '#713f12',
  '#4c1d95', '#831843', '#1e293b',
];

export const ICONS = {
  strokeWidth: [
    { val: '1.8', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="1.2"/></svg>` },
    { val: '3.5', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2.5"/></svg>` },
    { val: '6',   svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="4"/></svg>` }
  ],
  strokeStyle: [
    { val: 'solid', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2"/></svg>` },
    { val: 'dashed', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2" stroke-dasharray="4 4"/></svg>` },
    { val: 'dotted', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/></svg>` }
  ],
  roughness: [
    { val: '0', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4,12 10,12 14,12 20,12" stroke-width="2"/></svg>` },
    { val: '1', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12c4-2 4 2 8 0s4 2 8 0" stroke-width="2"/></svg>` },
    { val: '2', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12c3-4 5 4 8 0s5 4 8 0" stroke-width="2"/></svg>` }
  ],
  roundness: [
    { val: 'sharp', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="6" y="6" width="12" height="12" stroke-width="2"/></svg>` },
    { val: 'round', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="6" y="6" width="12" height="12" rx="3" stroke-width="2"/></svg>` }
  ],
  edgeStyle: [
    { val: 'straight', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="5" x2="19" y2="19" stroke-width="2"/></svg>` },
    { val: 'elbow', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="5,5 5,19 19,19" fill="none" stroke-width="2"/></svg>` }
  ],
  arrowhead: [
    { val: 'none', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2"/></svg>` },
    { val: 'arrow', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2"/><polyline points="14,6 20,12 14,18" stroke-width="2"/></svg>` },
    { val: 'triangle', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2"/><polygon points="14,6 20,12 14,18" fill="currentColor"/></svg>` },
    { val: 'circle', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="16" y2="12" stroke-width="2"/><circle cx="18" cy="12" r="3" fill="currentColor"/></svg>` },
    { val: 'diamond', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="16" y2="12" stroke-width="2"/><polygon points="18,9 21,12 18,15 15,12" fill="currentColor"/></svg>` },
    { val: 'bar', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2"/><line x1="20" y1="6" x2="20" y2="18" stroke-width="2"/></svg>` }
  ],
  layers: [
    { val: 'back', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8L12 3L21 8L12 13L3 8Z"/><path d="M3 16L12 21L21 16"/><path d="M12 13V21"/></svg>` },
    { val: 'backward', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5V19M19 12l-7 7-7-7"/></svg>` },
    { val: 'forward', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>` },
    { val: 'front', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16L12 21L3 16"/><path d="M3 8L12 13L21 8L12 3L3 8Z"/><path d="M12 13V3"/></svg>` },
  ],
  align: [
    { val: 'left', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="4" x2="4" y2="20"/><line x1="8" y1="10" x2="20" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>` },
    { val: 'center', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="4" x2="12" y2="20"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>` },
    { val: 'right', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="20" y1="4" x2="20" y2="20"/><line x1="4" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>` },
    { val: 'top', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="4" x2="20" y2="4"/><line x1="10" y1="8" x2="10" y2="20"/><line x1="14" y1="8" x2="14" y2="16"/></svg>` },
    { val: 'middle', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="12" x2="20" y2="12"/><line x1="10" y1="6" x2="10" y2="18"/><line x1="14" y1="8" x2="14" y2="16"/></svg>` },
    { val: 'bottom', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="20" x2="20" y2="20"/><line x1="10" y1="4" x2="10" y2="16"/><line x1="14" y1="8" x2="14" y2="16"/></svg>` },
  ],
  actions: [
    { val: 'duplicate', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` },
    { val: 'delete', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>` },
    { val: 'group', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/><path d="M10 10l4 4"/></svg>` },
    { val: 'ungroup', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/><path d="M10 10l4 4"/><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.5"/></svg>` },
    { val: 'toggle-lock', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` },
  ]
};

export const SHAPE_PROPERTIES: Record<string, string[]> = {
  rectangle: ['stroke', 'fill', 'roundness', 'layer', 'action'],
  ellipse: ['stroke', 'fill', 'layer', 'action'],
  arrow: ['stroke', 'layer', 'action'],
  line: ['stroke', 'layer', 'action'],
  freehand: ['stroke', 'layer', 'action'],
  text: ['stroke', 'layer', 'action'],
  image: ['layer', 'action']
};

import { PluginRegistry } from '../plugins/PluginRegistry';

/**
 * Returns the property panel keys for a shape type.
 * Prefers the plugin's declared defaultProperties, falls back to the legacy SHAPE_PROPERTIES map.
 */
export function getShapePropertyKeys(type: string): string[] {
  const fromPlugin = PluginRegistry.getDefaultProperties(type);
  if (fromPlugin.length > 0) return fromPlugin;
  return SHAPE_PROPERTIES[type] ?? ['layer', 'action'];
}
