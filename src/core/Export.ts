import type { Shape } from './types';
import { getShapeBounds } from './Geometry';

export function exportToJson(shapes: Shape[]): string {
  return JSON.stringify(shapes, null, 2);
}

export function importFromJson(jsonString: string): Shape[] | null {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data)) {
      // Basic validation
      return data.filter(s => s.id && s.type);
    }
  } catch (e) {
    console.error('Failed to parse board JSON', e);
  }
  return null;
}

function getBoundingBox(shapes: Shape[]) {
  if (!shapes.length) return { x: 0, y: 0, width: 800, height: 600 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  shapes.forEach(shape => {
    const b = getShapeBounds(shape);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  });
  return { x: minX - 20, y: minY - 20, width: maxX - minX + 40, height: maxY - minY + 40 };
}

export function exportToSvg(shapes: Shape[], background = '#131316'): string {
  const box = getBoundingBox(shapes);
  
  let content = '';
  shapes.forEach(shape => {
    const str = shape.stroke || '#fff';
    const fil = shape.fill && shape.fill !== 'transparent' ? shape.fill : 'none';
    const stw = shape.strokeWidth || 2;
    const op = shape.opacity ?? 1;
    const w = shape.width || 0;
    const h = shape.height || 0;
    
    if (shape.type === 'rectangle') {
      content += `<rect x="${shape.x - box.x}" y="${shape.y - box.y}" width="${w}" height="${h}" stroke="${str}" fill="${fil}" stroke-width="${stw}" opacity="${op}" />`;
    } else if (shape.type === 'ellipse') {
      content += `<ellipse cx="${shape.x - box.x + w/2}" cy="${shape.y - box.y + h/2}" rx="${w/2}" ry="${h/2}" stroke="${str}" fill="${fil}" stroke-width="${stw}" opacity="${op}" />`;
    } else if (shape.type === 'line' || shape.type === 'freehand') {
      const pts = shape.points || [];
      if (pts.length) {
        const d = `M ${shape.x + pts[0].x - box.x} ${shape.y + pts[0].y - box.y} ` + pts.slice(1).map(p => `L ${shape.x + p.x - box.x} ${shape.y + p.y - box.y}`).join(' ');
        content += `<path d="${d}" stroke="${str}" fill="none" stroke-width="${stw}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}" />`;
      }
    } else if (shape.type === 'text') {
      const fs = shape.fontSize || 20;
      content += `<text x="${shape.x - box.x}" y="${shape.y - box.y + fs}" fill="${str}" font-family="sans-serif" font-size="${fs}" opacity="${op}">${shape.text || ''}</text>`;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.width} ${box.height}" width="${box.width}" height="${box.height}">
    <rect width="100%" height="100%" fill="${background}" />
    ${content}
  </svg>`;
}

export function exportToPng(shapes: Shape[], background = '#131316'): Promise<string> {
  return new Promise((resolve) => {
    const svgStr = exportToSvg(shapes, background);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = url;
  });
}
