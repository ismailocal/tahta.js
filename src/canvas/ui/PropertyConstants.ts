// ─── Colour palettes (single source of truth) ─────────────────────────────────
// #64748b (slate-500) is the first entry: neutral grey visible in both dark and light mode.
export const STROKE_COLORS = [
  '#000000', '#64748b', '#f87171', '#4ade80', '#60a5fa',
  '#fbbf24', '#a78bfa', '#f472b6', '#94a3b8',
];

export const FILL_COLORS = [
  'transparent',
  '#64748b', '#f87171', '#4ade80', '#60a5fa',
  '#fbbf24', '#a78bfa', '#f472b6', '#94a3b8',
];

export const CANVAS_COLORS = [
  '#ffffff', '#f1f5f9', '#e2e8f0', // Whites/Greys
  '#fff7ed', '#fef2f2', '#f0fdf4', '#eff6ff', // Light tints
];

import { ICONS as CENTRAL_ICONS } from '../../core/icons';

export const ICONS = {
  strokeWidth: [
    { val: '1.8', svg: CENTRAL_ICONS.strokeWidth.thin },
    { val: '3.5', svg: CENTRAL_ICONS.strokeWidth.medium },
    { val: '6', svg: CENTRAL_ICONS.strokeWidth.thick },
  ],
  strokeStyle: [
    { val: 'solid', svg: CENTRAL_ICONS.strokeStyle.solid },
    { val: 'dashed', svg: CENTRAL_ICONS.strokeStyle.dashed },
    { val: 'dotted', svg: CENTRAL_ICONS.strokeStyle.dotted },
  ],
  roughness: [
    { val: '0', svg: CENTRAL_ICONS.roughness.none },
    { val: '1', svg: CENTRAL_ICONS.roughness.low },
    { val: '2', svg: CENTRAL_ICONS.roughness.high },
  ],
  roundness: [
    { val: 'sharp', svg: CENTRAL_ICONS.roundness.sharp },
    { val: 'round', svg: CENTRAL_ICONS.roundness.round },
  ],
  edgeStyle: [
    { val: 'straight', svg: CENTRAL_ICONS.edgeStyle.straight },
    { val: 'curved', svg: CENTRAL_ICONS.edgeStyle.curved },
  ],
  arrowhead: [
    { val: 'none', svg: CENTRAL_ICONS.arrowhead.none },
    { val: 'arrow', svg: CENTRAL_ICONS.arrowhead.arrow },
    { val: 'triangle', svg: CENTRAL_ICONS.arrowhead.triangle },
    { val: 'circle', svg: CENTRAL_ICONS.arrowhead.circle },
    { val: 'diamond', svg: CENTRAL_ICONS.arrowhead.diamond },
    { val: 'bar', svg: CENTRAL_ICONS.arrowhead.bar },
  ],
  layers: [
    { val: 'back', svg: CENTRAL_ICONS.layers.back },
    { val: 'backward', svg: CENTRAL_ICONS.layers.backward },
    { val: 'forward', svg: CENTRAL_ICONS.layers.forward },
    { val: 'front', svg: CENTRAL_ICONS.layers.front },
  ],
  align: [
    { val: 'left', svg: CENTRAL_ICONS.align.left },
    { val: 'center', svg: CENTRAL_ICONS.align.center },
    { val: 'right', svg: CENTRAL_ICONS.align.right },
    { val: 'top', svg: CENTRAL_ICONS.valign.top },
    { val: 'middle', svg: CENTRAL_ICONS.valign.middle },
    { val: 'bottom', svg: CENTRAL_ICONS.valign.bottom },
  ],
  actions: [
    { val: 'duplicate', svg: CENTRAL_ICONS.actions.duplicate },
    { val: 'delete', svg: CENTRAL_ICONS.actions.delete },
    { val: 'toggle-lock', svg: CENTRAL_ICONS.actions.lock },
    { val: 'create-template', svg: CENTRAL_ICONS.actions.createTemplate },
  ],
};

export const SHAPE_PROPERTIES: Record<string, string[]> = {
  rectangle: ['stroke', 'fill', 'roundness', 'cornerRadius', 'roughness', 'layer', 'action'],
  ellipse: ['stroke', 'fill', 'roughness', 'layer', 'action'],
  diamond: ['stroke', 'fill', 'cornerRadius', 'roughness', 'layer', 'action'],
  triangle: ['stroke', 'fill', 'cornerRadius', 'roughness', 'layer', 'action'],
  arrow: ['stroke', 'edgeStyle', 'startArrowhead', 'endArrowhead', 'roughness', 'layer', 'action'],
  freehand: ['stroke', 'strokeWidth', 'opacity', 'layer', 'action'],
  text: ['stroke', 'roughness', 'layer', 'action'],
  image: ['layer', 'action']
};

import { PluginRegistry } from '../../plugins/PluginRegistry';

/**
 * Returns the property panel keys for a shape type.
 * Prefers the plugin's declared defaultProperties, falls back to the legacy SHAPE_PROPERTIES map.
 */
export function getShapePropertyKeys(type: string): string[] {
  const fromPlugin = PluginRegistry.getDefaultProperties(type);
  if (fromPlugin.length > 0) return fromPlugin;
  return SHAPE_PROPERTIES[type] ?? ['layer', 'action'];
}
