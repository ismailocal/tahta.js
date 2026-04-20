import type { Shape, ICanvasAPI } from '../../core/types';
import { getShapePropertyKeys, STROKE_COLORS, FILL_COLORS, CANVAS_COLORS } from './PropertyConstants';
import { getCachedStyle } from '../../core/constants';

// ─── SVGs ─────────────────────────────────────────────────────────────────────

const I = {
  strokeThin: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  strokeMed: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="3"/></svg>`,
  strokeThick: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="5"/></svg>`,
  styleSolid: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2"/></svg>`,
  styleDashed: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3"/></svg>`,
  styleDotted: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="1.5 4" stroke-linecap="round"/></svg>`,
  fillSolid: `<svg viewBox="0 0 20 14"><rect x="1" y="1" width="18" height="12" rx="2" fill="currentColor" fill-opacity="0.7" stroke="currentColor" stroke-width="1"/></svg>`,
  fillHachure: `<svg viewBox="0 0 20 14"><rect x="1" y="1" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><line x1="5" y1="12" x2="11" y2="2" stroke="currentColor" stroke-width="1"/><line x1="11" y1="12" x2="17" y2="2" stroke="currentColor" stroke-width="1"/></svg>`,
  fillCrossHatch: `<svg viewBox="0 0 20 14"><rect x="1" y="1" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><line x1="5" y1="12" x2="11" y2="2" stroke="currentColor" stroke-width="1"/><line x1="11" y1="12" x2="17" y2="2" stroke="currentColor" stroke-width="1"/><line x1="5" y1="2" x2="11" y2="12" stroke="currentColor" stroke-width="1"/><line x1="11" y1="2" x2="17" y2="12" stroke="currentColor" stroke-width="1"/></svg>`,
  roughNone: `<svg viewBox="0 0 40 10"><path d="M2 5h36" stroke="currentColor" stroke-width="1.5"/></svg>`,
  roughLow: `<svg viewBox="0 0 40 10"><path d="M2 5 Q10 3 18 5 Q26 7 34 4 L38 5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  roughHigh: `<svg viewBox="0 0 40 10"><path d="M2 6 Q7 2 12 7 Q17 2 22 7 Q27 2 32 7 Q36 3 38 5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  edgeStraight: `<svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.5"/></svg>`,
  edgeElbow: `<svg viewBox="0 0 24 24"><polyline points="4,20 4,4 20,4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  edgeCurved: `<svg viewBox="0 0 24 24"><path d="M4 20 Q4 4 20 4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  ahNone: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  ahArrow: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="18" y2="5" stroke="currentColor" stroke-width="1.5"/><polyline points="13,2 18,5 13,8" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  ahTriangle: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.5"/><polygon points="14,2 20,5 14,8" fill="currentColor"/></svg>`,
  ahCircle: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="5" r="3" fill="currentColor"/></svg>`,
  ahDiamond: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.5"/><polygon points="18,2 21,5 18,8 15,5" fill="currentColor"/></svg>`,
  ahBar: `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="1" x2="22" y2="9" stroke="currentColor" stroke-width="2"/></svg>`,
  roundSharp: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  roundRound: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" rx="5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  radius0: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  radius8: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  radius16: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" rx="6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  radius24: `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" rx="9" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  layerBack: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="12" height="8" rx="1.5"/><polyline points="7 11 10 14 13 11"/><polyline points="7 14 10 17 13 14"/></svg>`,
  layerBwd: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="12" height="9" rx="1.5"/><polyline points="7 14 10 17 13 14"/></svg>`,
  layerFwd: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="12" height="9" rx="1.5"/><polyline points="7 6 10 3 13 6"/></svg>`,
  layerFront: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="12" height="8" rx="1.5"/><polyline points="7 9 10 6 13 9"/><polyline points="7 6 10 3 13 6"/></svg>`,
  duplicate: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M13 7V4a1 1 0 00-1-1H4a1 1 0 00-1 1v8a1 1 0 001 1h3"/></svg>`,
  delete: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h14M8 5V3h4v2M17 5l-1 12a1 1 0 01-1 1H5a1 1 0 01-1-1L3 5"/></svg>`,
  lock: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="14" height="9" rx="1.5"/><path d="M7 9V6a3 3 0 016 0v3"/></svg>`,
  unlock: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="14" height="9" rx="1.5"/><path d="M7 9V6a3 3 0 016 0"/></svg>`,
  alignLeft: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="3" x2="2" y2="13"/><line x1="5" y1="6" x2="15" y2="6"/><line x1="5" y1="10" x2="11" y2="10"/></svg>`,
  alignCenter: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="10" y1="3" x2="10" y2="13"/><line x1="4" y1="6" x2="16" y2="6"/><line x1="6" y1="10" x2="14" y2="10"/></svg>`,
  alignRight: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="3" x2="18" y2="13"/><line x1="5" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="15" y2="10"/></svg>`,
  valignTop: `<svg viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="2" x2="13" y2="2"/><line x1="6" y1="5" x2="6" y2="15"/><line x1="10" y1="5" x2="10" y2="11"/></svg>`,
  valignMiddle: `<svg viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="10" x2="13" y2="10"/><line x1="6" y1="4" x2="6" y2="16"/><line x1="10" y1="6" x2="10" y2="14"/></svg>`,
  valignBottom: `<svg viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="18" x2="13" y2="18"/><line x1="6" y1="5" x2="6" y2="15"/><line x1="10" y1="9" x2="10" y2="15"/></svg>`,
  overflowFree: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="16" height="12" rx="1"/><line x1="5" y1="6" x2="15" y2="6"/><line x1="5" y1="10" x2="15" y2="10"/></svg>`,
  overflowWrap: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="16" height="12" rx="1"/><line x1="5" y1="6" x2="10" y2="6"/><line x1="10" y1="6" x2="10" y2="10"/><line x1="10" y1="10" x2="15" y2="10"/></svg>`,
  overflowClip: `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="16" height="12" rx="1"/><line x1="5" y1="6" x2="15" y2="6"/><line x1="5" y1="10" x2="15" y2="10"/><line x1="16" y1="2" x2="16" y2="14" stroke-width="2"/></svg>`,
  fontSmall: `<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="16" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">S</text></svg>`,
  fontMedium: `<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="17" font-size="16" text-anchor="middle" font-family="sans-serif" font-weight="bold">M</text></svg>`,
  fontLarge: `<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="18" font-size="20" text-anchor="middle" font-family="sans-serif" font-weight="bold">L</text></svg>`,
  fontXLarge: `<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="19" font-size="24" text-anchor="middle" font-family="sans-serif" font-weight="bold">XL</text></svg>`,
  createTemplate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L16 10 H8 Z"/><rect x="4" y="14" width="6" height="6" rx="1"/><circle cx="17" cy="17" r="3"/><path d="M21 3v6M18 6h6" stroke-width="2.5"/></svg>`,
  palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125 0-.941.732-1.688 1.688-1.688h1.941c3.191 0 5.593-2.515 5.593-5.593C22 5.593 15.5 2 12 2z"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
};

