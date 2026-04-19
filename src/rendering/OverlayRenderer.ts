import type { CanvasState } from '../core/types';
import { getShapeBounds } from '../geometry/Geometry';

export function renderWelcome(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, theme: 'light' | 'dark' = 'light') {
  const { width, height } = canvas.getBoundingClientRect();
  const isLight = theme === 'light';

  ctx.save();
  // Using Slate 900 (#0f172a) for prominent contrast in light mode
  // and Slate 300 (#cbd5e0) for dark mode
  ctx.fillStyle = isLight ? '#0f172a' : '#cbd5e0';
  ctx.textAlign = 'center';
  ctx.font = `600 42px 'Architects Daughter', cursive`;
  ctx.fillText('Welcome to your whiteboard', width / 2, height / 2 - 10);

  ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(203, 213, 224, 0.6)';
  ctx.font = `20px 'Architects Daughter', cursive`;
  ctx.fillText('Bir araç seçin ve çizime başlayın.', width / 2, height / 2 + 40);
  ctx.restore();
}

function renderBindingHover(ctx: CanvasRenderingContext2D, state: CanvasState): void {
  const shape = state.shapes.find(s => s.id === state.hoveredShapeId);
  if (!shape || shape.type === 'arrow' || shape.type === 'line' || shape.type.startsWith('freehand')) return;

  ctx.save();
  const bounds = getShapeBounds(shape);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1.5 / state.viewport.zoom;
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
  ctx.restore();
}

function renderErasingPath(ctx: CanvasRenderingContext2D, state: CanvasState): void {
  const path = state.erasingPath;
  if (!path || path.length === 0) return;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;

  const alpha = 0.8 / Math.max(path.length, 1);

  for (let i = 0; i < path.length - 1; i++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(139, 147, 158, ${alpha})`;
    ctx.moveTo(path[i].x, path[i].y);
    let j;
    for (j = i + 1; j < path.length - 1; j++) {
      const xc = (path[j].x + path[j + 1].x) / 2;
      const yc = (path[j].y + path[j + 1].y) / 2;
      ctx.quadraticCurveTo(path[j].x, path[j].y, xc, yc);
    }
    if (j < path.length) {
      ctx.lineTo(path[j].x, path[j].y);
    }
    ctx.stroke();
  }
}

function renderSelectionBox(ctx: CanvasRenderingContext2D, state: CanvasState): void {
  if (!state.selectionBox) return;

  ctx.fillStyle = 'rgba(96, 165, 250, 0.08)';
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.fillRect(state.selectionBox.x, state.selectionBox.y, state.selectionBox.width, state.selectionBox.height);
  ctx.strokeRect(state.selectionBox.x, state.selectionBox.y, state.selectionBox.width, state.selectionBox.height);
}

function renderSnapLines(ctx: CanvasRenderingContext2D, state: CanvasState): void {
  if (!state.snapLines || state.snapLines.length === 0) return;

  ctx.save();
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 1 / state.viewport.zoom;
  ctx.setLineDash([4 / state.viewport.zoom, 4 / state.viewport.zoom]);
  ctx.beginPath();
  state.snapLines.forEach(line => {
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
  });
  ctx.stroke();
  ctx.restore();
}

export function renderOverlays(ctx: CanvasRenderingContext2D, state: CanvasState) {
  ctx.save();

  const isBindingHover = state.hoveredShapeId && (
    state.activeTool === 'arrow' ||
    state.activeTool === 'line'
  );

  if (isBindingHover) {
    renderBindingHover(ctx, state);
  }

  renderErasingPath(ctx, state);
  renderSelectionBox(ctx, state);
  renderSnapLines(ctx, state);

  ctx.restore();
}
