import { getThemeAdjustedStroke } from '../core/Utils';
import type { Shape } from '../core/types';

function renderConnectorText(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  plugin: any,
  allShapes: Shape[],
  theme: 'light' | 'dark'
): void {
  const textAnchor = plugin.getTextAnchor?.(shape, allShapes);
  if (!textAnchor) return;

  const fontSize = shape.fontSize || 20;
  const fontFamily = shape.fontFamily || "'Architects Daughter', cursive";
  ctx.font = `${fontSize}px ${fontFamily}`;

  const lineHeight = fontSize * 1.2;
  const rawLines = shape.text!.split('\n');
  const cx = textAnchor.x;
  const cy = textAnchor.y;

  const totalHeight = rawLines.length * lineHeight;
  let maxWidth = 0;
  rawLines.forEach(line => {
    const w = ctx.measureText(line).width;
    if (w > maxWidth) maxWidth = w;
  });

  const padding = 4;
  ctx.fillStyle = theme === 'light' ? '#f8fafc' : '#131316';
  ctx.fillRect(cx - maxWidth / 2 - padding, cy - totalHeight / 2 - padding, maxWidth + padding * 2, totalHeight + padding * 2);

  ctx.fillStyle = shape.textColor || getThemeAdjustedStroke(shape.stroke, theme);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let y = cy - (totalHeight / 2) + (lineHeight / 2);
  rawLines.forEach(line => {
    ctx.fillText(line, cx, y);
    y += lineHeight;
  });
}

function renderBoundedShapeText(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  plugin: any,
  theme: 'light' | 'dark'
): void {
  const bounds = plugin.getBounds?.(shape);
  if (!bounds) return;

  const fontSize = shape.fontSize || 20;
  const fontFamily = shape.fontFamily || "'Architects Daughter', cursive";
  ctx.font = `${fontSize}px ${fontFamily}`;

  const lineHeight = fontSize * 1.2;
  const rawLines = shape.text!.split('\n');

  const textAlign: 'left' | 'center' | 'right' = shape.textAlign || 'center';
  const verticalAlign: 'top' | 'middle' | 'bottom' = shape.textVerticalAlign || 'middle';
  const paddingX = shape.textPaddingX ?? 8;
  const paddingY = shape.textPaddingY ?? 8;
  const availW = bounds.width - paddingX * 2;
  const availH = bounds.height - paddingY * 2;

  // Word-wrap is always applied
  let lines = rawLines;
  if (availW > 0) {
    lines = [];
    for (const rawLine of rawLines) {
      const wrapped = wrapLine(ctx, rawLine, availW);
      lines.push(...wrapped);
    }
  }

  // Auto-shrink font to fit height if wrapping
  let effectiveFontSize = fontSize;
  if (availH > 0) {
    while (effectiveFontSize > 8 && lines.length * effectiveFontSize * 1.2 > availH) {
      effectiveFontSize -= 1;
      ctx.font = `${effectiveFontSize}px ${fontFamily}`;
      // Re-wrap with smaller font
      lines = [];
      for (const rawLine of rawLines) {
        lines.push(...wrapLine(ctx, rawLine, availW));
      }
    }
  }

  const effectiveLineHeight = effectiveFontSize * 1.2;
  const totalHeight = lines.length * effectiveLineHeight;

  // Compute starting X per textAlign
  let anchorX: number;
  if (textAlign === 'left') {
    anchorX = bounds.x + paddingX;
    ctx.textAlign = 'left';
  } else if (textAlign === 'right') {
    anchorX = bounds.x + bounds.width - paddingX;
    ctx.textAlign = 'right';
  } else {
    anchorX = bounds.x + bounds.width / 2;
    ctx.textAlign = 'center';
  }

  // Compute starting Y per verticalAlign
  let startY: number;
  if (verticalAlign === 'top') {
    startY = bounds.y + paddingY + effectiveLineHeight / 2;
    ctx.textBaseline = 'middle';
  } else if (verticalAlign === 'bottom') {
    startY = bounds.y + bounds.height - paddingY - totalHeight + effectiveLineHeight / 2;
    ctx.textBaseline = 'middle';
  } else {
    // middle
    startY = bounds.y + bounds.height / 2 - totalHeight / 2 + effectiveLineHeight / 2;
    ctx.textBaseline = 'middle';
  }

  ctx.fillStyle = shape.textColor || getThemeAdjustedStroke(shape.stroke, theme);

  ctx.save();
  ctx.beginPath();
  ctx.rect(bounds.x + paddingX - 2, bounds.y + paddingY - 2, availW + 4, availH + 4);
  ctx.clip();

  lines.forEach(line => {
    ctx.fillText(line, anchorX, startY);
    startY += effectiveLineHeight;
  });

  ctx.restore();
}

/**
 * Renders a text label for a shape.
 * For connectors: always centered at path midpoint.
 * For bounded shapes: respects textAlign, textVerticalAlign, textPaddingX/Y, textOverflow.
 */
export function renderShapeText(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  plugin: any,
  allShapes: Shape[],
  isEditingText: boolean,
  theme: 'light' | 'dark'
) {
  if (shape.type === 'text' || !shape.text || isEditingText) return;

  if (plugin.isConnector) {
    renderConnectorText(ctx, shape, plugin, allShapes, theme);
  } else {
    renderBoundedShapeText(ctx, shape, plugin, theme);
  }
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // If single word is too long, push it anyway
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}
