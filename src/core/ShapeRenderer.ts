import type { Shape, ConnectionPoint } from '../core/types';
import { PluginRegistry } from '../plugins/index';

const roughCache = new Map<string, { drawables: any[], version: string, x: number, y: number }>();

function getShapeVersionHash(shape: Shape): string {
  // Only include properties that affect the core path/geometry of the Rough shape
  // x, y are handled by relative translation in the cache logic below.
  return JSON.stringify({
    type: shape.type,
    seed: shape.seed,
    width: shape.width,
    height: shape.height,
    points: shape.points,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    strokeStyle: shape.strokeStyle,
    fill: shape.fill,
    fillStyle: shape.fillStyle,
    roundness: shape.roundness,
    edgeStyle: shape.edgeStyle,
    startArrowhead: shape.startArrowhead,
    endArrowhead: shape.endArrowhead
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
  isHovered: boolean = false
) {
  if (shape.type === 'text' && isEditingText) return;
  if (!PluginRegistry.hasPlugin(shape.type)) return;
  const plugin = PluginRegistry.getPlugin(shape.type);

  ctx.save();
  let alpha = shape.opacity ?? 1;
  if (isErasing) alpha *= 0.3;
  ctx.globalAlpha = alpha;

  const currentVersion = getShapeVersionHash(shape);
  const cacheEntry = roughCache.get(shape.id);
  
  let callIdx = 0;
  const isCacheValid = cacheEntry && cacheEntry.version === currentVersion;
  const cacheList = isCacheValid ? cacheEntry.drawables : [];
  const nextCache: any[] = [];
  
  const rcProxy = {
    wrap: (type: string, ...args: any[]) => {
      let d;
      let dx = 0, dy = 0;
      if (isCacheValid && cacheList[callIdx]) {
        d = cacheList[callIdx];
        dx = shape.x - cacheEntry.x;
        dy = shape.y - cacheEntry.y;
      } else {
        d = (rc.generator as any)[type](...args);
      }
      nextCache[callIdx] = d;
      callIdx++;

      if (dx !== 0 || dy !== 0) {
        ctx.save();
        ctx.translate(dx, dy);
        rc.draw(d);
        ctx.restore();
      } else {
        rc.draw(d);
      }
    },
    rectangle:  (...args: any[]) => rcProxy.wrap('rectangle', ...args),
    ellipse:    (...args: any[]) => rcProxy.wrap('ellipse', ...args),
    line:       (...args: any[]) => rcProxy.wrap('line', ...args),
    path:       (...args: any[]) => rcProxy.wrap('path', ...args),
    linearPath: (...args: any[]) => rcProxy.wrap('linearPath', ...args),
    curve:      (...args: any[]) => rcProxy.wrap('curve', ...args),
    polygon:    (...args: any[]) => rcProxy.wrap('polygon', ...args),
  };

  plugin.render(rcProxy, ctx, shape, isSelected, isErasing, allShapes);
  
  if (!isCacheValid && nextCache.length > 0) {
    roughCache.set(shape.id, { 
      drawables: nextCache, 
      version: currentVersion,
      x: shape.x,
      y: shape.y
    });
  }

  renderShapeText(ctx, shape, plugin, allShapes, isEditingText);

  if ((isSelected || isHovered) && plugin.renderSelection) {
    plugin.renderSelection(ctx, shape, allShapes);
  }
  if ((isSelected || isHovered) && !plugin.isConnector && !plugin.customSelectionBrackets && plugin.getBounds) {
    const bounds = plugin.getBounds(shape);
    const bracketRadius = plugin.getBracketRadius ? plugin.getBracketRadius(shape) : 0;
    renderCornerBrackets(ctx, bounds, !!plugin.cornersOnly, bracketRadius);
  }
  if (isHovered || isSelected) {
    renderHoverBorder(ctx, shape, plugin);
  }
  if (isHovered && !isSelected && plugin.getConnectionPoints) {
    renderConnectionPoints(ctx, plugin.getConnectionPoints(shape));
  }
  ctx.restore();
}

function renderShapeText(
  ctx: CanvasRenderingContext2D, 
  shape: Shape, 
  plugin: any, 
  allShapes: Shape[], 
  isEditingText: boolean
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
    ctx.fillStyle = '#131316'; // background mask
    ctx.fillRect(cx - maxWidth / 2 - padding, cy - totalHeight / 2 - padding, maxWidth + padding * 2, totalHeight + padding * 2);
  }

  ctx.fillStyle = shape.stroke || '#f8fafc';
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

function renderCornerBrackets(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  cornersOnly = false,
  radius = 0
) {
  const { x, y, width: w, height: h } = bounds;
  const arm = Math.min(12, w * 0.2, h * 0.2); // bracket arm length
  const color = '#60a5fa';

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  if (radius > 0) {
    // Arc brackets at each rounded corner
    const r = Math.min(radius, w / 2, h / 2);
    const span = Math.min(arm / r, Math.PI / 4);
    // midpoint angles (clockwise canvas arcs): NW=5π/4, NE=7π/4, SW=3π/4, SE=π/4
    [
      { cx: x + r,     cy: y + r,     mid: 5 * Math.PI / 4 }, // NW
      { cx: x + w - r, cy: y + r,     mid: 7 * Math.PI / 4 }, // NE
      { cx: x + r,     cy: y + h - r, mid: 3 * Math.PI / 4 }, // SW
      { cx: x + w - r, cy: y + h - r, mid: 1 * Math.PI / 4 }, // SE
    ].forEach(({ cx, cy, mid }) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, mid - span, mid + span, false);
      ctx.stroke();
    });
  } else {
    const corners = [
      { cx: x,     cy: y,     dx:  1, dy:  1 }, // NW
      { cx: x + w, cy: y,     dx: -1, dy:  1 }, // NE
      { cx: x,     cy: y + h, dx:  1, dy: -1 }, // SW
      { cx: x + w, cy: y + h, dx: -1, dy: -1 }, // SE
    ];

    corners.forEach(({ cx, cy, dx, dy }) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx * arm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * arm);
      ctx.stroke();
    });
  }

  if (!cornersOnly) {
    // Edge midpoint ticks
    const tick = Math.min(8, arm);
    [
      { px: x + w / 2, py: y,         horiz: true  }, // N
      { px: x + w / 2, py: y + h,     horiz: true  }, // S
      { px: x,         py: y + h / 2, horiz: false }, // W
      { px: x + w,     py: y + h / 2, horiz: false }, // E
    ].forEach(({ px, py, horiz }) => {
      ctx.beginPath();
      if (horiz) { ctx.moveTo(px - tick, py); ctx.lineTo(px + tick, py); }
      else       { ctx.moveTo(px, py - tick); ctx.lineTo(px, py + tick); }
      ctx.stroke();
    });
  }

  ctx.restore();
}

function renderConnectionPoints(ctx: CanvasRenderingContext2D, points: ConnectionPoint[]) {
  ctx.setLineDash([]);
  points.forEach(cp => {
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1e24';
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}