// ─── HTML helpers ──────────────────────────────────────────────────────────────

function swatch(prop: string, color: string, active: boolean): string {
  const isTrans = color === 'transparent';
  return `<button class="pp-swatch${active ? ' active' : ''}${isTrans ? ' pp-swatch--trans' : ''}"
    data-prop="${prop}" data-val="${color}" title="${color}" aria-label="${color}"
    style="${isTrans ? '' : `background:${color}`}"></button>`;
}

function iconBtn(prop: string, val: string, svg: string, active: boolean, title: string, extraCls = ''): string {
  return `<button class="pp-ibtn${active ? ' active' : ''}${extraCls ? ' ' + extraCls : ''}"
    data-prop="${prop}" data-val="${val}" title="${title}" aria-label="${title}">${svg}</button>`;
}

function section(label: string, content: string): string {
  return `<div class="pp-section">
    ${content}
  </div>`;
}

function row(label: string, content: string): string {
  return `<div class="pp-row">
    <span class="pp-label">${label}</span>
    <div class="pp-controls">${content}</div>
  </div>`;
}

function btnGroup(...btns: string[]): string {
  return `<div class="pp-btn-group">${btns.join('')}</div>`;
}

// ─── Main render ───────────────────────────────────────────────────────────────

function dropdown(label: string, icon: string, content: string, title: string): string {
  return `<div class="pp-dropdown-wrap">
    <button class="pp-dbat" title="${title}" aria-label="${title}">
      <span class="pp-dbat-icon">${icon}</span>
      <span class="tool-dropdown-arrow">▸</span>
    </button>
    <div class="pp-dropdown-menu">
      <div class="pp-dropdown-label" aria-label="${label}">${label}</div>
      <div class="pp-dropdown-content">${content}</div>
    </div>
  </div>`;
}

