import rough from 'roughjs';
import type { Shape, ConnectionPoint } from '../core/types';
import { getArrowClippedEndpoints, getElbowPath, getPathMidpoint } from './lineUtils';
import { getShapeBounds } from './Geometry';
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

  if (isSelected && plugin.renderSelection) {
    plugin.renderSelection(ctx, shape, allShapes);
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
