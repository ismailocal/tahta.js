import type { Shape } from '../core/types';
import { getShapeBounds } from '../geometry/Geometry';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import type { ShapeRegistry } from '../core/registry';
import { shapeToRecord } from '../core/projection';
import { attachBuiltinShapeRuntimes } from '../plugins/index';

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

function createExportRegistry(): ShapeRegistry {
  const registry = createBuiltinShapeRegistry();
  attachBuiltinShapeRuntimes(registry);
  return registry;
}

function getBoundingBox(shapes: readonly Shape[], registry: ShapeRegistry) {
  if (!shapes.length) return { x: 0, y: 0, width: 800, height: 600 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  shapes.forEach((shape) => {
    const bounds = getShapeBounds(shape, registry);
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

export function exportToSvg(shapes: readonly Shape[], background = '#f8fafc', registry = createExportRegistry()): string {
  const box = getBoundingBox(shapes, registry);
  const content = shapes.map((shape, position) => {
    const record = shapeToRecord(shape, String(position).padStart(12, '0'), registry);
    return registry.get(record.type).exportSvg({ record, theme: 'light', offsetX: box.x, offsetY: box.y, resolveAssetHref: () => '' });
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.width} ${box.height}" width="${box.width}" height="${box.height}"><rect width="100%" height="100%" fill="${escapeXml(background)}"/>${content}</svg>`;
}

export async function exportToPng(shapes: readonly Shape[], background = '#f8fafc', registry = createExportRegistry()): Promise<Blob> {
  const svg = exportToSvg(shapes, background, registry);
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
