/**
 * Basic shape plugins: rect, ellipse, diamond
 */

import { dslRegistry } from '../registry';
import { extractPropertiesWithDefaults } from '../converter';
import type { DSLShape, ParseContext, ValidationResult } from '../types';
import { PluginRegistry } from '../../plugins/PluginRegistry';

/**
 * Parse position from DSL line
 */
function parsePosition(line: string): { x: number; y: number } | undefined {
  const match = line.match(/at\((-?\d+),\s*(-?\d+)\)/);
  if (!match) return undefined;
  return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) };
}

/**
 * Parse properties from DSL line
 */
function parseProperties(line: string): Record<string, any> {
  const properties: Record<string, any> = {};
  const propPattern = /(\w+):(\S+)/g;
  let match;

  while ((match = propPattern.exec(line)) !== null) {
    const [, key, value] = match;
    // Skip position parsing (handled separately)
    if (key === 'at') continue;
    properties[key] = value;
  }

  return properties;
}

/**
 * Parse text content from DSL line
 */
function parseText(line: string): string | undefined {
  const match = line.match(/"([^"]+)"/);
  return match ? match[1] : undefined;
}

/**
 * Parse shape ID from DSL line
 */
function parseShapeId(line: string, type: string): string | null {
  const pattern = new RegExp(`${type}:(\\w+)`);
  const match = line.match(pattern);
  return match ? match[1] : null;
}

/**
 * Create base shape parser
 */
function createBaseParser(type: string, tahtaType: string): (line: string, ctx: ParseContext) => DSLShape | null {
  return (line: string, ctx: ParseContext): DSLShape | null => {
    const id = parseShapeId(line, type);
    if (!id) return null;

    const text = parseText(line);
    const position = parsePosition(line);
    const properties = parseProperties(line);

    return {
      id,
      type,
      text,
      position,
      properties
    };
  };
}

/**
 * Create base validator
 */
function createBaseValidator(): (dsl: DSLShape) => ValidationResult {
  return (dsl: DSLShape): ValidationResult => {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!dsl.id) {
      errors.push({ line: 0, message: 'Shape ID is required', severity: 'error' });
    }

    return { valid: errors.length === 0, errors, warnings };
  };
}

/**
 * Create base converter to tahta.js shape
 */
function createBaseConverter(tahtaType: string): (dsl: DSLShape) => any {
  return (dsl: DSLShape): any => {
    const { id, type, position, properties, data, text } = dsl;
    
    const props = extractPropertiesWithDefaults(properties);
    const defaultStyle = PluginRegistry.getDefaultStyle(tahtaType);
    
    return {
      ...defaultStyle,
      id: id, // Will be regenerated in converter
      type: tahtaType,
      x: position?.x || 0,
      y: position?.y || 0,
      width: props.width || getDefaultWidth(tahtaType),
      height: props.height || getDefaultHeight(tahtaType),
      text: text || '',
      strokeStyle: props.strokeStyle || (defaultStyle.strokeStyle as any),
      strokeWidth: props.strokeWidth || (defaultStyle.strokeWidth as any),
      roughness: props.roughness !== undefined ? props.roughness : (defaultStyle.roughness as any),
      ...props.otherProps,
      ...data
    };
  };
}

/**
 * Create base exporter from tahta.js shape to DSL
 */
function createBaseExporter(dslType: string): (shape: any) => string | null {
  return (shape: any): string | null => {
    const parts: string[] = [];
    
    // Type and ID (use original ID or generate simple one)
    const id = shape.id?.slice(0, 8) || 'shape';
    parts.push(`${dslType}:${id}`);
    
    // Text
    if (shape.text) {
      parts.push(`"${shape.text}"`);
    }
    
    // Position
    if (shape.x !== undefined && shape.y !== undefined) {
      parts.push(`at(${Math.round(shape.x)},${Math.round(shape.y)})`);
    }
    
    // Properties
    for (const [key, value] of Object.entries(shape)) {
      if (['id', 'type', 'x', 'y', 'width', 'height', 'text', 'points'].includes(key)) continue;
      if (value === undefined || value === null) continue;
      parts.push(`${key}:${value}`);
    }
    
    return parts.join(' ') || null;
  };
}

function getDefaultWidth(tahtaType: string): number {
  switch (tahtaType) {
    case 'diamond': return 120;
    case 'ellipse': return 140;
    default: return 160;
  }
}

function getDefaultHeight(tahtaType: string): number {
  switch (tahtaType) {
    case 'diamond': return 80;
    case 'ellipse': return 60;
    default: return 52;
  }
}

/**
 * Register basic shape plugins
 */
export function registerBasicPlugins(): void {
  // Rectangle plugin
  dslRegistry.register({
    type: 'rect',
    tahtaType: 'rectangle',
    parser: createBaseParser('rect', 'rectangle'),
    validator: createBaseValidator(),
    converter: createBaseConverter('rectangle'),
    exporter: createBaseExporter('rect')
  });

  // Ellipse plugin
  dslRegistry.register({
    type: 'ellipse',
    tahtaType: 'ellipse',
    parser: createBaseParser('ellipse', 'ellipse'),
    validator: createBaseValidator(),
    converter: createBaseConverter('ellipse'),
    exporter: createBaseExporter('ellipse')
  });

  // Diamond plugin
  dslRegistry.register({
    type: 'diamond',
    tahtaType: 'diamond',
    parser: createBaseParser('diamond', 'diamond'),
    validator: createBaseValidator(),
    converter: createBaseConverter('diamond'),
    exporter: createBaseExporter('diamond')
  });
}
