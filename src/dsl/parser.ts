/**
 * DSL parser - converts text DSL to intermediate format
 */

import type { DSLDocument, DSLShape, DSLConnector, ParseContext, ParseResult, ParseError, ParseWarning } from './types';
import { dslRegistry } from './registry';

/**
 * Main parser function - converts DSL text to DSLDocument
 */
export function parseDSL(dslText: string): ParseResult {
  const lines = dslText.split('\n');
  const ctx: ParseContext = {
    shapes: new Map(),
    connectors: [],
    errors: [],
    warnings: []
  };

  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Try to parse as connector (id1 -> id2)
    if (trimmed.includes('->')) {
      parseConnector(trimmed, lineNumber, ctx);
      continue;
    }

    // Try to parse as shape using plugins
    let parsed = false;
    for (const plugin of dslRegistry.getAllPlugins()) {
      const shape = plugin.parser(trimmed, ctx);
      if (shape) {
        // Check for duplicate IDs
        if (ctx.shapes.has(shape.id)) {
          ctx.errors.push({
            line: lineNumber,
            message: `Duplicate shape ID: "${shape.id}"`,
            severity: 'error'
          });
        } else {
          ctx.shapes.set(shape.id, shape);
        }
        parsed = true;
        break;
      }
    }

    if (!parsed) {
      ctx.errors.push({
        line: lineNumber,
        message: `Unable to parse line: "${trimmed}"`,
        severity: 'error'
      });
    }
  }

  // Validate connector references
  validateConnectorReferences(ctx);

  // Build result
  const success = ctx.errors.length === 0;
  const document: DSLDocument | undefined = success ? {
    version: '1.0',
    shapes: Array.from(ctx.shapes.values()),
    connectors: ctx.connectors
  } : undefined;

  return {
    success,
    document,
    errors: ctx.errors,
    warnings: ctx.warnings
  };
}

/**
 * Parse connector line (id1 -> id2)
 */
function parseConnector(line: string, lineNumber: number, ctx: ParseContext): void {
  const parts = line.split('->');
  if (parts.length !== 2) {
    ctx.errors.push({
      line: lineNumber,
      message: `Invalid connector syntax: "${line}"`,
      severity: 'error'
    });
    return;
  }

  const from = parts[0].trim();
  const toParts = parts[1].trim().split(/\s+/);
  const to = toParts[0];

  // Extract properties
  const properties: Record<string, any> = {};
  let type: 'arrow' | 'line' | undefined;
  let fromPort: string | undefined;
  let toPort: string | undefined;

  for (let i = 1; i < toParts.length; i++) {
    const part = toParts[i];
    if (part.startsWith('type:')) {
      type = part.split(':')[1] as 'arrow' | 'line';
    } else if (part.startsWith('from:') || part.startsWith('port:')) {
      const portValue = part.split(':')[1];
      // First port is fromPort
      if (!fromPort) fromPort = portValue;
      else toPort = portValue;
    } else if (part.startsWith('to:')) {
      toPort = part.split(':')[1];
    } else if (part.includes(':')) {
      const [key, value] = part.split(':');
      properties[key] = value;
    }
  }

  const connector: DSLConnector = {
    from,
    to,
    type,
    fromPort,
    toPort,
    properties
  };

  ctx.connectors.push(connector);
}

/**
 * Validate that connector references exist
 */
function validateConnectorReferences(ctx: ParseContext): void {
  for (const conn of ctx.connectors) {
    if (!ctx.shapes.has(conn.from)) {
      ctx.errors.push({
        line: 0,
        message: `Connector references unknown shape ID: "${conn.from}"`,
        severity: 'error'
      });
    }
    if (!ctx.shapes.has(conn.to)) {
      ctx.errors.push({
        line: 0,
        message: `Connector references unknown shape ID: "${conn.to}"`,
        severity: 'error'
      });
    }
  }
}
