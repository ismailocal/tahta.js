/**
 * Connector plugins: arrow, line
 */

import { dslRegistry } from '../registry';
import { extractPropertiesWithDefaults } from '../converter';
import type { DSLShapePlugin, DSLShape, ParseContext, ValidationResult } from '../types';

/**
 * Register connector plugins
 * Note: Connectors are parsed in the main parser, not via plugins
 * This is for future extensibility if needed
 */
export function registerConnectorPlugins(): void {
  // Arrow connector (parsed in main parser, placeholder for future)
  dslRegistry.register({
    type: 'arrow',
    tahtaType: 'arrow',
    parser: () => null, // Connectors parsed in main parser
    validator: () => ({ valid: true, errors: [], warnings: [] }),
    converter: (dsl: DSLShape): any => {
      const { from, to, fromPort, toPort, properties } = dsl as any;
      const hasBinding = from || to;
      
      const props = extractPropertiesWithDefaults(properties);
      
      return {
        type: 'arrow',
        startBinding: from ? { elementId: from, portId: fromPort } : undefined,
        endBinding: to ? { elementId: to, portId: toPort } : undefined,
        points: hasBinding ? [{ x: 0, y: 0 }, { x: 100, y: 0 }] : [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        strokeStyle: props.strokeStyle,
        strokeWidth: props.strokeWidth,
        roughness: props.roughness,
        ...props.otherProps
      };
    }
  });

  // Line connector (parsed in main parser, placeholder for future)
  dslRegistry.register({
    type: 'line',
    tahtaType: 'line',
    parser: () => null, // Connectors parsed in main parser
    validator: () => ({ valid: true, errors: [], warnings: [] }),
    converter: (dsl: DSLShape): any => {
      const { from, to, fromPort, toPort, properties } = dsl as any;
      const hasBinding = from || to;
      
      const props = extractPropertiesWithDefaults(properties);
      
      return {
        type: 'line',
        startBinding: from ? { elementId: from, portId: fromPort } : undefined,
        endBinding: to ? { elementId: to, portId: toPort } : undefined,
        points: hasBinding ? [{ x: 0, y: 0 }, { x: 100, y: 0 }] : [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        strokeStyle: props.strokeStyle,
        strokeWidth: props.strokeWidth,
        roughness: props.roughness,
        ...props.otherProps
      };
    }
  });
}
