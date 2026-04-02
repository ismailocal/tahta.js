import { getThemeAdjustedStroke } from '../core/Utils';
import type { Shape } from '../core/types';

/**
 * Renders a text label for a shape, centered at the plugin's suggested anchor.
 * Supports multi-line text and adds a background mask for connector shapes.
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
