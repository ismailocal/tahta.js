import { getThemeAdjustedStroke } from '../core/Utils';
import type { Shape, ConnectionPoint } from '../core/types';

/**
 * Visual indicators for selecting, hovering, and connecting shapes.
 * All functions use shared canvas state where possible to reduce boilerplate.
 */

/**
 * Draws rounded rectangular hover highlights.
 */
export function renderHoverBorder(ctx: CanvasRenderingContext2D, shape: Shape, plugin: any) {
  if (!plugin.getBounds || plugin.isConnector) return;
  const { x, y, width: w, height: h } = plugin.getBounds(shape);
  ctx.save();
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.setLineDash([]);
  if (plugin.drawHoverOutline) {
    plugin.drawHoverOutline(ctx, shape);
  } else {
    const r = plugin.getBracketRadius ? plugin.getBracketRadius(shape) : 0;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Central bracket renderer. Each handle provides a `draw` closure that renders
 * its own indicator (arc, L-bracket, tick, ellipse arc…). The renderer only
 * sets up shared canvas state and dispatches — no shape-specific logic here.
 */
export function renderHandleBrackets(
  ctx: CanvasRenderingContext2D,
  handles: Array<{ x: number; y: number; angle: number; draw?: (ctx: CanvasRenderingContext2D) => void }>,
  shapeStroke?: string,
  theme: 'light' | 'dark' = 'dark'
) {
  if (!handles.length) return;

  const fallback = theme === 'light' ? '#475569' : '#cbd5e0';
  const effectiveStroke = (!shapeStroke || shapeStroke === 'transparent' || shapeStroke === 'none')
    ? fallback
    : shapeStroke;

  ctx.save();
  ctx.strokeStyle = effectiveStroke;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  for (const h of handles) {
    if (h.draw) {
      h.draw(ctx);
    }
  }

  ctx.restore();
}

/**
 * Small diamond-shaped connection targets for arrows.
 */
export function renderConnectionPoints(
  ctx: CanvasRenderingContext2D, 
  points: ConnectionPoint[], 
  shapeStroke?: string, 
  theme: 'light' | 'dark' = 'dark'
) {
  const s = 5; // half-size of the diamond icon
  ctx.setLineDash([]);
  ctx.strokeStyle = shapeStroke || (theme === 'light' ? '#475569' : '#cbd5e0');
  ctx.lineWidth = 1.5;
  
  points.forEach(cp => {
    ctx.beginPath();
    ctx.moveTo(cp.x,     cp.y - s);
    ctx.lineTo(cp.x + s, cp.y    );
    ctx.lineTo(cp.x,     cp.y + s);
    ctx.lineTo(cp.x - s, cp.y    );
    ctx.closePath();
    
    ctx.fillStyle = theme === 'light' ? '#ffffff' : '#1e1e24'; 
    ctx.strokeStyle = getThemeAdjustedStroke(shapeStroke, theme);
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
  });
}
