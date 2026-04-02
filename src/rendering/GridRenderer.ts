import type { CanvasState } from '../core/types';

let gridPattern: CanvasPattern | null = null;
let lastGridSize = -1;
let lastZoom = -1;

export function renderGrid(ctx: CanvasRenderingContext2D, state: CanvasState, width: number, height: number) {
  if (!state.showGrid || !state.gridSize) return;

  const size = state.gridSize * state.viewport.zoom;
  
  if (!gridPattern || lastGridSize !== state.gridSize || lastZoom !== state.viewport.zoom) {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = size;
    patternCanvas.height = size;
    const pCtx = patternCanvas.getContext('2d')!;
    
    pCtx.strokeStyle = state.theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    pCtx.lineWidth = 1;
    pCtx.beginPath();
    pCtx.moveTo(size, 0);
    pCtx.lineTo(0, 0);
    pCtx.lineTo(0, size);
    pCtx.stroke();
    
    gridPattern = ctx.createPattern(patternCanvas, 'repeat');
    lastGridSize = state.gridSize;
    lastZoom = state.viewport.zoom;
  }

  if (gridPattern) {
    ctx.save();
    // Offset pattern by viewport
    const matrix = new DOMMatrix().translate(state.viewport.x, state.viewport.y);
    gridPattern.setTransform(matrix);
    
    ctx.fillStyle = gridPattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
