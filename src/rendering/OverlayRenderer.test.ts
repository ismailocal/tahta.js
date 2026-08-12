import { describe, expect, it } from 'vitest';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import type { CanvasState, Shape } from '../core/types';
import { attachBuiltinShapeRuntimes } from '../plugins';
import { getResizeMeasurement } from './OverlayRenderer';

function state(shape: Shape, resizingShapeId: string | null): CanvasState {
  return {
    shapes: [shape],
    selectedIds: [shape.id],
    activeTool: 'select',
    viewport: { x: 0, y: 0, zoom: 1 },
    hoveredShapeId: null,
    drawingShapeId: null,
    isDraggingSelection: resizingShapeId !== null,
    resizingShapeId,
    laserTrail: [],
    isPanning: false,
    isSpacePanning: false,
    version: 0,
  };
}

describe('resize measurement overlay', () => {
  it('reports the live shape bounds only during handle resize', () => {
    const registry = createBuiltinShapeRegistry();
    attachBuiltinShapeRuntimes(registry);
    const rectangle: Shape = { id: 'rect', type: 'rectangle', x: 10, y: 20, width: 101.4, height: 79.6 };

    expect(getResizeMeasurement(state(rectangle, null), registry)).toBeNull();
    expect(getResizeMeasurement(state(rectangle, 'rect'), registry)).toEqual({
      x: 60.7,
      y: 99.6,
      width: 101.4,
      height: 79.6,
      label: '101 × 80',
    });
  });
});
