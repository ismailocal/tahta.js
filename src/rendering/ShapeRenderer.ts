import type { Shape } from '../core/types';
import { PluginRegistry } from '../plugins/index';
import { getThemeAdjustedStroke } from '../core/Utils';
import { renderShapeText } from './TextRenderer';
import { renderHandleBrackets, renderConnectionPoints } from './UIComponentsRenderer';

const roughCache = new Map<string, { drawables: any[], version: string, x: number, y: number }>();

/**
 * Computes a hash of all visual properties to determine if a cached element
 * needs a re-render. Handles theme changes.
 */
function getShapeVersionHash(shape: Shape, theme: string): string {
  return JSON.stringify({
    type: shape.type,
    theme,
    seed: shape.seed,
    width: shape.width,
    height: shape.height,
    points: shape.points,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    strokeStyle: shape.strokeStyle,
    fill: shape.fill,
    fillStyle: shape.fillStyle,
    roughness: shape.roughness,
    roundness: shape.roundness,
    edgeStyle: shape.edgeStyle,
    startArrowhead: shape.startArrowhead,
    endArrowhead: shape.endArrowhead,
    data: shape.data,
  });
}

/**
 * The main dispatch for rendering a single shape using its plugin.
 * Handles alpha, options mapping, caching logic, and dispatches to
 * sub-renderers for text and UI indicators.
 */
export function renderShape(
  rc: any,
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  isSelected: boolean,
  isErasing: boolean = false,
  allShapes: Shape[] = [],
  isEditingText: boolean = false,
  isHovered: boolean = false,
  showPorts: boolean = false,
  theme: 'light' | 'dark' = 'light'
) {
  if (shape.type === 'text' && isEditingText) return;
  if (!PluginRegistry.hasPlugin(shape.type)) return;
  const plugin = PluginRegistry.getPlugin(shape.type);

  ctx.save();
  let alpha = shape.opacity ?? 1;
  if (isErasing) alpha *= 0.3;
  ctx.globalAlpha = alpha;

  // Versions are tracked to permit caching if expensive generator calls are needed.
  // Note: current implementation directly calls plugin.render which bypasses generator cache,
  // but we maintain the structure for future performance optimizations.
  const currentVersion = getShapeVersionHash(shape, theme);
  const _cacheEntry = roughCache.get(shape.id);
  
  plugin.render(rc, ctx, shape, isSelected, isErasing, allShapes, theme);
  
  renderShapeText(ctx, shape, plugin, allShapes, isEditingText, theme);

  if ((isSelected || isHovered) && plugin.renderSelection) {
    ctx.save();
    const handles = plugin.getResizeHandlePositions ? plugin.getResizeHandlePositions(shape) : [];
    renderHandleBrackets(ctx, handles, shape.stroke, theme);
    plugin.renderSelection(ctx, shape, allShapes, theme);
    ctx.restore();
  }

  if (isHovered && !isSelected && plugin.getConnectionPoints && showPorts) {
    renderConnectionPoints(ctx, plugin.getConnectionPoints(shape), shape.stroke, theme);
  }

  ctx.restore();
}
