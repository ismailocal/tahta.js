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
  // Performance optimization: Avoid JSON.Stringify on massive points arrays.
  // Instead, use length and last point coordinates as a version proxy.
  const pointsHash = shape.points && shape.points.length > 0
    ? `${shape.points.length}-${shape.points[shape.points.length - 1].x}-${shape.points[shape.points.length - 1].y}`
    : 'no-pts';

  return `${shape.type}-${theme}-${shape.seed}-${shape.width}-${shape.height}-${shape.stroke}-${shape.strokeWidth}-${shape.strokeStyle}-${shape.fill}-${shape.fillStyle}-${shape.roughness}-${shape.roundness}-${shape.edgeStyle}-${shape.startArrowhead}-${shape.endArrowhead}-${pointsHash}-${shape.x}-${shape.y}`;
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
  theme: 'light' | 'dark' = 'light',
  isDrawing: boolean = false
) {
  if (shape.type === 'text' && isEditingText) return;
  if (!PluginRegistry.hasPlugin(shape.type)) return;
  const plugin = PluginRegistry.getPlugin(shape.type);

  ctx.save();
  let alpha = shape.opacity ?? 1;
  if (isErasing) alpha *= 0.3;
  ctx.globalAlpha = alpha;

  const currentVersion = getShapeVersionHash(shape, theme);
  const cacheEntry = roughCache.get(shape.id);
  
  if (isDrawing && plugin.renderFast) {
    plugin.renderFast(ctx, shape, theme);
  } else if (cacheEntry && cacheEntry.version === currentVersion) {
    cacheEntry.drawables.forEach(d => rc.draw(d));
  } else if (plugin.getDrawable) {
    const drawables = plugin.getDrawable(rc.generator, shape, allShapes, theme);
    roughCache.set(shape.id, { drawables, version: currentVersion, x: shape.x, y: shape.y });
    drawables.forEach(d => rc.draw(d));
  } else {
    // Fallback for plugins that don't implement getDrawable yet
    plugin.render(rc, ctx, shape, isSelected, isErasing, allShapes, theme);
  }
  
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
