import type { Shape } from '../core/types';
import { getShapePlugin } from '../plugins/index';
import type { ShapeRegistry } from '../core/registry';
import { drawLockIcon } from '../core/Utils';
import { renderShapeText } from './TextRenderer';
import { renderSelectionFrame, renderConnectionPoints } from './UIComponentsRenderer';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Drawable } from 'roughjs/bin/core';

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

export class ShapeRenderCache {
  private cache = new Map<string, { drawables: Drawable[]; shape: Shape; theme: 'light' | 'dark' }>();

  get(shapeId: string) {
    const value = this.cache.get(shapeId);
    if (!value) return undefined;
    this.cache.delete(shapeId);
    this.cache.set(shapeId, value);
    return value;
  }

  set(shapeId: string, value: { drawables: Drawable[]; shape: Shape; theme: 'light' | 'dark' }) {
    if (!this.cache.has(shapeId) && this.cache.size >= 500) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(shapeId, value);
  }

  clear() {
    this.cache.clear();
  }
}

// Shapes that don't go through roughjs and must not be blocked by the
// zero-dimension guard. Point-based types use a points array instead of
// width/height; image and text manage their own degenerate-dimension cases.
const NO_DIMENSION_GUARD_TYPES = new Set(['line', 'arrow', 'freehand', 'image', 'text']);

/**
 * The main dispatch for rendering a single shape using its plugin.
 * Handles alpha, options mapping, caching logic, and dispatches to
 * sub-renderers for text and UI indicators.
 */
export function renderShape(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  allShapes: Shape[],
  options: ShapeRenderOptions,
  registry: ShapeRegistry,
  cache: ShapeRenderCache,
) {
  if (shape.type === 'text' && options.isEditingText) return;

  // Guard: box-like shapes (rectangle, ellipse, diamond, db-*) require positive
  // width AND height. A zero or negative dimension causes roughjs to generate
  // degenerate arc/path ops that contain `undefined`, crashing op.type reads.
  // Line/arrow/freehand shapes use `points` instead of width/height — skip guard.
  if (!NO_DIMENSION_GUARD_TYPES.has(shape.type)) {
    if ((shape.width ?? 0) <= 0 || (shape.height ?? 0) <= 0) return;
  }

  const plugin = getShapePlugin(registry, shape.type);

  ctx.save();
  let alpha = shape.opacity ?? 1;
  if (options.isErasing) alpha *= 0.3;
  ctx.globalAlpha = alpha;

  const cacheEntry = cache.get(shape.id);

  if (options.isDrawing && plugin.renderFast) {
    plugin.renderFast(ctx, shape, options.theme);
  } else if (cacheEntry?.shape === shape && cacheEntry.theme === options.theme) {
    cacheEntry.drawables.forEach((drawable) => rc.draw(drawable));
  } else if (plugin.getDrawable) {
    const drawables = plugin.getDrawable(rc.generator, shape, allShapes, options.theme);
    cache.set(shape.id, { drawables, shape, theme: options.theme });
    drawables.forEach((drawable) => rc.draw(drawable));
  } else {
    // Canvas-native plugins render directly; Rough.js plugins use cached drawables.
    plugin.render(rc, ctx, shape, options.isSelected, options.isErasing, allShapes, options.theme);
  }

  renderShapeText(ctx, shape, plugin, allShapes, options.isEditingText, options.theme);

  if (options.isSelected) {
    ctx.save();

    // Universal selection frame — only when selected, skip connectors
    // Also skip for freehand while drawing and locked shapes
    const hasResizeHandles = !plugin.getResizeHandlePositions || plugin.getResizeHandlePositions(shape).length > 0;
    if (options.isSelected && !shape.locked && !plugin.isConnector && plugin.getBounds && !(shape.type === 'freehand' && options.isDrawing)) {
      renderSelectionFrame(ctx, plugin.getBounds(shape), options.theme, hasResizeHandles);
    }

    // Plugin-specific selection overlay (arrow/line endpoint handles, etc.)
    if (plugin.renderSelection && !shape.locked) {
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
