/**
 * Other shape plugins: text, image, freehand
 */

import { dslRegistry } from '../registry';
import { extractPropertiesWithDefaults } from '../converter';
import type { DSLShape, ParseContext, ValidationResult } from '../types';

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
 * Register other shape plugins
 */
export function registerOtherPlugins(): void {
  // Text plugin
  dslRegistry.register({
    type: 'text',
    tahtaType: 'text',
    parser: (line: string, ctx: ParseContext): DSLShape | null => {
      const id = parseShapeId(line, 'text');
      if (!id) return null;

      const text = parseText(line);
      const position = parsePosition(line);
      const properties = parseProperties(line);

      return {
        id,
        type: 'text',
        text: text || '',
        position,
        properties
      };
    },
    validator: (dsl: DSLShape): ValidationResult => {
      const errors: any[] = [];
      const warnings: any[] = [];

      if (!dsl.id) {
        errors.push({ line: 0, message: 'Shape ID is required', severity: 'error' });
      }

      if (!dsl.text) {
        warnings.push({ line: 0, message: 'Text shape has no content', severity: 'warning' });
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    converter: (dsl: DSLShape): any => {
      const { id, position, properties, text } = dsl;

      const props = extractPropertiesWithDefaults(properties);

      return {
        id,
        type: 'text',
        x: position?.x || 0,
        y: position?.y || 0,
        text: text || '',
        fontSize: 24,
        width: props.width,
        height: props.height,
        strokeStyle: props.strokeStyle,
        strokeWidth: props.strokeWidth,
        roughness: props.roughness,
        ...props.otherProps
      };
    },
    exporter: (shape: any): string | null => {
      const parts: string[] = [];
      const id = shape.id?.slice(0, 8) || 'text';
      
      parts.push(`text:${id}`);
      
      if (shape.text) {
        parts.push(`"${shape.text}"`);
      }
      
      if (shape.x !== undefined && shape.y !== undefined) {
        parts.push(`at(${Math.round(shape.x)},${Math.round(shape.y)})`);
      }
      
      for (const [key, value] of Object.entries(shape)) {
        if (['id', 'type', 'x', 'y', 'width', 'height', 'text', 'points'].includes(key)) continue;
        if (value === undefined || value === null) continue;
        parts.push(`${key}:${value}`);
      }
      
      return parts.join(' ') || null;
    }
  });

  // Image plugin
  dslRegistry.register({
    type: 'image',
    tahtaType: 'image',
    parser: (line: string, ctx: ParseContext): DSLShape | null => {
      const id = parseShapeId(line, 'image');
      if (!id) return null;

      const url = parseText(line);
      const position = parsePosition(line);
      const properties = parseProperties(line);

      return {
        id,
        type: 'image',
        text: url,
        position,
        properties
      };
    },
    validator: (dsl: DSLShape): ValidationResult => {
      const errors: any[] = [];
      const warnings: any[] = [];

      if (!dsl.id) {
        errors.push({ line: 0, message: 'Shape ID is required', severity: 'error' });
      }

      if (!dsl.text) {
        errors.push({ line: 0, message: 'Image shape requires a URL', severity: 'error' });
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    converter: (dsl: DSLShape): any => {
      const { id, position, properties, text } = dsl;

      // Extract width/height from properties and remove them to avoid override
      const { width, height, ...otherProps } = properties;

      return {
        id,
        type: 'image',
        x: position?.x || 0,
        y: position?.y || 0,
        width: width ? parseInt(width) : 200,
        height: height ? parseInt(height) : 150,
        source: text || '',
        ...otherProps
      };
    },
    exporter: (shape: any): string | null => {
      const parts: string[] = [];
      const id = shape.id?.slice(0, 8) || 'img';
      
      parts.push(`image:${id}`);
      
      if (shape.source) {
        parts.push(`"${shape.source}"`);
      }
      
      if (shape.x !== undefined && shape.y !== undefined) {
        parts.push(`at(${Math.round(shape.x)},${Math.round(shape.y)})`);
      }
      
      for (const [key, value] of Object.entries(shape)) {
        if (['id', 'type', 'x', 'y', 'width', 'height', 'source', 'text', 'points'].includes(key)) continue;
        if (value === undefined || value === null) continue;
        parts.push(`${key}:${value}`);
      }
      
      return parts.join(' ') || null;
    }
  });

  // Freehand plugin
  dslRegistry.register({
    type: 'freehand',
    tahtaType: 'freehand',
    parser: (line: string, ctx: ParseContext): DSLShape | null => {
      const id = parseShapeId(line, 'freehand');
      if (!id) return null;

      const text = parseText(line);
      const position = parsePosition(line);
      const properties = parseProperties(line);

      return {
        id,
        type: 'freehand',
        text,
        position,
        properties
      };
    },
    validator: (dsl: DSLShape): ValidationResult => {
      const errors: any[] = [];
      const warnings: any[] = [];

      if (!dsl.id) {
        errors.push({ line: 0, message: 'Shape ID is required', severity: 'error' });
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    converter: (dsl: DSLShape): any => {
      const { id, position, properties } = dsl;

      // Extract width/height from properties and remove them to avoid override
      const { width, height, ...otherProps } = properties;

      return {
        id,
        type: 'freehand',
        x: position?.x || 0,
        y: position?.y || 0,
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        points: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }],
        ...otherProps
      };
    },
    exporter: (shape: any): string | null => {
      const parts: string[] = [];
      const id = shape.id?.slice(0, 8) || 'draw';
      
      parts.push(`freehand:${id}`);
      
      if (shape.text) {
        parts.push(`"${shape.text}"`);
      }
      
      if (shape.x !== undefined && shape.y !== undefined) {
        parts.push(`at(${Math.round(shape.x)},${Math.round(shape.y)})`);
      }
      
      for (const [key, value] of Object.entries(shape)) {
        if (['id', 'type', 'x', 'y', 'width', 'height', 'text', 'points'].includes(key)) continue;
        if (value === undefined || value === null) continue;
        parts.push(`${key}:${value}`);
      }
      
      return parts.join(' ') || null;
    }
  });
}
