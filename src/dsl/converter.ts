/**
 * DSL Converter - converts between DSL, JSON, and tahta.js shapes
 */

import type { DSLDocument, DSLShape, DSLConnector } from './types';
import { parseDSL } from './parser';
import { dslRegistry } from './registry';
import { createId } from '../core/Utils';

/**
 * Convert DSL text to DSLDocument (JSON intermediate format)
 */
export function dslToJson(dslText: string): DSLDocument {
  const parseResult = parseDSL(dslText);
  
  if (!parseResult.success || !parseResult.document) {
    throw new DSLError(parseResult.errors, parseResult.warnings);
  }

  return parseResult.document;
}

/**
 * Convert DSLDocument to tahta.js Shape[]
 */
export function jsonToShapes(doc: DSLDocument): any[] {
  const idMap = new Map<string, string>();
  const shapes: any[] = [];

  // Convert shapes with fresh IDs
  for (const dslShape of doc.shapes) {
    const plugin = dslRegistry.getPlugin(dslShape.type);
    if (!plugin) {
      console.warn(`No plugin found for shape type: ${dslShape.type}`);
      continue;
    }

    const shape = plugin.converter(dslShape);
    const freshId = createId();
    
    // Update shape with fresh ID
    shape.id = freshId;
    
    // Store ID mapping for connector references
    idMap.set(dslShape.id, freshId);
    
    shapes.push(shape);
  }

  // Convert connectors with ID remapping and point calculation
  for (const conn of doc.connectors) {
    const connector = convertConnector(conn, idMap, shapes);
    if (connector) {
      shapes.push(connector);
    }
  }

  return shapes;
}

/**
 * Convert a single DSL connector to tahta.js connector with ID remapping
 */
function convertConnector(conn: DSLConnector, idMap: Map<string, string>, shapes: any[]): any {
  const fromId = idMap.get(conn.from);
  const toId = idMap.get(conn.to);

  if (!fromId || !toId) {
    console.warn(`Connector references missing shape IDs: from=${conn.from}, to=${conn.to}`);
    return null;
  }

  const fromShape = shapes.find(s => s.id === fromId);
  const toShape = shapes.find(s => s.id === toId);

  if (!fromShape || !toShape) {
    console.warn(`Connector shapes not found: from=${fromId}, to=${toId}`);
    return null;
  }

  // Calculate points based on shape positions and ports
  const getPortPosition = (shape: any, portId: string | undefined) => {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const cx = shape.x + w / 2;
    const cy = shape.y + h / 2;

    // Handle database column ports (col-0-right, col-0-left, etc.)
    if (portId?.startsWith('col-')) {
      const parts = portId.split('-');
      const colIndex = parseInt(parts[1]);
      const side = parts[2];
      const columns = shape.data?.columns || [];
      const HEADER_HEIGHT = 36;
      const ROW_HEIGHT = 28;
      
      if (colIndex < columns.length) {
        const rowY = shape.y + HEADER_HEIGHT + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        if (side === 'left') return { x: shape.x, y: rowY };
        if (side === 'right') return { x: shape.x + w, y: rowY };
      }
      return { x: cx, y: cy };
    }

    // Handle standard ports
    switch (portId) {
      case 'top': return { x: cx, y: shape.y };
      case 'bottom': return { x: cx, y: shape.y + h };
      case 'left': return { x: shape.x, y: cy };
      case 'right': return { x: shape.x + w, y: cy };
      default: return { x: cx, y: cy };
    }
  };

  const fromPortPos = getPortPosition(fromShape, conn.fromPort);
  const toPortPos = getPortPosition(toShape, conn.toPort);

  const connectorType = conn.type || 'arrow';
  const { strokeStyle, strokeWidth, roughness, ...otherProps } = conn.properties;
  return {
    id: createId(),
    type: connectorType,
    x: 0,
    y: 0,
    startBinding: conn.fromPort ? { elementId: fromId, portId: conn.fromPort } : undefined,
    endBinding: conn.toPort ? { elementId: toId, portId: conn.toPort } : undefined,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    strokeStyle: strokeStyle || 'solid',
    strokeWidth: strokeWidth ? parseInt(strokeWidth) : 1,
    roughness: roughness ? parseInt(roughness) : 0,
    ...otherProps
  };
}

/**
 * DSL Error class for structured error reporting
 */
export class DSLError extends Error {
  errors: any[];
  warnings: any[];

  constructor(errors: any[], warnings: any[] = []) {
    const message = `DSL parsing failed with ${errors.length} error(s)`;
    super(message);
    this.name = 'DSLError';
    this.errors = errors;
    this.warnings = warnings;
  }

  getFormattedMessage(): string {
    let msg = this.message + '\n';
    
    if (this.errors.length > 0) {
      msg += '\nErrors:\n';
      for (const err of this.errors) {
        msg += `  Line ${err.line}: ${err.message}\n`;
      }
    }
    
    if (this.warnings.length > 0) {
      msg += '\nWarnings:\n';
      for (const warn of this.warnings) {
        msg += `  Line ${warn.line}: ${warn.message}\n`;
      }
    }
    
    return msg;
  }
}
