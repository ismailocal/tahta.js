import type { Shape } from '../core/types';
import { getShapeBounds } from '../geometry/Geometry';

const EXPORT_PADDING = 24;
const MAX_RASTER_EDGE = 8192;

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getBoundingBox(shapes: readonly Shape[]) {
  if (!shapes.length) return { x: 0, y: 0, width: 800, height: 600 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  shapes.forEach((shape) => {
    const bounds = getShapeBounds(shape);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });
  return {
    x: minX - EXPORT_PADDING,
    y: minY - EXPORT_PADDING,
    width: Math.max(1, maxX - minX + EXPORT_PADDING * 2),
    height: Math.max(1, maxY - minY + EXPORT_PADDING * 2),
  };
}

function shapeMarkup(shape: Shape, offsetX: number, offsetY: number): string {
  const x = number(shape.x) - offsetX;
  const y = number(shape.y) - offsetY;
  const width = number(shape.width);
  const height = number(shape.height);
  const left = width < 0 ? x + width : x;
  const top = height < 0 ? y + height : y;
  const w = Math.abs(width);
  const h = Math.abs(height);
  const stroke = escapeXml(shape.stroke || '#64748b');
  const fill = escapeXml(shape.fill && shape.fill !== 'transparent' ? shape.fill : 'none');
  const strokeWidth = Math.max(0, number(shape.strokeWidth, 2));
  const opacity = Math.min(1, Math.max(0, number(shape.opacity, 1)));
  const dash = shape.strokeStyle === 'dashed' ? ' stroke-dasharray="10 8"' : shape.strokeStyle === 'dotted' ? ' stroke-dasharray="2 7"' : '';
  const common = `stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}" opacity="${opacity}"${dash}`;

  let body = '';
  if (shape.type === 'ellipse') {
    body = `<ellipse cx="${left + w / 2}" cy="${top + h / 2}" rx="${w / 2}" ry="${h / 2}" ${common}/>`;
  } else if (shape.type === 'diamond') {
    body = `<polygon points="${left + w / 2},${top} ${left + w},${top + h / 2} ${left + w / 2},${top + h} ${left},${top + h / 2}" ${common}/>`;
  } else if (shape.type === 'triangle') {
    body = `<polygon points="${left + w / 2},${top} ${left + w},${top + h} ${left},${top + h}" ${common}/>`;
  } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
    const points = shape.points || [];
    if (points.length > 0) {
      const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x + point.x} ${y + point.y}`).join(' ');
      body = `<path d="${path}" stroke="${stroke}" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${dash}/>`;
    }
  } else if (shape.type === 'image' && typeof shape.imageSrc === 'string') {
    const safeImageSource = /^(?:data:image\/(?:png|jpeg|webp|gif);base64,|blob:)/i.test(shape.imageSrc)
      ? shape.imageSrc
      : '';
    body = safeImageSource
      ? `<image x="${left}" y="${top}" width="${w}" height="${h}" href="${escapeXml(safeImageSource)}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}"/>`
      : `<rect x="${left}" y="${top}" width="${w}" height="${h}" fill="none" stroke="#ef4444" stroke-dasharray="4 4"/>`;
  } else if (shape.type === 'text') {
    body = '';
  } else {
    const radius = shape.type === 'sticky-note' ? 4 : number(shape.cornerRadius, 8);
    body = `<rect x="${left}" y="${top}" width="${w}" height="${h}" rx="${radius}" ${common}/>`;
  }

  if (typeof shape.text === 'string' && shape.text.length > 0) {
    const fontSize = Math.max(8, number(shape.fontSize, 18));
    const textX = shape.textAlign === 'center' ? left + w / 2 : shape.textAlign === 'right' ? left + w - 12 : left + 12;
    const anchor = shape.textAlign === 'center' ? 'middle' : shape.textAlign === 'right' ? 'end' : 'start';
    const textY = shape.type === 'text' ? top + fontSize : top + Math.max(fontSize + 10, h / 2);
    const lines = shape.text.split('\n').slice(0, 100);
    const tspans = lines.map((line, index) => `<tspan x="${textX}" dy="${index === 0 ? 0 : fontSize * 1.25}">${escapeXml(line)}</tspan>`).join('');
    body += `<text x="${textX}" y="${textY}" text-anchor="${anchor}" fill="${escapeXml(shape.textColor || shape.stroke || '#0f172a')}" font-family="${escapeXml(shape.fontFamily || 'Inter, sans-serif')}" font-size="${fontSize}" opacity="${opacity}">${tspans}</text>`;
  }
  return body;
}

export function exportToSvg(shapes: readonly Shape[], background = '#f8fafc'): string {
  const box = getBoundingBox(shapes);
  const content = shapes.map((shape) => shapeMarkup(shape, box.x, box.y)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.width} ${box.height}" width="${box.width}" height="${box.height}"><rect width="100%" height="100%" fill="${escapeXml(background)}"/>${content}</svg>`;
}

export async function exportToPng(shapes: readonly Shape[], background = '#f8fafc'): Promise<Blob> {
  const svg = exportToSvg(shapes, background);
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error('PNG oluşturulurken SVG yüklenemedi.'));
      candidate.src = source;
    });
    const scale = Math.min(2, MAX_RASTER_EDGE / Math.max(image.naturalWidth, image.naturalHeight, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PNG oluşturmak için çizim alanı açılamadı.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG dosyası oluşturulamadı.')), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}
