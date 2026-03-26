import type { Shape, ICanvasAPI } from '../core/types';
import { STROKE_COLORS, FILL_COLORS, ICONS, SHAPE_PROPERTIES } from './PropertyConstants';

export function renderColorSwatches(prop: string, colors: string[], activeColor: string | undefined): string {
  const safeActiveColor = activeColor || colors[0];
  let html = `<div class="color-picker-row">`;
  
  html += `<div class="color-picker-group">`;
  colors.forEach(c => {
    const isTrans = c === 'transparent';
    const activeClass = safeActiveColor === c ? 'active' : '';
    html += `
      <button class="color-swatch ${isTrans ? 'transparent-swatch' : ''} ${activeClass}" 
              data-prop="${prop}" data-val="${c}" 
              style="background-color: ${isTrans ? 'transparent' : c};"></button>
    `;
  });
  html += `</div>`;
  
  html += `<div class="divider-vertical"></div>`;
  
  const isTrans = safeActiveColor === 'transparent';
  html += `<div class="color-picker-group">
      <div class="color-swatch static-active ${isTrans ? 'transparent-swatch' : ''}" style="background-color: ${isTrans ? 'transparent' : safeActiveColor};"></div>
  </div></div>`;
  return html;
}

export function renderBtnGroup(prop: string, items: { val: string, svg: string }[], activeVal: any): string {
  let html = `<div class="prop-btn-group">`;
  items.forEach(item => {
    const activeClass = String(activeVal) === item.val ? 'active' : '';
    html += `
      <button class="prop-btn ${activeClass}" data-prop="${prop}" data-val="${item.val}">
        ${item.svg}
      </button>
    `;
  });
  html += `</div>`;
  return html;
}

export function renderPropertiesPanelHTML(api: ICanvasAPI): string {
  const state = api.getState();
  const selectedShapes = state.selectedIds.map((id: string) => state.shapes.find((s: Shape) => s.id === id)).filter((s): s is Shape => !!s);

  if (selectedShapes.length === 0) return '';

  const selectedShape = selectedShapes[0]!;
  let allowedProps = SHAPE_PROPERTIES[selectedShape.type] || [];
  for (let i = 1; i < selectedShapes.length; i++) {
    const props = SHAPE_PROPERTIES[selectedShapes[i]!.type] || [];
    allowedProps = allowedProps.filter(p => props.includes(p));
  }

  let html = `<div class="prop-panel-inner">`;

  // Actions filtering
  let activeActions = [...ICONS.actions];
  if (selectedShapes.length > 1) {
    const firstGroupId = selectedShapes[0]?.groupId;
    const isPerfectGroup = firstGroupId && selectedShapes.every(s => s.groupId === firstGroupId);
    activeActions = activeActions.filter(a => a.val !== (isPerfectGroup ? 'group' : 'ungroup'));
  } else {
    const isChildOfGroup = !!selectedShape.groupId;
    if (isChildOfGroup) activeActions = activeActions.filter(a => a.val !== 'group');
    else activeActions = activeActions.filter(a => a.val !== 'group' && a.val !== 'ungroup');
  }

  const isLocked = selectedShapes.some(s => s.locked);
  
  if (allowedProps.includes('stroke')) {
    html += `<div class="prop-section ${isLocked ? 'disabled' : ''}"><div class="prop-label">Kontur</div>${renderColorSwatches('stroke', STROKE_COLORS, selectedShape.stroke)}</div>`;
  }

  if (allowedProps.includes('fill')) {
    html += `<div class="prop-section ${isLocked ? 'disabled' : ''}"><div class="prop-label">Arka plan</div>${renderColorSwatches('fill', FILL_COLORS, selectedShape.fill)}</div>`;
  }

  if (allowedProps.includes('layer')) {
    html += `<div class="prop-section ${isLocked ? 'disabled' : ''}"><div class="prop-label">Katmanlar</div>${renderBtnGroup('layer', ICONS.layers, null)}</div>`;
  }

  if (allowedProps.includes('action')) {
    html += `<div class="prop-section"><div class="prop-label">Eylemler</div><div class="prop-btn-group">${activeActions.map(item => {
      const isLockAction = item.val === 'toggle-lock';
      const isActive = isLockAction && isLocked ? 'active' : '';
      const isDisabled = !isLockAction && isLocked ? 'disabled' : '';
      return `<button class="prop-btn ${isActive} ${isLockAction ? 'lock-action' : ''}" data-prop="action" data-val="${item.val}" title="${item.val}" ${isDisabled ? 'disabled' : ''}>${item.svg}</button>`;
    }).join('')}</div></div>`;
  }

  html += `</div>`;
  return html;
}
