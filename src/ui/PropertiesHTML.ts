import type { Shape, ICanvasAPI } from '../core/types';
import { getShapePropertyKeys } from './PropertyConstants';

// ─── Palettes ──────────────────────────────────────────────────────────────────

const STROKE_COLORS = [
  '#e5e7eb', '#f87171', '#4ade80', '#60a5fa',
  '#fbbf24', '#a78bfa', '#f472b6', '#94a3b8',
];

const FILL_COLORS = [
  'transparent',
  '#7f1d1d', '#14532d', '#1e3a8a', '#713f12',
  '#4c1d95', '#831843', '#1e293b',
];

// ─── SVGs ─────────────────────────────────────────────────────────────────────

const I = {
  strokeThin:    `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  strokeMed:     `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="3"/></svg>`,
  strokeThick:   `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="5"/></svg>`,
  styleSolid:    `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2"/></svg>`,
  styleDashed:   `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3"/></svg>`,
  styleDotted:   `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="1.5 4" stroke-linecap="round"/></svg>`,
  fillSolid:     `<svg viewBox="0 0 20 14"><rect x="1" y="1" width="18" height="12" rx="2" fill="currentColor" fill-opacity="0.7" stroke="currentColor" stroke-width="1"/></svg>`,
  fillHachure:   `<svg viewBox="0 0 20 14"><rect x="1" y="1" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><line x1="5" y1="1" x2="1" y2="5" stroke="currentColor" stroke-width="1"/><line x1="10" y1="1" x2="1" y2="10" stroke="currentColor" stroke-width="1"/><line x1="15" y1="1" x2="4" y2="12" stroke="currentColor" stroke-width="1"/><line x1="20" y1="1" x2="9" y2="12" stroke="currentColor" stroke-width="1"/><line x1="20" y1="5" x2="14" y2="11" stroke="currentColor" stroke-width="1"/></svg>`,
  fillCrossHatch:`<svg viewBox="0 0 20 14"><rect x="1" y="1" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><line x1="5" y1="1" x2="1" y2="5" stroke="currentColor" stroke-width="1"/><line x1="10" y1="1" x2="1" y2="10" stroke="currentColor" stroke-width="1"/><line x1="15" y1="1" x2="4" y2="12" stroke="currentColor" stroke-width="1"/><line x1="20" y1="1" x2="9" y2="12" stroke="currentColor" stroke-width="1"/><line x1="19" y1="5" x2="15" y2="1" stroke="currentColor" stroke-width="1"/><line x1="19" y1="10" x2="10" y2="1" stroke="currentColor" stroke-width="1"/><line x1="16" y1="13" x2="5" y2="2" stroke="currentColor" stroke-width="1"/></svg>`,
  roughNone:     `<svg viewBox="0 0 40 10"><path d="M2 5h36" stroke="currentColor" stroke-width="1.5"/></svg>`,
  roughLow:      `<svg viewBox="0 0 40 10"><path d="M2 5 Q10 3 18 5 Q26 7 34 4 L38 5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  roughHigh:     `<svg viewBox="0 0 40 10"><path d="M2 6 Q7 2 12 7 Q17 2 22 7 Q27 2 32 7 Q36 3 38 5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  edgeStraight:  `<svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.5"/></svg>`,
  edgeElbow:     `<svg viewBox="0 0 24 24"><polyline points="4,20 4,4 20,4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  edgeCurved:    `<svg viewBox="0 0 24 24"><path d="M4 20 Q4 4 20 4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  ahNone:        `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  ahArrow:       `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="18" y2="5" stroke="currentColor" stroke-width="1.5"/><polyline points="13,2 18,5 13,8" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  ahTriangle:    `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.5"/><polygon points="14,2 20,5 14,8" fill="currentColor"/></svg>`,
  ahCircle:      `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="5" r="3" fill="currentColor"/></svg>`,
  ahBar:         `<svg viewBox="0 0 24 10"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="1" x2="22" y2="9" stroke="currentColor" stroke-width="2"/></svg>`,
  roundSharp:    `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  roundRound:    `<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" rx="5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  layerBack:     `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="9" width="8" height="8" rx="1"/><rect x="10" y="3" width="8" height="8" rx="1"/></svg>`,
  layerBwd:      `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 15V5M6 9l4-4 4 4"/></svg>`,
  layerFwd:      `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 5v10M6 11l4 4 4-4"/></svg>`,
  layerFront:    `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="9" width="8" height="8" rx="1" opacity="0.4"/><rect x="10" y="3" width="8" height="8" rx="1"/></svg>`,
  duplicate:     `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M13 7V4a1 1 0 00-1-1H4a1 1 0 00-1 1v8a1 1 0 001 1h3"/></svg>`,
  delete:        `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h14M8 5V3h4v2M17 5l-1 12a1 1 0 01-1 1H5a1 1 0 01-1-1L3 5"/></svg>`,
  lock:          `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="14" height="9" rx="1.5"/><path d="M7 9V6a3 3 0 016 0v3"/></svg>`,
  unlock:        `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="14" height="9" rx="1.5"/><path d="M7 9V6a3 3 0 016 0"/></svg>`,
};

