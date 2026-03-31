import type { Shape, CanvasState, ICanvasAPI } from './types';
import { PluginRegistry } from '../plugins/index';

export const createId = () => Math.random().toString(36).slice(2, 10);

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export function getThemeAdjustedStroke(stroke: string | undefined, theme: 'light' | 'dark'): string {
  const isLight = theme === 'light';
  
  if (!stroke) return isLight ? '#1e293b' : '#f8fafc';
  
  // If the stored stroke is too light for light mode, or too dark for dark mode, adjust it for visibility.
  // This helps when shapes are created in one mode and viewed in another.
  const s = stroke.toLowerCase();
  
  const lightColors = ['#cbd5e0', '#e2e8f0', '#f8fafc', '#f1f5f9', '#ffffff', '#e5e7eb', '#d1d5db'];
  const darkColors = ['#1e293b', '#0f172a', '#111827', '#131316', '#1e1e24', '#000000'];
  
  if (isLight && lightColors.includes(s)) return '#1e293b'; // Slate 800
  if (!isLight && darkColors.includes(s)) return '#f8fafc'; // Off-white
  
  return stroke;
}

export function hexToRgba(hex: string, alpha = 1): string {
  const safe = hex.replace('#', '');
  const [r, g, b] = safe.length === 3
    ? safe.split('').map((item) => parseInt(item + item, 16))
    : [safe.slice(0, 2), safe.slice(2, 4), safe.slice(4, 6)].map((item) => parseInt(item, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function rgbaToHex(color?: string): string {
  if (!color || color === 'transparent') return '#ffffff';
  if (color.startsWith('#')) return color;
  const values = color.match(/\d+/g);
  if (!values || values.length < 3) return '#ffffff';
  return `#${values.slice(0, 3).map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getOpacityFromColor(color?: string): number {
  if (!color || color === 'transparent') return 0;
  const values = color.match(/[\d.]+/g);
  if (!values || values.length < 4) return 1;
  return clamp(Number(values[3]), 0, 1);
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
  api.batchUpdate(() => {
    state.shapes.forEach((dependentShape) => {
      if (PluginRegistry.hasPlugin(dependentShape.type)) {
        const plugin = PluginRegistry.getPlugin(dependentShape.type);
        if (plugin.onBoundShapeChange) {
          const patch = plugin.onBoundShapeChange(dependentShape, state.shapes, changedShapeIds);
          if (patch) {
            api.updateShape(dependentShape.id, patch, true);
          }
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