function colorIcon(color: string): string {
  const isTrans = color === 'transparent';
  return `<div class="pp-color-preview${isTrans ? ' pp-swatch--trans' : ''}" 
    style="${isTrans ? '' : `background:${color}; border: 1px solid rgba(0,0,0,0.1);`}"></div>`;
}

const PROPERTIES_ICONS = {
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

function renderTextLayoutSection(shape: Shape): string {
  let textHtml = '';
  const fs = shape.fontSize || 20;
  textHtml += row('Font size',
    btnGroup(
      iconBtn('fontSize', '16', I.fontSmall, fs <= 16, 'Small'),
      iconBtn('fontSize', '20', I.fontMedium, fs > 16 && fs <= 20, 'Medium'),
      iconBtn('fontSize', '28', I.fontLarge, fs > 20 && fs <= 28, 'Large'),
      iconBtn('fontSize', '36', I.fontXLarge, fs > 28, 'Extra Large'),
    )
  );

  const textColor = shape.textColor || '';
  textHtml += row('Text color', `<div class="pp-swatches">${STROKE_COLORS.map(c => swatch('textColor', c, shape.textColor === c)).join('')}</div>`);

  const alignH = shape.textAlign || 'center';
  const alignV = shape.textVerticalAlign || 'middle';

  textHtml += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <div>
        <div class="pp-label" style="margin-bottom: 4px;">Horizontal</div>
        ${btnGroup(
    iconBtn('textAlign', 'left', I.alignLeft, alignH === 'left', 'Left'),
    iconBtn('textAlign', 'center', I.alignCenter, alignH === 'center', 'Center'),
    iconBtn('textAlign', 'right', I.alignRight, alignH === 'right', 'Right'),
  )}
      </div>
      <div>
        <div class="pp-label" style="margin-bottom: 4px;">Vertical</div>
        ${btnGroup(
    iconBtn('textVerticalAlign', 'top', I.valignTop, alignV === 'top', 'Top'),
    iconBtn('textVerticalAlign', 'middle', I.valignMiddle, alignV === 'middle', 'Middle'),
    iconBtn('textVerticalAlign', 'bottom', I.valignBottom, alignV === 'bottom', 'Bottom'),
  )}
      </div>
    </div>`;

  return textHtml;
}

export function renderPropertiesPanelHTML(api: ICanvasAPI): string {
  const state = api.getState();
  const selectedShapes = state.selectedIds
    .map((id: string) => state.shapes.find((s: Shape) => s.id === id))
    .filter((s): s is Shape => !!s);

  // Eğer seçili şekil yoksa ama aktif bir çizim aracı varsa, cached style'ı göster
  const isDrawingTool = [
    'rectangle', 'ellipse', 'diamond', 'triangle', 'sticky-note',
    'arrow', 'freehand', 'text', 'db-table', 'db-view', 'db-enum',
    'hexagon', 'star', 'parallelogram', 'cylinder', 'cloud', 'callout'
  ].includes(state.activeTool);

  if (!selectedShapes.length) {
    if (!isDrawingTool) {
      const currentBg = state.canvasBackground || (state.theme === 'light' ? '#ffffff' : '#121212');
      return `
        <div class="properties-header">
          <div class="properties-header-left">
            <span class="properties-header-icon"></span>
            <h3 class="properties-header-title">Canvas Settings</h3>
          </div>
        </div>
        <div class="pp-toolbar">
          <div class="pp-section">
            <div class="pp-row">
              <div class="pp-label">Background Color</div>
              <div class="pp-swatches">
                ${CANVAS_COLORS.map(c => swatch('canvasBackground', c, currentBg === c)).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Aktif araç için cached style'ı al ve mock shape oluştur
    const cachedStyle = getCachedStyle(state.activeTool);
    const shape: Shape = {
      id: '',
      type: state.activeTool as any,
      x: 0, y: 0,
      width: 0, height: 0,
      ...cachedStyle
    };

    // Tek bir şekil gibi davran
    const props = getShapePropertyKeys(shape.type);
    const has = (k: string) => props.includes(k);
    const sw = shape.strokeWidth ?? 2;
    const groups: string[] = [];

    // Group 1: Appearance (Stroke, Fill)
    let appearanceHtml = '';
    if (has('stroke')) {
      appearanceHtml += row('Stroke', `<div class="pp-swatches">${STROKE_COLORS.map(c => swatch('stroke', c, shape.stroke === c)).join('')}</div>`);
    }
    if (has('strokeWidth')) {
      appearanceHtml += row('Thickness',
        btnGroup(
          iconBtn('strokeWidth', '1.8', I.strokeThin, sw <= 2, 'Thin'),
          iconBtn('strokeWidth', '3.5', I.strokeMed, sw > 2 && sw < 5, 'Medium'),
          iconBtn('strokeWidth', '6', I.strokeThick, sw >= 5, 'Thick'),
        )
      );
    }
    if (has('roughness')) {
      const r = shape.roughness ?? 0;
      appearanceHtml += row('Roughness',
        btnGroup(
          iconBtn('roughness', '0', I.roughNone, r === 0, 'None'),
          iconBtn('roughness', '1', I.roughLow, r === 1, 'Low'),
          iconBtn('roughness', '2', I.roughHigh, r === 2, 'High'),
        )
      );
    }
    if (has('strokeStyle')) {
      const s = shape.strokeStyle || 'solid';
      appearanceHtml += row('Line style',
        btnGroup(
          iconBtn('strokeStyle', 'solid', I.styleSolid, s === 'solid', 'Solid'),
          iconBtn('strokeStyle', 'dashed', I.styleDashed, s === 'dashed', 'Dashed'),
          iconBtn('strokeStyle', 'dotted', I.styleDotted, s === 'dotted', 'Dotted'),
        )
      );
    }
    if (has('edgeStyle')) {
      const es = shape.edgeStyle || 'straight';
      appearanceHtml += row('Edge style',
        btnGroup(
          iconBtn('edgeStyle', 'straight', I.edgeStraight, es === 'straight', 'Straight'),
          iconBtn('edgeStyle', 'elbow', I.edgeElbow, es === 'elbow', 'Elbow'),
          iconBtn('edgeStyle', 'curved', I.edgeCurved, es === 'curved', 'Curved'),
        )
      );
    }
    if (has('startArrowhead')) {
      const sa = shape.startArrowhead || 'none';
      appearanceHtml += row('Start arrow',
        btnGroup(
          iconBtn('startArrowhead', 'none', I.ahNone, sa === 'none', 'None'),
          iconBtn('startArrowhead', 'arrow', I.ahArrow, sa === 'arrow', 'Arrow'),
          iconBtn('startArrowhead', 'triangle', I.ahTriangle, sa === 'triangle', 'Triangle'),
          iconBtn('startArrowhead', 'circle', I.ahCircle, sa === 'circle', 'Circle'),
          iconBtn('startArrowhead', 'diamond', I.ahDiamond, sa === 'diamond', 'Diamond'),
          iconBtn('startArrowhead', 'bar', I.ahBar, sa === 'bar', 'Bar'),
        )
      );
    }
    if (has('endArrowhead')) {
      const ea = shape.endArrowhead || 'arrow';
      appearanceHtml += row('End arrow',
        btnGroup(
          iconBtn('endArrowhead', 'none', I.ahNone, ea === 'none', 'None'),
          iconBtn('endArrowhead', 'arrow', I.ahArrow, ea === 'arrow', 'Arrow'),
          iconBtn('endArrowhead', 'triangle', I.ahTriangle, ea === 'triangle', 'Triangle'),
          iconBtn('endArrowhead', 'circle', I.ahCircle, ea === 'circle', 'Circle'),
          iconBtn('endArrowhead', 'diamond', I.ahDiamond, ea === 'diamond', 'Diamond'),
          iconBtn('endArrowhead', 'bar', I.ahBar, ea === 'bar', 'Bar'),
        )
      );
    }
    if (has('fill')) {
      appearanceHtml += row('Fill', `<div class="pp-swatches">${FILL_COLORS.map(c => swatch('fill', c, shape.fill === c)).join('')}</div>`);
    }
    if (has('fillStyle')) {
      const s = shape.fillStyle || 'hachure';
      appearanceHtml += row('Fill style',
        btnGroup(
          iconBtn('fillStyle', 'solid', I.fillSolid, s === 'solid', 'Solid fill'),
          iconBtn('fillStyle', 'hachure', I.fillHachure, s === 'hachure', 'Hachure'),
          iconBtn('fillStyle', 'cross-hatch', I.fillCrossHatch, s === 'cross-hatch', 'Cross-hatch'),
        )
      );
    }
    if (has('opacity')) {
      const o = shape.opacity ?? 1;
      appearanceHtml += row('Opacity',
        btnGroup(
          iconBtn('opacity', '1', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="1"/></svg>`, o == 1, '100%'),
          iconBtn('opacity', '0.5', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.5"/></svg>`, o == 0.5, '50%'),
          iconBtn('opacity', '0.25', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.25"/></svg>`, o == 0.25, '25%'),
        )
      );
    }
    if (has('cornerRadius')) {
      const cr = shape.cornerRadius ?? 16;
      appearanceHtml += row('Corner radius',
        btnGroup(
          iconBtn('cornerRadius|roundness', '0|sharp', I.radius0, cr === 0, '0px'),
          iconBtn('cornerRadius|roundness', '8|round', I.radius8, cr === 8, '8px'),
          iconBtn('cornerRadius|roundness', '16|round', I.radius16, cr === 16, '16px'),
          iconBtn('cornerRadius|roundness', '24|round', I.radius24, cr === 24, '24px'),
        )
      );
    }
    if (appearanceHtml) groups.push(section('Appearance', appearanceHtml));

    if (has('textLayout')) {
      const textHtml = renderTextLayoutSection(shape);
      if (textHtml) groups.push(section('Text', textHtml));
    } else if (has('fontSize')) {
      const fs = shape.fontSize || 20;
      const fsHtml = row('Font size',
        btnGroup(
          iconBtn('fontSize', '16', I.fontSmall, fs <= 16, 'Small'),
          iconBtn('fontSize', '20', I.fontMedium, fs > 16 && fs <= 20, 'Medium'),
          iconBtn('fontSize', '28', I.fontLarge, fs > 20 && fs <= 28, 'Large'),
          iconBtn('fontSize', '36', I.fontXLarge, fs > 28, 'Extra Large'),
        )
      );
      groups.push(section('Text', fsHtml));
    }

    return `
      <div class="properties-header">
        <div class="properties-header-left">
          <span class="properties-header-icon"></span>
          <h3 class="properties-header-title">Properties</h3>
          <span class="properties-count-badge">Tool Settings</span>
        </div>
      </div>
      <div class="pp-toolbar pp--tool-settings">${groups.join('')}</div>
    `;
  }

  const shape = selectedShapes[0]!;

  let props = getShapePropertyKeys(shape.type);
  for (let i = 1; i < selectedShapes.length; i++) {
    const p = getShapePropertyKeys(selectedShapes[i]!.type);
    props = props.filter(k => p.includes(k));
  }

  const has = (k: string) => props.includes(k);
  const isLocked = selectedShapes.some(s => s.locked);
  const sw = shape.strokeWidth ?? 2;

  const groups: string[] = [];

  // Group 1: Appearance (Stroke, Fill)
  let appearanceHtml = '';
  if (has('stroke')) {
    appearanceHtml += row('Stroke', `<div class="pp-swatches">${STROKE_COLORS.map(c => swatch('stroke', c, shape.stroke === c)).join('')}</div>`);
  }
  if (has('strokeWidth')) {
    appearanceHtml += row('Thickness',
      btnGroup(
        iconBtn('strokeWidth', '1.8', I.strokeThin, sw <= 2, 'Thin'),
        iconBtn('strokeWidth', '3.5', I.strokeMed, sw > 2 && sw < 5, 'Medium'),
        iconBtn('strokeWidth', '6', I.strokeThick, sw >= 5, 'Thick'),
      )
    );
  }
  if (has('roughness')) {
    const r = shape.roughness ?? 0;
    appearanceHtml += row('Roughness',
      btnGroup(
        iconBtn('roughness', '0', I.roughNone, r === 0, 'None'),
        iconBtn('roughness', '1', I.roughLow, r === 1, 'Low'),
        iconBtn('roughness', '2', I.roughHigh, r === 2, 'High'),
      )
    );
  }
  if (has('strokeStyle')) {
    const s = shape.strokeStyle || 'solid';
    appearanceHtml += row('Line style',
      btnGroup(
        iconBtn('strokeStyle', 'solid', I.styleSolid, s === 'solid', 'Solid'),
        iconBtn('strokeStyle', 'dashed', I.styleDashed, s === 'dashed', 'Dashed'),
        iconBtn('strokeStyle', 'dotted', I.styleDotted, s === 'dotted', 'Dotted'),
      )
    );
  }
  if (has('edgeStyle')) {
    const es = shape.edgeStyle || 'straight';
    appearanceHtml += row('Edge style',
      btnGroup(
        iconBtn('edgeStyle', 'straight', I.edgeStraight, es === 'straight', 'Straight'),
        iconBtn('edgeStyle', 'elbow', I.edgeElbow, es === 'elbow', 'Elbow'),
        iconBtn('edgeStyle', 'curved', I.edgeCurved, es === 'curved', 'Curved'),
      )
    );
  }
  if (has('startArrowhead')) {
    const sa = shape.startArrowhead || 'none';
    appearanceHtml += row('Start arrow',
      btnGroup(
        iconBtn('startArrowhead', 'none', I.ahNone, sa === 'none', 'None'),
        iconBtn('startArrowhead', 'arrow', I.ahArrow, sa === 'arrow', 'Arrow'),
        iconBtn('startArrowhead', 'triangle', I.ahTriangle, sa === 'triangle', 'Triangle'),
        iconBtn('startArrowhead', 'circle', I.ahCircle, sa === 'circle', 'Circle'),
        iconBtn('startArrowhead', 'diamond', I.ahDiamond, sa === 'diamond', 'Diamond'),
        iconBtn('startArrowhead', 'bar', I.ahBar, sa === 'bar', 'Bar'),
      )
    );
  }
  if (has('endArrowhead')) {
    const ea = shape.endArrowhead || 'arrow';
    appearanceHtml += row('End arrow',
      btnGroup(
        iconBtn('endArrowhead', 'none', I.ahNone, ea === 'none', 'None'),
        iconBtn('endArrowhead', 'arrow', I.ahArrow, ea === 'arrow', 'Arrow'),
        iconBtn('endArrowhead', 'triangle', I.ahTriangle, ea === 'triangle', 'Triangle'),
        iconBtn('endArrowhead', 'circle', I.ahCircle, ea === 'circle', 'Circle'),
        iconBtn('endArrowhead', 'diamond', I.ahDiamond, ea === 'diamond', 'Diamond'),
        iconBtn('endArrowhead', 'bar', I.ahBar, ea === 'bar', 'Bar'),
      )
    );
  }
  if (has('fill')) {
    appearanceHtml += row('Fill', `<div class="pp-swatches">${FILL_COLORS.map(c => swatch('fill', c, shape.fill === c)).join('')}</div>`);
  }
  if (has('fillStyle')) {
    const s = shape.fillStyle || 'hachure';
    appearanceHtml += row('Fill style',
      btnGroup(
        iconBtn('fillStyle', 'solid', I.fillSolid, s === 'solid', 'Solid fill'),
        iconBtn('fillStyle', 'hachure', I.fillHachure, s === 'hachure', 'Hachure'),
        iconBtn('fillStyle', 'cross-hatch', I.fillCrossHatch, s === 'cross-hatch', 'Cross-hatch'),
      )
    );
  }
  if (has('opacity')) {
    const o = shape.opacity ?? 1;
    appearanceHtml += row('Opacity',
      btnGroup(
        iconBtn('opacity', '1', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="1"/></svg>`, o == 1, '100%'),
        iconBtn('opacity', '0.5', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.5"/></svg>`, o == 0.5, '50%'),
        iconBtn('opacity', '0.25', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.25"/></svg>`, o == 0.25, '25%'),
      )
    );
  }
  if (has('cornerRadius')) {
    const cr = shape.cornerRadius ?? 16;
    appearanceHtml += row('Corner radius',
      btnGroup(
        iconBtn('cornerRadius', '0', I.radius0, cr === 0, '0px'),
        iconBtn('cornerRadius', '8', I.radius8, cr === 8, '8px'),
        iconBtn('cornerRadius', '16', I.radius16, cr === 16, '16px'),
        iconBtn('cornerRadius', '24', I.radius24, cr === 24, '24px'),
      )
    );
  }
  if (appearanceHtml) groups.push(section('Appearance', appearanceHtml));

  // Group 1b: Text Color + Layout
  if (has('textLayout')) {
    const textHtml = renderTextLayoutSection(shape);
    if (textHtml) groups.push(section('Text', textHtml));
  } else if (has('fontSize')) {
    const fs = shape.fontSize || 20;
    const fsHtml = row('Font size',
      btnGroup(
        iconBtn('fontSize', '16', I.fontSmall, fs <= 16, 'Small'),
        iconBtn('fontSize', '20', I.fontMedium, fs > 16 && fs <= 20, 'Medium'),
        iconBtn('fontSize', '28', I.fontLarge, fs > 20 && fs <= 28, 'Large'),
        iconBtn('fontSize', '36', I.fontXLarge, fs > 28, 'Extra Large'),
      )
    );
    groups.push(section('Text', fsHtml));
  }

  // Group 2: Actions
  let actionsHtml = '';
  if (has('action')) {
    actionsHtml += row('Actions',
      btnGroup(
        iconBtn('action', 'duplicate', I.duplicate, false, 'Duplicate', isLocked ? 'pp-ibtn--dim' : ''),
        iconBtn('action', 'toggle-lock', isLocked ? I.unlock : I.lock, isLocked, isLocked ? 'Unlock' : 'Lock', 'pp-ibtn--lock'),
        iconBtn('action', 'create-template', I.createTemplate, false, 'Save as Template', isLocked ? 'pp-ibtn--dim' : ''),
        iconBtn('action', 'delete', I.delete, false, 'Delete', `pp-ibtn--danger${isLocked ? ' pp-ibtn--dim' : ''}`)
      )
    );
  }
  if (actionsHtml) groups.push(section('Actions', actionsHtml));

  // Group 3: Layers
  let layersHtml = '';
  if (has('layer')) {
    layersHtml += row('Layer',
      btnGroup(
        iconBtn('layer', 'back', I.layerBack, false, 'Move to back'),
        iconBtn('layer', 'backward', I.layerBwd, false, 'Move backward'),
        iconBtn('layer', 'forward', I.layerFwd, false, 'Move forward'),
        iconBtn('layer', 'front', I.layerFront, false, 'Move to front'),
      )
    );
  }
  if (layersHtml) groups.push(section('Layers', layersHtml));

  const countLabel = selectedShapes.length === 1 ? '1 object' : `${selectedShapes.length} objects`;

  return `
    <div class="properties-header">
      <div class="properties-header-left">
        <span class="properties-header-icon"></span>
        <h3 class="properties-header-title">Properties</h3>
        <span class="properties-count-badge">${countLabel}</span>
      </div>
    </div>
    <div class="pp-toolbar${isLocked ? ' pp--locked' : ''}">${groups.join('')}</div>
  `;
}

// backward compat exports (referenced by PropertiesPanel.ts re-export)
export function renderColorSwatches(): string { return ''; }
export function renderBtnGroup(): string { return ''; }

