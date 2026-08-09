/**
 * DSL Exporter - converts tahta.js shapes to DSL text
 */

import type { DSLShape, DSLConnector } from './types';
import { dslRegistry } from './registry';

/**
 * Convert tahta.js shapes to DSL text
 */
export function shapesToDSL(shapes: any[]): string {
  const lines: string[] = [];
  const idMap = new Map<string, string>();

  lines.push('# DSL Diagram Export');
  lines.push('');

  // Convert shapes using plugin exporters
  for (const shape of shapes) {
    const plugin = dslRegistry.getPlugin(shape.type);
    if (!plugin) {
      console.warn(`No plugin found for shape type: ${shape.type}`);
      continue;
    }

    if (plugin.exporter) {
      const dslLine = plugin.exporter(shape);
      if (dslLine) {
        lines.push(dslLine);
        // Extract ID from the DSL line for connector mapping
        const idMatch = dslLine.match(/(\w+):/);
        if (idMatch) {
          idMap.set(shape.id, idMatch[1]);
        }
      }
    }
  }

  lines.push('');

  // Convert connectors
  for (const shape of shapes) {
    if (shape.startBinding || shape.endBinding) {
      const dslLine = exportConnector(shape, shapes, idMap);
      if (dslLine) {
        lines.push(dslLine);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Export a connector shape to DSL line
 */
function exportConnector(shape: any, allShapes: any[], idMap: Map<string, string>): string | null {
  const fromId = shape.startBinding?.elementId;
  const toId = shape.endBinding?.elementId;

  if (!fromId || !toId) return null;

  const fromDSLId = idMap.get(fromId);
  const toDSLId = idMap.get(toId);

  if (!fromDSLId || !toDSLId) return null;

  const parts: string[] = [];
  
  // From and to
  parts.push(`${fromDSLId}->${toDSLId}`);
  
  // Type (if explicit)
  if (shape.type === 'line') {
    parts.push('type:line');
  }
  
  // Ports
  if (shape.startBinding?.portId) {
    parts.push(`from:${shape.startBinding.portId}`);
  }
  if (shape.endBinding?.portId) {
    parts.push(`to:${shape.endBinding.portId}`);
  }
  
  // Properties
  for (const [key, value] of Object.entries(shape)) {
    if (['startBinding', 'endBinding', 'type', 'id', 'points', 'x', 'y', 'width', 'height'].includes(key)) continue;
    if (value === undefined || value === null) continue;
    parts.push(`${key}:${value}`);
  }
  
  return parts.join(' ') || null;
}
