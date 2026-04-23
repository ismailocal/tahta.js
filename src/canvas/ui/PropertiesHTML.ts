import type { Shape, ICanvasAPI } from '../../core/types';
import { getShapePropertyKeys, STROKE_COLORS, getFillColors, CANVAS_COLORS } from './PropertyConstants';
import { getCachedStyle } from '../../core/constants';
import { ICONS } from '../../core/icons';

// ─── Icon aliases for backward compatibility ─────────────────────────────────────

const I = {
  strokeThin: ICONS.strokeWidth.thin,
  strokeMed: ICONS.strokeWidth.medium,
  strokeThick: ICONS.strokeWidth.thick,
  styleSolid: ICONS.strokeStyle.solid,
  styleDashed: ICONS.strokeStyle.dashed,
  styleDotted: ICONS.strokeStyle.dotted,
  fillSolid: ICONS.fillStyle.solid,
  fillHachure: ICONS.fillStyle.hachure,
  fillCrossHatch: ICONS.fillStyle.crossHatch,
  roughNone: ICONS.roughness.none,
  roughLow: ICONS.roughness.low,
  roughHigh: ICONS.roughness.high,
  edgeStraight: ICONS.edgeStyle.straight,
  edgeElbow: ICONS.edgeStyle.elbow,
  edgeCurved: ICONS.edgeStyle.curved,
  ahNone: ICONS.arrowhead.none,
  ahArrow: ICONS.arrowhead.arrow,
  ahTriangle: ICONS.arrowhead.triangle,
  ahCircle: ICONS.arrowhead.circle,
  ahDiamond: ICONS.arrowhead.diamond,
  ahBar: ICONS.arrowhead.bar,
  roundSharp: ICONS.roundness.sharp,
  roundRound: ICONS.roundness.round,
  radius0: ICONS.cornerRadius.radius0,
  radius8: ICONS.cornerRadius.radius8,
  radius16: ICONS.cornerRadius.radius16,
  radius24: ICONS.cornerRadius.radius24,
  layerBack: ICONS.layers.back,
  layerBwd: ICONS.layers.backward,
  layerFwd: ICONS.layers.forward,
  layerFront: ICONS.layers.front,
  duplicate: ICONS.actions.duplicate,
  delete: ICONS.actions.delete,
  lock: ICONS.actions.lock,
  unlock: ICONS.actions.unlock,
  alignLeft: ICONS.align.left,
  alignCenter: ICONS.align.center,
  alignRight: ICONS.align.right,
  valignTop: ICONS.valign.top,
  valignMiddle: ICONS.valign.middle,
  valignBottom: ICONS.valign.bottom,
  overflowFree: ICONS.overflow.free,
  overflowWrap: ICONS.overflow.wrap,
  overflowClip: ICONS.overflow.clip,
  fontSmall: ICONS.fontSize.small,
  fontMedium: ICONS.fontSize.medium,
  fontLarge: ICONS.fontSize.large,
  fontXLarge: ICONS.fontSize.xLarge,
  createTemplate: ICONS.actions.createTemplate,
  palette: ICONS.actions.palette,
  chevronDown: ICONS.chevronDown,
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
      return '';
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
      appearanceHtml += row('Fill', `<div class="pp-swatches">${getFillColors(state.theme || 'light').map(c => swatch('fill', c, shape.fill === c)).join('')}</div>`);
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
    appearanceHtml += row('Fill', `<div class="pp-swatches">${getFillColors(state.theme || 'light').map((c: string) => swatch('fill', c, shape.fill === c)).join('')}</div>`);
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


  const countLabel = selectedShapes.length === 1 ? '1 object' : `${selectedShapes.length} objects`;

  return `
    <div class="properties-header">
      <div class="properties-header-left">
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

