/**
 * Database shape plugins: dbtable, dbview, dbenum
 */

import { dslRegistry } from '../registry';
import { extractPropertiesWithDefaults } from '../converter';
import type { DSLShape, ParseContext, ValidationResult } from '../types';

/**
 * Parse column definitions from DSL line
 */
function parseColumns(line: string): Array<{ name: string; type: string; pk?: boolean; fk?: boolean }> {
  const columns: Array<{ name: string; type: string; pk?: boolean; fk?: boolean }> = [];
  const colPattern = /col:(\w+):(\w+)(?::(pk|fk))?/g;
  let match;

  while ((match = colPattern.exec(line)) !== null) {
    const [, name, type, flag] = match;
    columns.push({
      name,
      type,
      pk: flag === 'pk',
      fk: flag === 'fk'
    });
  }

  return columns;
}

/**
 * Parse enum values from DSL line
 */
function parseEnumValues(line: string): string[] {
  const values: string[] = [];
  const valPattern = /val:(\w+)/g;
  let match;

  while ((match = valPattern.exec(line)) !== null) {
    values.push(match[1]);
  }

  return values;
}

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
    // Skip special parsers
    if (key === 'at' || key === 'col' || key === 'val') continue;
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
 * Register database shape plugins
 */
export function registerDatabasePlugins(): void {
  // DB Table plugin
  dslRegistry.register({
    type: 'dbtable',
    tahtaType: 'db-table',
    parser: (line: string, ctx: ParseContext): DSLShape | null => {
      const id = parseShapeId(line, 'dbtable');
      if (!id) return null;

      const text = parseText(line);
      const position = parsePosition(line);
      const properties = parseProperties(line);
      const columns = parseColumns(line);

      return {
        id,
        type: 'dbtable',
        text,
        position,
        properties,
        data: { tableName: text, columns }
      };
    },
    validator: (dsl: DSLShape): ValidationResult => {
      const errors: any[] = [];
      const warnings: any[] = [];

      if (!dsl.id) {
        errors.push({ line: 0, message: 'Shape ID is required', severity: 'error' });
      }

      if (!dsl.data?.columns || dsl.data.columns.length === 0) {
        warnings.push({ line: 0, message: 'DB table has no columns', severity: 'warning' });
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    converter: (dsl: DSLShape): any => {
      const { id, position, properties, data } = dsl;
      const height = 36 + Math.max(1, data?.columns?.length || 0) * 28;

      const props = extractPropertiesWithDefaults(properties);

      return {
        id: id,
        type: 'db-table',
        x: position?.x || 0,
        y: position?.y || 0,
        width: props.width || 220,
        height: props.height || height,
        strokeStyle: props.strokeStyle,
        strokeWidth: props.strokeWidth,
        roughness: props.roughness,
        data: { ...data, ...props.otherProps }
      };
    },
    exporter: (shape: any): string | null => {
      const parts: string[] = [];
      const id = shape.id?.slice(0, 8) || 'table';
      
      parts.push(`dbtable:${id}`);
      
      if (shape.data?.tableName) {
        parts.push(`"${shape.data.tableName}"`);
      }
      
      if (shape.x !== undefined && shape.y !== undefined) {
        parts.push(`at(${Math.round(shape.x)},${Math.round(shape.y)})`);
      }
      
      if (shape.data?.columns) {
        for (const col of shape.data.columns) {
          let colStr = `col:${col.name}:${col.type}`;
          if (col.pk) colStr += ':pk';
          if (col.fk) colStr += ':fk';
          parts.push(colStr);
        }
      }
      
      for (const [key, value] of Object.entries(shape)) {
        if (['id', 'type', 'x', 'y', 'width', 'height', 'data', 'text'].includes(key)) continue;
        if (value === undefined || value === null) continue;
        parts.push(`${key}:${value}`);
      }
      
      return parts.join(' ') || null;
    }
  });

  // DB View plugin
  dslRegistry.register({
    type: 'dbview',
    tahtaType: 'db-view',
    parser: (line: string, ctx: ParseContext): DSLShape | null => {
      const id = parseShapeId(line, 'dbview');
      if (!id) return null;

      const text = parseText(line);
      const position = parsePosition(line);
      const properties = parseProperties(line);
      const columns = parseColumns(line);

      return {
        id,
        type: 'dbview',
        text,
        position,
        properties,
        data: { viewName: text, columns }
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
      const { id, position, properties, data } = dsl;

      const props = extractPropertiesWithDefaults(properties);

      return {
        id,
        type: 'db-view',
        x: position?.x || 0,
        y: position?.y || 0,
        width: props.width || 220,
        height: props.height || 60,
        strokeStyle: props.strokeStyle,
        strokeWidth: props.strokeWidth,
        roughness: props.roughness,
        data: data || { viewName: '', columns: [] },
        ...props.otherProps
      };
    },
    exporter: (shape: any): string | null => {
      const parts: string[] = [];
      const id = shape.id?.slice(0, 8) || 'view';
      
      parts.push(`dbview:${id}`);
      
      if (shape.data?.viewName) {
        parts.push(`"${shape.data.viewName}"`);
      }
      
      if (shape.x !== undefined && shape.y !== undefined) {
        parts.push(`at(${Math.round(shape.x)},${Math.round(shape.y)})`);
      }
      
      if (shape.data?.columns) {
        for (const col of shape.data.columns) {
          parts.push(`col:${col.name}:${col.type}`);
        }
      }
      
      for (const [key, value] of Object.entries(shape)) {
        if (['id', 'type', 'x', 'y', 'width', 'height', 'data', 'text'].includes(key)) continue;
        if (value === undefined || value === null) continue;
        parts.push(`${key}:${value}`);
      }
      
      return parts.join(' ') || null;
    }
  });

  // DB Enum plugin
  dslRegistry.register({
    type: 'dbenum',
    tahtaType: 'db-enum',
    parser: (line: string, ctx: ParseContext): DSLShape | null => {
      const id = parseShapeId(line, 'dbenum');
      if (!id) return null;

      const text = parseText(line);
      const position = parsePosition(line);
      const properties = parseProperties(line);
      const values = parseEnumValues(line);

      return {
        id,
        type: 'dbenum',
        text,
        position,
        properties,
        data: { enumName: text, values }
      };
    },
    validator: (dsl: DSLShape): ValidationResult => {
      const errors: any[] = [];
      const warnings: any[] = [];

      if (!dsl.id) {
        errors.push({ line: 0, message: 'Shape ID is required', severity: 'error' });
      }

      if (!dsl.data?.values || dsl.data.values.length === 0) {
        warnings.push({ line: 0, message: 'DB enum has no values', severity: 'warning' });
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    converter: (dsl: DSLShape): any => {
      const { id, position, properties, data } = dsl;

      const props = extractPropertiesWithDefaults(properties);

      return {
        id,
        type: 'db-enum',
        x: position?.x || 0,
        y: position?.y || 0,
        width: props.width || 160,
        height: props.height || 52,
        strokeStyle: props.strokeStyle,
        strokeWidth: props.strokeWidth,
        roughness: props.roughness,
        data: data || { enumName: '', values: [] },
        ...props.otherProps
      };
    },
    exporter: (shape: any): string | null => {
      const parts: string[] = [];
      const id = shape.id?.slice(0, 8) || 'enum';
      
      parts.push(`dbenum:${id}`);
      
      if (shape.data?.enumName) {
        parts.push(`"${shape.data.enumName}"`);
      }
      
      if (shape.x !== undefined && shape.y !== undefined) {
        parts.push(`at(${Math.round(shape.x)},${Math.round(shape.y)})`);
      }
      
      if (shape.data?.values) {
        for (const val of shape.data.values) {
          parts.push(`val:${val}`);
        }
      }
      
      for (const [key, value] of Object.entries(shape)) {
        if (['id', 'type', 'x', 'y', 'width', 'height', 'data', 'text'].includes(key)) continue;
        if (value === undefined || value === null) continue;
        parts.push(`${key}:${value}`);
      }
      
      return parts.join(' ') || null;
    }
  });
}
