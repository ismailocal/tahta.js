/**
 * Core type definitions for the DSL system
 */

export interface Position {
  x: number;
  y: number;
}

export interface DSLShape {
  id: string;
  type: string;
  text?: string;
  position?: Position;
  properties: Record<string, any>;
  data?: any;
}

export interface DSLConnector {
  from: string;
  to: string;
  type?: 'arrow' | 'line';
  fromPort?: string;
  toPort?: string;
  properties: Record<string, any>;
}

export interface DSLDocument {
  version: string;
  shapes: DSLShape[];
  connectors: DSLConnector[];
  layout?: LayoutConfig;
}

export interface LayoutConfig {
  algorithm?: 'simple' | 'dagre';
  spacing?: {
    horizontal: number;
    vertical: number;
  };
}

export interface ParseContext {
  shapes: Map<string, DSLShape>;
  connectors: DSLConnector[];
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  line: number;
  message: string;
  severity: 'error';
}

export interface ParseWarning {
  line: number;
  message: string;
  severity: 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseResult {
  success: boolean;
  document?: DSLDocument;
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface DSLShapePlugin {
  type: string;
  tahtaType: string;
  parser: (line: string, ctx: ParseContext) => DSLShape | null;
  validator: (dsl: DSLShape) => ValidationResult;
  converter: (dsl: DSLShape) => any; // Partial<Shape>
  exporter?: (shape: any) => string | null;
}
