/**
 * Centralized SVG icon definitions.
 * This file serves as the single source of truth for all SVG icons across the application.
 * Icons are organized by category for easy lookup and maintenance.
 */

export const ICONS = {
  // Stroke width icons
  strokeWidth: {
    thin: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.5"/></svg>`,
    medium: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="3"/></svg>`,
    thick: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="5"/></svg>`,
  },

  // Line style icons
  strokeStyle: {
    solid: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2"/></svg>`,
    dashed: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3"/></svg>`,
    dotted: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="1.5 4" stroke-linecap="round"/></svg>`,
  },

  // Fill style icons
  fillStyle: {
    solid: `<svg viewBox="0 0 20 14"><rect x="1" y="1" width="18" height="12" rx="2" fill="currentColor" fill-opacity="0.7" stroke="currentColor" stroke-width="1"/></svg>`,
    hachure: `<svg viewBox="0 0 20 14"><rect x="1" y="1" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><line x1="5" y1="12" x2="11" y2="2" stroke="currentColor" stroke-width="1"/><line x1="11" y1="12" x2="17" y2="2" stroke="currentColor" stroke-width="1"/></svg>`,
    crossHatch: `<svg viewBox="0 0 20 14"><rect x="1" y="1" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><line x1="5" y1="12" x2="11" y2="2" stroke="currentColor" stroke-width="1"/><line x1="11" y1="12" x2="17" y2="2" stroke="currentColor" stroke-width="1"/><line x1="5" y1="2" x2="11" y2="12" stroke="currentColor" stroke-width="1"/><line x1="11" y1="2" x2="17" y2="12" stroke="currentColor" stroke-width="1"/></svg>`,
  },

  // Roughness icons
  roughness: {
    none: `<svg viewBox="0 0 40 10"><path d="M2 5h36" stroke="currentColor" stroke-width="1.5"/></svg>`,
    low: `<svg viewBox="0 0 40 10"><path d="M2 5 Q10 3 18 5 Q26 7 34 4 L38 5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
    high: `<svg viewBox="0 0 40 10"><path d="M2 6 Q7 2 12 7 Q17 2 22 7 Q27 2 32 7 Q36 3 38 5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  },

  // Edge style icons
  edgeStyle: {
    straight: `<svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.5"/></svg>`,
    elbow: `<svg viewBox="0 0 24 24"><polyline points="4,20 4,4 20,4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
    curved: `<svg viewBox="0 0 24 24"><path d="M4 20 Q4 4 20 4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  },

  // Arrowhead icons
  arrowhead: {
    none: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.5"/></svg>`,
    arrow: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="18" y2="5" stroke="currentColor" stroke-width="1.5"/><polyline points="13,2 18,5 13,8" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
    triangle: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.5"/><polygon points="14,2 20,5 14,8" fill="currentColor"/></svg>`,
    circle: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="5" r="3" fill="currentColor"/></svg>`,
    diamond: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.5"/><polygon points="18,2 21,5 18,8 15,5" fill="currentColor"/></svg>`,
    bar: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="1" x2="22" y2="9" stroke="currentColor" stroke-width="2"/></svg>`,
  },

  // Roundness icons
  roundness: {
    sharp: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
    round: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" rx="5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  },

  // Corner radius icons
  cornerRadius: {
    radius0: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
    radius8: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
    radius16: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" rx="6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
    radius24: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" rx="9" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  },

  // Layer icons
  layers: {
    back: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="12" height="8" rx="1.5"/><polyline points="7 11 10 14 13 11"/><polyline points="7 14 10 17 13 14"/></svg>`,
    backward: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="12" height="9" rx="1.5"/><polyline points="7 14 10 17 13 14"/></svg>`,
    forward: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="12" height="9" rx="1.5"/><polyline points="7 6 10 3 13 6"/></svg>`,
    front: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="12" height="8" rx="1.5"/><polyline points="7 9 10 6 13 9"/><polyline points="7 6 10 3 13 6"/></svg>`,
  },

  // Text alignment icons
  align: {
    left: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="3" x2="2" y2="13"/><line x1="5" y1="6" x2="15" y2="6"/><line x1="5" y1="10" x2="11" y2="10"/></svg>`,
    center: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="3" x2="10" y2="13"/><line x1="4" y1="6" x2="16" y2="6"/><line x1="6" y1="10" x2="14" y2="10"/></svg>`,
    right: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="3" x2="18" y2="13"/><line x1="5" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="15" y2="10"/></svg>`,
  },

  // Vertical alignment icons
  valign: {
    top: `<svg viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="2" x2="13" y2="2"/><line x1="6" y1="5" x2="6" y2="15"/><line x1="10" y1="5" x2="10" y2="11"/></svg>`,
    middle: `<svg viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="10" x2="13" y2="10"/><line x1="6" y1="4" x2="6" y2="16"/><line x1="10" y1="6" x2="10" y2="14"/></svg>`,
    bottom: `<svg viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="18" x2="13" y2="18"/><line x1="6" y1="5" x2="6" y2="15"/><line x1="10" y1="9" x2="10" y2="15"/></svg>`,
  },

  // Text overflow icons
  overflow: {
    free: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="16" height="12" rx="1"/><line x1="5" y1="6" x2="15" y2="6"/><line x1="5" y1="10" x2="15" y2="10"/></svg>`,
    wrap: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="16" height="12" rx="1"/><line x1="5" y1="6" x2="10" y2="6"/><line x1="10" y1="6" x2="10" y2="10"/><line x1="10" y1="10" x2="15" y2="10"/></svg>`,
    clip: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="16" height="12" rx="1"/><line x1="5" y1="6" x2="15" y2="6"/><line x1="5" y1="10" x2="15" y2="10"/><line x1="16" y1="2" x2="16" y2="14" stroke-width="2"/></svg>`,
  },

  // Font size icons
  fontSize: {
    small: `<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="16" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">S</text></svg>`,
    medium: `<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="17" font-size="16" text-anchor="middle" font-family="sans-serif" font-weight="bold">M</text></svg>`,
    large: `<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="18" font-size="20" text-anchor="middle" font-family="sans-serif" font-weight="bold">L</text></svg>`,
    xLarge: `<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="19" font-size="24" text-anchor="middle" font-family="sans-serif" font-weight="bold">XL</text></svg>`,
  },

  // Action icons
  actions: {
    duplicate: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M13 7V4a1 1 0 00-1-1H4a1 1 0 00-1 1v8a1 1 0 001 1h3"/></svg>`,
    delete: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h14M8 5V3h4v2M17 5l-1 12a1 1 0 01-1 1H5a1 1 0 01-1-1L3 5"/></svg>`,
    lock: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="14" height="9" rx="1.5"/><path d="M7 9V6a3 3 0 016 0v3"/></svg>`,
    unlock: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="14" height="9" rx="1.5"/><path d="M7 9V6a3 3 0 016 0"/></svg>`,
    createTemplate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L16 10 H8 Z"/><rect x="4" y="14" width="6" height="6" rx="1"/><circle cx="17" cy="17" r="3"/><path d="M21 3v6M18 6h6" stroke-width="2.5"/></svg>`,
    palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125 0-.941.732-1.688 1.688-1.688h1.941c3.191 0 5.593-2.515 5.593-5.593C22 5.593 15.5 2 12 2z"/></svg>`,
  },

  // Chevron icon
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,

  // Settings icon
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
} as const;
