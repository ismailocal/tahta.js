import { PluginRegistry } from '../plugins/PluginRegistry';
import type { Shape } from './types';

/**
 * Centralized UI constants for consistent styling and interaction across the codebase.
 * These values were previously scattered across multiple files.
 */
export const UI_CONSTANTS = {
  // Port and binding constants
  PORT_SNAP_RADIUS: 20,
  PORT_HIT_RADIUS: 12,

  // Selection and frame constants
  FRAME_PAD: 4,
  SELECTION_PAD: 8,
  FRAME_HIT_TOLERANCE: 6,

  // Handle constants
  HANDLE_HIT_DISTANCE: 10,
  HANDLE_CORNER_RADIUS: 5,
  HANDLE_MIDPOINT_RADIUS: 3.5,

  // Drag thresholds
  DRAG_COMMIT_THRESHOLD: 3,
  DRAG_DELETE_THRESHOLD: 4,

  // Hit testing
  POINT_INSIDE_MARGIN: 6,
  SEGMENT_HIT_THRESHOLD: 8,

  // Corner radius
  MAX_CORNER_RADIUS: 16,

  // Image handling
  MAX_IMAGE_DIMENSION: 800,

  // Grid
  VIEWPORT_PADDING: 120,

  // Zoom limits
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
  FIT_ZOOM_MIN: 0.2,
  FIT_ZOOM_MAX: 1.0,

  // Cache
  MAX_ROUGH_CACHE_SIZE: 500,
};

export const STYLE_PRESETS: Record<string, any> = {
  rectangle: { stroke: '#64748b', fill: 'transparent', strokeWidth: 1.8, roughness: 0, roundness: 'sharp', opacity: 1 },
  ellipse: { stroke: '#64748b', fill: 'transparent', strokeWidth: 1.8, roughness: 0, opacity: 1 },
  arrow: { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, edgeStyle: 'straight', startArrowhead: 'none', endArrowhead: 'arrow', opacity: 1 },
  freehand: { stroke: '#64748b', strokeWidth: 1.8, roughness: 0, opacity: 1 },
  text: { stroke: '#64748b', fontSize: 24, opacity: 1 },
};

const STORAGE_KEY = 'tahta_style_cache';

/**
 * All style properties that get cached per shape type.
 * Add new style fields here when extending the Shape interface.
 */
export const STYLE_PROPERTY_KEYS = [
  'stroke', 'fill', 'strokeWidth', 'opacity', 'roughness',
  'strokeStyle', 'edgeStyle', 'startArrowhead', 'endArrowhead',
  'roundness', 'cornerRadius', 'fontSize', 'fontFamily', 'fillStyle',
  'textColor', 'textAlign', 'textVerticalAlign',
  'textPaddingX', 'textPaddingY',
] as const;

/** Load style cache from localStorage */
function loadCacheFromStorage(): Map<string, Partial<Shape>> {
  if (typeof window === 'undefined') return new Map();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.warn('[Style Cache] Failed to load from localStorage:', e);
  }
  return new Map();
}

/** Save style cache to localStorage */
function saveCacheToStorage(cache: Map<string, Partial<Shape>>): void {
  if (typeof window === 'undefined') return;
  try {
    const obj = Object.fromEntries(cache);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('[Style Cache] Failed to save to localStorage:', e);
  }
}

/** Cache for last used styles per shape type - remembers user's style preferences */
let STYLE_CACHE = loadCacheFromStorage();

/** Clear the style cache (useful for resetting to defaults) */
export function clearStyleCache(): void {
  STYLE_CACHE.clear();
  saveCacheToStorage(STYLE_CACHE);
}

/**
 * Get the last used style for a shape type, or the default preset if none cached.
 * @param type Shape type (e.g., 'rectangle', 'arrow', etc.)
 * @returns Cached style or default preset
 */
export function getCachedStyle(type: string): Partial<Shape> {
  if (STYLE_CACHE.has(type)) {
    return STYLE_CACHE.get(type)!;
  }
  return getStylePreset(type);
}

/**
 * Cache the style for a shape type when a shape is created/modified.
 * Merges with existing cached style to preserve other properties.
 * @param type Shape type
 * @param style Style properties to cache
 */
