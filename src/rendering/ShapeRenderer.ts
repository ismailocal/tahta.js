import type { Shape } from '../core/types';
import { PluginRegistry } from '../plugins/index';
import { getThemeAdjustedStroke } from '../core/Utils';
import { drawLockIcon } from '../core/Utils';
import { renderShapeText } from './TextRenderer';
import { renderSelectionFrame, renderHandleBrackets, renderConnectionPoints } from './UIComponentsRenderer';

interface ShapeRenderOptions {
  isSelected: boolean;
  isErasing: boolean;
  isEditingText: boolean;
  isHovered: boolean;
  showPorts: boolean;
  theme: 'light' | 'dark';
  isDrawing: boolean;
  activePortId: string | null | undefined;
}

class RoughCache {
  private cache = new Map<string, { drawables: any[], version: string, x: number, y: number }>();

  get(shapeId: string) {
    return this.cache.get(shapeId);
  }

  set(shapeId: string, value: { drawables: any[], version: string, x: number, y: number }) {
    this.cache.set(shapeId, value);
  }

  clear() {
    this.cache.clear();
  }
}

const roughCache = new RoughCache();

// Shapes that don't go through roughjs and must not be blocked by the
// zero-dimension guard. Point-based types use a points array instead of
// width/height; image and text manage their own degenerate-dimension cases.
const NO_DIMENSION_GUARD_TYPES = new Set(['line', 'arrow', 'freehand', 'image', 'text']);

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

  const dataHash = shape.data ? JSON.stringify(shape.data) : '';
  return `${shape.type}-${theme}-${shape.seed}-${shape.width}-${shape.height}-${shape.stroke}-${shape.strokeWidth}-${shape.strokeStyle}-${shape.fill}-${shape.fillStyle}-${shape.roughness}-${shape.roundness}-${shape.cornerRadius}-${shape.edgeStyle}-${shape.startArrowhead}-${shape.endArrowhead}-${pointsHash}-${shape.x}-${shape.y}-${dataHash}`;
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
  allShapes: Shape[],
  options: ShapeRenderOptions
) {
  if (shape.type === 'text' && options.isEditingText) return;
  if (!PluginRegistry.hasPlugin(shape.type)) return;

  // Guard: box-like shapes (rectangle, ellipse, diamond, db-*) require positive
  // width AND height. A zero or negative dimension causes roughjs to generate
  // degenerate arc/path ops that contain `undefined`, crashing op.type reads.
  // Line/arrow/freehand shapes use `points` instead of width/height — skip guard.
  if (!NO_DIMENSION_GUARD_TYPES.has(shape.type)) {
    if ((shape.width ?? 0) <= 0 || (shape.height ?? 0) <= 0) return;
  }

  const plugin = PluginRegistry.getPlugin(shape.type);

  ctx.save();
  let alpha = shape.opacity ?? 1;
  if (options.isErasing) alpha *= 0.3;
  ctx.globalAlpha = alpha;

  const currentVersion = getShapeVersionHash(shape, options.theme);
  const cacheEntry = roughCache.get(shape.id);

  if (options.isDrawing && plugin.renderFast) {
    plugin.renderFast(ctx, shape, options.theme);
  } else if (cacheEntry && cacheEntry.version === currentVersion) {
    cacheEntry.drawables.forEach(d => rc.draw(d));
  } else if (plugin.getDrawable) {
    const drawables = plugin.getDrawable(rc.generator, shape, allShapes, options.theme);
    roughCache.set(shape.id, { drawables, version: currentVersion, x: shape.x, y: shape.y });
    drawables.forEach(d => rc.draw(d));
  } else {
    // Fallback for plugins that don't implement getDrawable yet
    plugin.render(rc, ctx, shape, options.isSelected, options.isErasing, allShapes, options.theme);
  }

  renderShapeText(ctx, shape, plugin, allShapes, options.isEditingText, options.theme);

  if (options.isSelected) {
    ctx.save();

    // Universal selection frame — only when selected, skip connectors
    // Also skip for freehand while drawing
    const hasResizeHandles = !plugin.getResizeHandlePositions || plugin.getResizeHandlePositions(shape).length > 0;
    if (options.isSelected && !plugin.isConnector && plugin.getBounds && !(shape.type === 'freehand' && options.isDrawing)) {
      renderSelectionFrame(ctx, plugin.getBounds(shape), options.theme, hasResizeHandles);
    }

    // Plugin-specific selection overlay (arrow/line endpoint handles, etc.)
    if (plugin.renderSelection) {
      plugin.renderSelection(ctx, shape, allShapes, options.theme);
    }

    // Centralized lock icon
    if (shape.locked && plugin.getBounds) {
      const b = plugin.getBounds(shape);
      drawLockIcon(ctx, b.x + b.width + 6, b.y - 6);
    }

    ctx.restore();
  }

  if ((options.isHovered || options.activePortId != null) && !options.isSelected && plugin.getConnectionPoints && options.showPorts) {
    renderConnectionPoints(ctx, plugin.getConnectionPoints(shape), shape.stroke, options.theme, options.activePortId);
  }

  ctx.restore();
}
