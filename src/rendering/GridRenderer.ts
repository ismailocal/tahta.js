import type { CanvasState } from '../core/types';
import { RENDERING_CONSTANTS } from './RenderingConstants';

class GridCache {
  private pattern: CanvasPattern | null = null;
  private lastGridSize = -1;
  private lastZoom = -1;
  private lastTheme = '';

  getPattern(
    ctx: CanvasRenderingContext2D,
    gridSize: number,
    zoom: number,
    theme: string
  ): CanvasPattern | null {
    if (!this.pattern || this.lastGridSize !== gridSize || this.lastZoom !== zoom || this.lastTheme !== theme) {
      const size = gridSize * zoom;
      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = size;
      patternCanvas.height = size;
      const pCtx = patternCanvas.getContext('2d')!;

      pCtx.strokeStyle = theme === 'light' ? RENDERING_CONSTANTS.GRID_LIGHT_COLOR : RENDERING_CONSTANTS.GRID_DARK_COLOR;
      pCtx.lineWidth = RENDERING_CONSTANTS.GRID_LINE_WIDTH;
      pCtx.beginPath();
      pCtx.moveTo(size, 0);
      pCtx.lineTo(0, 0);
      pCtx.lineTo(0, size);
      pCtx.stroke();

      this.pattern = ctx.createPattern(patternCanvas, 'repeat');
      this.lastGridSize = gridSize;
      this.lastZoom = zoom;
      this.lastTheme = theme;
    }
    return this.pattern;
  }
}

const gridCache = new GridCache();

export function renderGrid(ctx: CanvasRenderingContext2D, state: CanvasState, width: number, height: number) {
  if (!state.showGrid || !state.gridSize) return;

  const pattern = gridCache.getPattern(ctx, state.gridSize, state.viewport.zoom, state.theme || 'light');

  if (pattern) {
    ctx.save();
    const matrix = new DOMMatrix().translate(state.viewport.x, state.viewport.y);
    pattern.setTransform(matrix);

    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
