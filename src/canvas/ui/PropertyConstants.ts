// ─── Colour palettes (single source of truth) ─────────────────────────────────
// #64748b (slate-500) is the first entry: neutral grey visible in both dark and light mode.
export const STROKE_COLORS = [
  '#000000', '#64748b', '#f87171', '#4ade80', '#60a5fa',
  '#fbbf24', '#a78bfa', '#f472b6', '#94a3b8',
];

const FILL_COLORS_LIGHT = [
  'transparent',
  '#e2e8f0', '#fecaca', '#bbf7d0', '#bfdbfe',
  '#fde68a', '#ddd6fe', '#fbcfe8', '#cbd5e1',
];

const FILL_COLORS_DARK = [
  'transparent',
  '#334155', '#7f1d1d', '#14532d', '#1e3a5f',
  '#713f12', '#3b0764', '#831843', '#374151',
];

export function getFillColors(theme: 'light' | 'dark'): string[] {
  return theme === 'dark' ? FILL_COLORS_DARK : FILL_COLORS_LIGHT;
}

const SHAPE_PROPERTIES: Record<string, string[]> = {
  rectangle: ['stroke', 'fill', 'roundness', 'cornerRadius', 'roughness', 'layer', 'action'],
  ellipse: ['stroke', 'fill', 'roughness', 'layer', 'action'],
  diamond: ['stroke', 'fill', 'cornerRadius', 'roughness', 'layer', 'action'],
  triangle: ['stroke', 'fill', 'cornerRadius', 'roughness', 'layer', 'action'],
  arrow: ['stroke', 'edgeStyle', 'startArrowhead', 'endArrowhead', 'roughness', 'layer', 'action'],
  freehand: ['stroke', 'strokeWidth', 'opacity', 'layer', 'action'],
  text: ['stroke', 'roughness', 'layer', 'action'],
  image: ['layer', 'action']
};

import type { ShapeRegistry } from '../../core/registry';
import { getShapePlugin } from '../../plugins/index';

/**
 * Returns the property panel keys for a shape type.
 * Prefers the plugin's declared defaultProperties, falls back to the legacy SHAPE_PROPERTIES map.
 */
export function getShapePropertyKeys(type: string, registry: ShapeRegistry): string[] {
  const fromPlugin = getShapePlugin(registry, type).defaultProperties ?? [];
  if (fromPlugin.length > 0) return [...fromPlugin];
  return SHAPE_PROPERTIES[type] ?? ['layer', 'action'];
}