// ─── HTML helpers ──────────────────────────────────────────────────────────────

function swatch(prop: string, color: string, active: boolean): string {
  const isTrans = color === 'transparent';
  return `<button class="pp-swatch${active ? ' active' : ''}${isTrans ? ' pp-swatch--trans' : ''}"
    data-prop="${prop}" data-val="${color}" title="${color}"
    style="${isTrans ? '' : `background:${color}`}"></button>`;
}

function iconBtn(prop: string, val: string, svg: string, active: boolean, title: string, extraCls = ''): string {
  return `<button class="pp-ibtn${active ? ' active' : ''}${extraCls ? ' ' + extraCls : ''}"
    data-prop="${prop}" data-val="${val}" title="${title}">${svg}</button>`;
}

function section(label: string, content: string): string {
  return `<div class="pp-section">
    <div class="pp-label">${label}</div>
    <div class="pp-controls">${content}</div>
  </div>`;
}

function btnGroup(...btns: string[]): string {
  return `<div class="pp-btn-group">${btns.join('')}</div>`;
}

// ─── Main render ───────────────────────────────────────────────────────────────

export function renderPropertiesPanelHTML(api: ICanvasAPI): string {
  const state = api.getState();
  const selectedShapes = state.selectedIds
    .map((id: string) => state.shapes.find((s: Shape) => s.id === id))
    .filter((s): s is Shape => !!s);

  if (!selectedShapes.length) return '';

  const shape = selectedShapes[0]!;

  let props = getShapePropertyKeys(shape.type);
  for (let i = 1; i < selectedShapes.length; i++) {
    const p = getShapePropertyKeys(selectedShapes[i]!.type);
    props = props.filter(k => p.includes(k));
  }

  const has = (k: string) => props.includes(k);
  const isLocked = selectedShapes.some(s => s.locked);
  const sw = shape.strokeWidth ?? 2;
  const opacity = Math.round((shape.opacity ?? 1) * 100);

  let html = `<div class="pp${isLocked ? ' pp--locked' : ''}">`;

  // Stroke color
  if (has('stroke')) {
    html += section('Kontur rengi',
      `<div class="pp-swatches">${STROKE_COLORS.map(c => swatch('stroke', c, shape.stroke === c)).join('')}</div>`
    );
  }

  // Stroke width
  if (has('strokeWidth')) {
    html += section('Kalınlık',
      btnGroup(
        iconBtn('strokeWidth', '1', I.strokeThin,   sw <= 1,  'İnce'),
        iconBtn('strokeWidth', '2', I.strokeMed,    sw === 2, 'Orta'),
        iconBtn('strokeWidth', '4', I.strokeThick,  sw >= 4,  'Kalın'),
      )
    );
  }

  // Stroke style
  if (has('strokeStyle')) {
    html += section('Çizgi stili',
      btnGroup(
        iconBtn('strokeStyle', 'solid',  I.styleSolid,  (shape.strokeStyle ?? 'solid') === 'solid',  'Düz'),
        iconBtn('strokeStyle', 'dashed', I.styleDashed, shape.strokeStyle === 'dashed', 'Kesik'),
        iconBtn('strokeStyle', 'dotted', I.styleDotted, shape.strokeStyle === 'dotted', 'Noktalı'),
      )
    );
  }

  // Fill color
  if (has('fill')) {
    html += section('Dolgu rengi',
      `<div class="pp-swatches">${FILL_COLORS.map(c => swatch('fill', c, shape.fill === c)).join('')}</div>`
    );
  }

  // Fill style (hachure / solid)
  if (has('fillStyle')) {
    html += section('Dolgu stili',
      btnGroup(
        iconBtn('fillStyle', 'solid',       I.fillSolid,      (shape.fillStyle ?? 'hachure') === 'solid',      'Düz dolgu'),
        iconBtn('fillStyle', 'hachure',     I.fillHachure,    (shape.fillStyle ?? 'hachure') === 'hachure',    'Çizgili'),
        iconBtn('fillStyle', 'cross-hatch', I.fillCrossHatch, shape.fillStyle === 'cross-hatch', 'Çapraz çizgili'),
      )
    );
  }

  // Roughness
  if (has('roughness')) {
    html += section('Çizim stili',
      btnGroup(
        iconBtn('roughness', '0', I.roughNone, (shape.roughness ?? 1) === 0, 'Düzgün'),
        iconBtn('roughness', '1', I.roughLow,  (shape.roughness ?? 1) === 1, 'Hafif'),
        iconBtn('roughness', '2', I.roughHigh, (shape.roughness ?? 1) >= 2,  'Karalamış'),
      )
    );
  }

  // Roundness
  if (has('roundness')) {
    html += section('Köşeler',
      btnGroup(
        iconBtn('roundness', 'sharp', I.roundSharp, (shape.roundness ?? 'round') === 'sharp', 'Keskin'),
        iconBtn('roundness', 'round', I.roundRound, (shape.roundness ?? 'round') === 'round', 'Yuvarlak'),
      )
    );
  }

  // Opacity
  if (has('opacity')) {
    html += section('Opaklık',
      `<div class="pp-opacity-row">
        <input class="pp-opacity-slider" type="range" min="0" max="100" value="${opacity}" data-prop="opacity">
        <span class="pp-opacity-val">${opacity}%</span>
      </div>`
    );
  }

  // Arrow: edge style
  if (has('edgeStyle')) {
    html += section('Ok yolu',
      btnGroup(
        iconBtn('edgeStyle', 'straight', I.edgeStraight, (shape.edgeStyle ?? 'straight') === 'straight', 'Düz'),
        iconBtn('edgeStyle', 'elbow',    I.edgeElbow,    shape.edgeStyle === 'elbow',    'Dirsek'),
        iconBtn('edgeStyle', 'curved',   I.edgeCurved,   shape.edgeStyle === 'curved',   'Eğrisel'),
      )
    );
  }

  // Arrow: arrowhead
  if (has('endArrowhead')) {
    html += section('Ok ucu',
      btnGroup(
        iconBtn('endArrowhead', 'none',     I.ahNone,     (shape.endArrowhead ?? 'arrow') === 'none',     'Yok'),
        iconBtn('endArrowhead', 'arrow',    I.ahArrow,    (shape.endArrowhead ?? 'arrow') === 'arrow',    'Ok'),
        iconBtn('endArrowhead', 'triangle', I.ahTriangle, shape.endArrowhead === 'triangle', 'Üçgen'),
        iconBtn('endArrowhead', 'circle',   I.ahCircle,   shape.endArrowhead === 'circle',   'Daire'),
        iconBtn('endArrowhead', 'bar',      I.ahBar,      shape.endArrowhead === 'bar',      'Çubuk'),
      )
    );
  }

  // ── Bottom bar: Layers + Actions ──────────────────────────────────────────
  html += `<div class="pp-divider"></div>`;

  const isLocked2 = isLocked;
  html += `<div class="pp-bottom-bar">
    <div class="pp-btn-group">
      ${iconBtn('layer', 'back',     I.layerBack,  false, 'En alta')}
      ${iconBtn('layer', 'backward', I.layerBwd,   false, 'Bir aşağı')}
      ${iconBtn('layer', 'forward',  I.layerFwd,   false, 'Bir yukarı')}
      ${iconBtn('layer', 'front',    I.layerFront, false, 'En üste')}
    </div>
    <div class="pp-btn-group">
      ${iconBtn('action', 'duplicate',   I.duplicate,                   false,     'Çoğalt',       isLocked2 ? 'pp-ibtn--dim' : '')}
      ${iconBtn('action', 'toggle-lock', isLocked2 ? I.unlock : I.lock, isLocked2, isLocked2 ? 'Kilidi aç' : 'Kilitle', 'pp-ibtn--lock')}
      ${iconBtn('action', 'delete',      I.delete,                      false,     'Sil',           `pp-ibtn--danger${isLocked2 ? ' pp-ibtn--dim' : ''}`)}
    </div>
  </div>`;

  html += `</div>`;
  return html;
}

// backward compat exports (referenced by PropertiesPanel.ts re-export)
export function renderColorSwatches(): string { return ''; }
export function renderBtnGroup(): string { return ''; }
