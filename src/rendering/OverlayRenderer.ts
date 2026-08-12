import type { CanvasState } from '../core/types';
import { getShapeBounds } from '../geometry/Geometry';
import type { ShapeRegistry } from '../core/registry';
import { LASER_TRAIL_LIFETIME_MS, hasVisibleLaserPoints, type LaserPoint } from '../core/laser';

function fitCanvasFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  availableWidth: number,
  preferredSize: number,
  minimumSize: number,
  weight = '',
): number {
  ctx.font = `${weight}${preferredSize}px 'Architects Daughter', cursive`;
  const measuredWidth = ctx.measureText(text).width;
  return measuredWidth > availableWidth
    ? Math.max(minimumSize, Math.floor(preferredSize * availableWidth / measuredWidth))
    : preferredSize;
}

export function renderWelcome(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, theme: 'light' | 'dark' = 'light') {
  const { width, height } = canvas.getBoundingClientRect();
  const isLight = theme === 'light';
  const availableWidth = Math.max(240, width - 32);
  const title = 'Welcome to your whiteboard';
  const hint = 'Choose a tool and start drawing.';

  ctx.save();
  // Using Slate 900 (#0f172a) for prominent contrast in light mode
  // and Slate 300 (#cbd5e0) for dark mode
  ctx.fillStyle = isLight ? '#0f172a' : '#cbd5e0';
  ctx.textAlign = 'center';
  ctx.font = `600 ${fitCanvasFontSize(ctx, title, availableWidth, 42, 24, '600 ')}px 'Architects Daughter', cursive`;
  ctx.fillText(title, width / 2, height / 2 - 10);

  ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(203, 213, 224, 0.6)';
  ctx.font = `${fitCanvasFontSize(ctx, hint, availableWidth, 20, 14)}px 'Architects Daughter', cursive`;
  ctx.fillText(hint, width / 2, height / 2 + 40);
  ctx.restore();
}

function renderBindingHover(ctx: CanvasRenderingContext2D, state: CanvasState, registry: ShapeRegistry): void {
  const shape = state.shapes.find(s => s.id === state.hoveredShapeId);
  if (!shape || shape.type === 'arrow' || shape.type === 'line' || shape.type.startsWith('freehand')) return;

  ctx.save();
  const bounds = getShapeBounds(shape, registry);
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

export interface ResizeMeasurement {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export function getResizeMeasurement(state: CanvasState, registry: ShapeRegistry): ResizeMeasurement | null {
  if (!state.resizingShapeId) return null;
  const shape = state.shapes.find(({ id }) => id === state.resizingShapeId);
  if (!shape) return null;
  const bounds = getShapeBounds(shape, registry);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height,
    width: bounds.width,
    height: bounds.height,
    label: `${Math.round(bounds.width)} × ${Math.round(bounds.height)}`,
  };
}

function renderResizeMeasurement(ctx: CanvasRenderingContext2D, state: CanvasState, registry: ShapeRegistry): void {
  const measurement = getResizeMeasurement(state, registry);
  if (!measurement) return;
  const zoom = Math.max(state.viewport.zoom, 0.05);
  const fontSize = 11 / zoom;
  const horizontalPadding = 7 / zoom;
  const height = 22 / zoom;
  const y = measurement.y + 18 / zoom;

  ctx.save();
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(measurement.label).width + horizontalPadding * 2;
  ctx.fillStyle = state.theme === 'dark' ? 'rgba(248, 250, 252, 0.94)' : 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(measurement.x - width / 2, y - height / 2, width, height);
  ctx.fillStyle = state.theme === 'dark' ? '#0f172a' : '#ffffff';
  ctx.fillText(measurement.label, measurement.x, y);
  ctx.restore();
}

export function renderLaserTrail(
  ctx: CanvasRenderingContext2D,
  points: readonly LaserPoint[],
  color: string,
  zoom: number,
  timestamp: number,
): void {
  const firstVisibleIndex = points.findIndex((point) => timestamp - point.timestamp < LASER_TRAIL_LIFETIME_MS);
  if (firstVisibleIndex < 0) return;
  const scale = Math.max(zoom, 0.05);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3 / scale;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5 / scale;
  for (let index = firstVisibleIndex; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];
    const alpha = Math.max(0, Math.min(1, 1 - (timestamp - current.timestamp) / LASER_TRAIL_LIFETIME_MS));
    ctx.globalAlpha = alpha;
    if (index > firstVisibleIndex && previous?.strokeId === current.strokeId) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(current.x, current.y, 2.5 / scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function hasActiveLaserAnimation(state: CanvasState, timestamp = Date.now()): boolean {
  if (hasVisibleLaserPoints(state.laserTrail ?? [], timestamp)) return true;
  for (const collaborator of state.collaborators?.values() ?? []) {
    if (hasVisibleLaserPoints(collaborator.laserTrail ?? [], timestamp)) return true;
  }
  return false;
}

function renderLaserTrails(ctx: CanvasRenderingContext2D, state: CanvasState, timestamp: number): void {
  renderLaserTrail(ctx, state.laserTrail ?? [], '#ef4444', state.viewport.zoom, timestamp);
  state.collaborators?.forEach((collaborator) => {
    renderLaserTrail(ctx, collaborator.laserTrail ?? [], collaborator.color, state.viewport.zoom, timestamp);
  });
}

export function renderOverlays(ctx: CanvasRenderingContext2D, state: CanvasState, registry: ShapeRegistry) {
  ctx.save();

  const isBindingHover = state.hoveredShapeId && (
    state.activeTool === 'arrow' ||
    state.activeTool === 'line'
  );

  if (isBindingHover) {
    renderBindingHover(ctx, state, registry);
  }

  renderErasingPath(ctx, state);
  renderSelectionBox(ctx, state);
  renderSnapLines(ctx, state);
  renderLaserTrails(ctx, state, Date.now());
  renderResizeMeasurement(ctx, state, registry);

  ctx.restore();
}
