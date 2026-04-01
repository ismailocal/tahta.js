import type { Shape, ConnectionPoint } from './types';
import { PluginRegistry } from '../plugins/index';
import { drawLockIcon, getThemeAdjustedStroke } from './Utils';

const roughCache = new Map<string, { drawables: any[], version: string, x: number, y: number }>();

function getShapeVersionHash(shape: Shape, theme: string): string {
  // Include theme in hash to ensure re-render when switching light/dark mode
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
  theme: 'light' | 'dark' = 'light' // Changed default from 'dark' to 'light'
) {
  // if (theme === 'dark') console.error('[tahta.js] THEME IS DARK! State:', theme);
  if (shape.type === 'text' && isEditingText) return;
  if (!PluginRegistry.hasPlugin(shape.type)) return;
  const plugin = PluginRegistry.getPlugin(shape.type);

  ctx.save();
  let alpha = shape.opacity ?? 1;
  if (isErasing) alpha *= 0.3;
  ctx.globalAlpha = alpha;

  // Force re-render on selection, hover or theme change
  const options: any = {
    stroke: getThemeAdjustedStroke(shape.stroke, theme),
    strokeWidth: shape.strokeWidth || 1.8,
    roughness: shape.roughness ?? 0,
    seed: shape.seed ?? 1,
  };

  const currentVersion = getShapeVersionHash(shape, theme);
  const cacheEntry = roughCache.get(shape.id);
  
  let callIdx = 0;
  const isCacheValid = cacheEntry && cacheEntry.version === currentVersion;
  const cacheList = isCacheValid ? cacheEntry.drawables : [];
  const nextCache: any[] = [];
  
  // plugin expects something that looks like RoughCanvas.
  // We pass 'rc' through directly to ensure direct method calls like rc.ellipse(...)
  // which works more reliably than manual generator.draw() sequences.
  plugin.render(rc, ctx, shape, isSelected, isErasing, allShapes, theme);
  
  if (!isCacheValid && nextCache.length > 0) {
    roughCache.set(shape.id, { 
      drawables: nextCache, 
      version: currentVersion,
      x: shape.x,
      y: shape.y
    });
  }

  renderShapeText(ctx, shape, plugin, allShapes, isEditingText, theme);

  if ((isSelected || isHovered) && plugin.renderSelection) {
    ctx.save();
    const handles = plugin.getResizeHandlePositions ? plugin.getResizeHandlePositions(shape) : [];
    renderHandleBrackets(ctx, handles, shape.stroke, theme);
    plugin.renderSelection(ctx, shape, allShapes, theme);
    ctx.restore();
  }
  // Hover border intentionally omitted — shape color/style must not change on hover
  if (isHovered && !isSelected && plugin.getConnectionPoints && showPorts) {
    renderConnectionPoints(ctx, plugin.getConnectionPoints(shape), shape.stroke, theme);
  }
  ctx.restore();
}

function renderShapeText(
  ctx: CanvasRenderingContext2D, 
  shape: Shape, 
  plugin: any, 
  allShapes: Shape[], 
  isEditingText: boolean,
  theme: 'light' | 'dark'
) {
  if (shape.type === 'text' || !shape.text || isEditingText) return;

  const fontSize = shape.fontSize || 20;
  ctx.font = `${fontSize}px ${shape.fontFamily || "'Architects Daughter', cursive"}`;
  
  let cx = 0;
  let cy = 0;

  const textAnchor = plugin.getTextAnchor?.(shape, allShapes);
  if (textAnchor) {
    cx = textAnchor.x;
    cy = textAnchor.y;
  } else {
    const bounds = plugin.getBounds(shape);
    cx = bounds.x + bounds.width / 2;
    cy = bounds.y + bounds.height / 2;
  }

  const lines = shape.text.split('\n');
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;

  if (plugin.isConnector) {
    let maxWidth = 0;
    lines.forEach(line => {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    });
    const padding = 4;
    ctx.fillStyle = theme === 'light' ? '#f8fafc' : '#131316'; // background mask matches canvas
    ctx.fillRect(cx - maxWidth / 2 - padding, cy - totalHeight / 2 - padding, maxWidth + padding * 2, totalHeight + padding * 2);
  }

  const textColor = getThemeAdjustedStroke(shape.stroke, theme); // text color matches shape stroke
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  let startY = cy - (totalHeight / 2) + (lineHeight / 2);
  lines.forEach((line) => {
    ctx.fillText(line, cx, startY);
    startY += lineHeight;
  });
}

function renderHoverBorder(ctx: CanvasRenderingContext2D, shape: Shape, plugin: any) {
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
function renderHandleBrackets(
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

function renderConnectionPoints(ctx: CanvasRenderingContext2D, points: ConnectionPoint[], shapeStroke?: string, theme: 'light' | 'dark' = 'dark') {
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
