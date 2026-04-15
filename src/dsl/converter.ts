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

  // Convert connectors with ID remapping
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
/**
 * Extract properties with default values for DSL converters
 */
export function extractPropertiesWithDefaults(properties: Record<string, any>): {
  width?: number;
  height?: number;
  strokeStyle: string;
  strokeWidth: number;
  roughness: number;
  otherProps: Record<string, any>;
} {
  const { width, height, strokeStyle, strokeWidth, roughness, ...otherProps } = properties;
  return {
    width: width ? parseInt(width) : undefined,
    height: height ? parseInt(height) : undefined,
    strokeStyle: strokeStyle || 'solid',
    strokeWidth: strokeWidth ? parseInt(strokeWidth) : 1,
    roughness: roughness ? parseInt(roughness) : 0,
    otherProps
  };
}

function convertConnector(conn: DSLConnector, idMap: Map<string, string>, _shapes: any[]): any {
  const fromId = idMap.get(conn.from);
  const toId = idMap.get(conn.to);

  if (!fromId || !toId) {
    console.warn(`Connector references missing shape IDs: from=${conn.from}, to=${conn.to}`);
    return null;
  }

  const connectorType = conn.type || 'arrow';
  const props = extractPropertiesWithDefaults(conn.properties);
  
  return {
    id: createId(),
    type: connectorType,
    x: 0,
    y: 0,
    startBinding: conn.fromPort ? { elementId: fromId, portId: conn.fromPort } : undefined,
    endBinding: conn.toPort ? { elementId: toId, portId: conn.toPort } : undefined,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    strokeStyle: props.strokeStyle,
    strokeWidth: props.strokeWidth,
    roughness: props.roughness,
    ...props.otherProps
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
