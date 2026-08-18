import type { Shape, CanvasState, ICanvasAPI } from './types';
import { getShapePlugin } from '../plugins/index';

export const createId = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export function getThemeAdjustedStroke(stroke: string | undefined, theme: 'light' | 'dark'): string {
  if (!stroke) return '#64748b'; // neutral grey, visible in both modes

  // Adjust strokes that are too light for light mode or too dark for dark mode.
  const s = stroke.toLowerCase();
  const isLight = theme === 'light';

  const tooLightForLight = ['#cbd5e0', '#e2e8f0', '#f8fafc', '#f1f5f9', '#ffffff', '#e5e7eb', '#d1d5db'];
  const tooDarkForDark   = ['#1e293b', '#0f172a', '#111827', '#131316', '#1e1e24', '#000000'];

  if (isLight && tooLightForLight.includes(s)) return '#475569'; // slate-600
  if (!isLight && tooDarkForDark.includes(s))  return '#94a3b8'; // slate-400

  return stroke;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getTextMetrics(shape: Shape) {
  const lines = (shape.text || '').split('\n');
  const fontSize = shape.fontSize || 20;
  return {
    lines,
    width: Math.max(40, Math.max(...lines.map((line) => line.length || 1)) * fontSize * 0.62),
    height: Math.max(fontSize, lines.length * fontSize * 1.25),
  };
}

export function updateDependentShapes(state: CanvasState, api: ICanvasAPI, changedShapeIds: string[]) {
  if (changedShapeIds.length === 0) return;
  const changed = new Set(changedShapeIds);
  const index = api.getSpatialIndex();
  const projectedChanges = new Set(state.changedShapeIds ?? changedShapeIds);
  const movedTargets = new Set(
    [...index.expandDescendants(changed)].filter((id) => changed.has(id) || projectedChanges.has(id)),
  );
  const movedTargetIds = [...movedTargets];
  const dependentIds = index.expandConnected(movedTargets, 1);
  api.batchUpdate(() => {
    dependentIds.forEach((id) => {
      if (movedTargets.has(id)) return;
      const dependentShape = index.getShape(id);
      if (!dependentShape) return;
      const plugin = getShapePlugin(api.registry, dependentShape.type);
      if (plugin.onBoundShapeChange) {
        const patch = plugin.onBoundShapeChange(dependentShape, state.shapes, movedTargetIds, api.registry);
        if (patch) {
          api.updateShape(dependentShape.id, patch, true);
        }
      }
    });
  });
}

export function drawLockIcon(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 10) {
  ctx.save();
  ctx.translate(x, y);
  
  // Background circle
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Lock body
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-4, -1, 8, 6);
  
  // Lock shackle
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -1, 3, Math.PI, 0);
  ctx.stroke();
  
  ctx.restore();
}