export function cacheStyle(type: string, style: Partial<Shape>): void {
  const existing = STYLE_CACHE.get(type) || {};
  const merged = { ...existing, ...style };
  STYLE_CACHE.set(type, merged);
  saveCacheToStorage(STYLE_CACHE);
}

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
  { key: 'hand', label: 'Hand', shortcut: 'H', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v4H14V5a2 2 0 0 0-4 0v5H10V4a2 2 0 0 0-4 0v10a6 6 0 0 0 12 0z"></path></svg>` },
  { key: 'select', label: 'Select', shortcut: 'V', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"></path></svg>` },
  { isSeparator: true, key: 'sep-base' },
  { key: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>` },
  { key: 'ellipse', label: 'Ellipse', shortcut: 'E', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>` },
  { key: 'diamond', label: 'Diamond', shortcut: 'D', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 12 12 22 2 12"/></svg>` },
  { key: 'sticky-note', label: 'Sticky Note', shortcut: 'S', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>` },
  { isSeparator: true, key: 'sep-shapes' },
  { key: 'arrow', label: 'Arrow', shortcut: 'A', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/></svg>` },
  { isSeparator: true, key: 'sep-shapes' },
  { key: 'freehand', label: 'Pen', shortcut: 'P', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>` },
  { key: 'text', label: 'Text', shortcut: 'T', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3M12 4v16M9 20h6"/></svg>` },
  { key: 'image', label: 'Image', shortcut: 'I', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>` },
  { isSeparator: true, key: 'sep-draw' },
  {
    key: 'library-group', label: 'Library', shortcut: 'L', isDropdown: true,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L16 10 H8 Z"/><rect x="4" y="14" width="6" height="6" rx="1"/><circle cx="17" cy="17" r="3"/></svg>`,
    children: [
      { isHeader: true, label: 'Database Tools' } as any,
      { key: 'db-table', label: 'Table', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 9v12"/></svg>` },
      { key: 'db-view', label: 'View', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>` },
      { key: 'db-enum', label: 'Enum', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="7" cy="12" r="1" fill="currentColor"/><circle cx="7" cy="17" r="1" fill="currentColor"/><path d="M11 12h6"/><path d="M11 17h6"/><path d="M7 7h10"/></svg>` },
      { isHeader: true, label: 'Templates' } as any,
      { key: 'template-decision-tree', label: 'Decision Tree', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L19 9L12 16L5 9Z"/><path d="M5 9v6"/><path d="M19 9v6"/><rect x="2" y="15" width="6" height="4" rx="1"/><rect x="16" y="15" width="6" height="4" rx="1"/></svg>` },
      { key: 'template-flowchart', label: 'Flowchart', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="5" rx="2"/><rect x="6" y="10" width="12" height="5"/><path d="M6 19h12l-2 3H8l-2-3z"/><path d="M12 7v3"/><path d="M12 15v4"/></svg>` },
      { key: 'template-db-schema', label: 'DB Schema', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="8" height="16" rx="1"/><rect x="14" y="4" width="8" height="16" rx="1"/><path d="M2 9h8"/><path d="M14 9h8"/><path d="M10 12h4"/></svg>` },
      { key: 'template-user-flow', label: 'User Flow', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="9" width="4" height="4" rx="1"/><rect x="10" y="9" width="4" height="4" rx="1"/><rect x="18" y="9" width="4" height="4" rx="1"/><path d="M6 11h4"/><path d="M14 11h4"/></svg>` },
      { key: 'template-mind-map', label: 'Mind Map', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="10" width="6" height="4" rx="1"/><path d="M9 12H3"/><path d="M15 12h6"/><path d="M12 10V4"/><path d="M12 14v6"/></svg>` },
      { key: 'template-swot', label: 'SWOT', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>` },
      { key: 'template-org-chart', label: 'Org Chart', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><rect x="2" y="12" width="5" height="4" rx="1"/><rect x="9" y="12" width="6" height="4" rx="1"/><rect x="17" y="12" width="5" height="4" rx="1"/><path d="M12 6v3"/><path d="M5 9h14v3"/><path d="M12 9v3"/></svg>` },
      { key: 'template-timeline', label: 'Timeline', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/><path d="M5 10V7"/><path d="M12 14v3"/><path d="M19 10V7"/></svg>` },
      { key: 'template-uml-class', label: 'UML Class', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M4 8h16"/><path d="M4 14h16"/></svg>` },
      { key: 'template-venn', label: 'Venn', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="6" opacity="0.6"/><circle cx="15" cy="12" r="6" opacity="0.6"/></svg>` },
      { key: 'template-fishbone', label: 'Fishbone', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h18L17 9"/><path d="M20 12l-3 3"/><path d="M7 12l3-5"/><path d="M12 12l3-5"/><path d="M7 12l3 5"/><path d="M12 12l3 5"/></svg>` },
      { key: 'template-wireframe', label: 'Wireframe', shortcut: '', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="9" width="6" height="12" rx="1"/><rect x="10" y="9" width="12" height="5" rx="1"/><rect x="10" y="16" width="12" height="5" rx="1"/></svg>` },
    ],
  },
  { isSeparator: true, key: 'sep-mgmt' },
  { key: 'eraser', label: 'Eraser', shortcut: 'X', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m13.3 6 5.6 5.6"/></svg>` },
  { isSeparator: true, key: 'sep-undo' },
  { key: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>` },
  { key: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>` },
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
