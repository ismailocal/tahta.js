import { describe, expect, it, vi } from 'vitest';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import type { CanvasState, Shape } from '../core/types';
import { attachBuiltinShapeRuntimes } from '../plugins';
import { getResizeMeasurement, renderLaserTrail } from './OverlayRenderer';

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

describe('laser overlay', () => {
  it('renders consecutive strokes independently without joining their endpoints', () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      lineCap: 'butt',
      lineJoin: 'miter',
      lineWidth: 1,
      shadowColor: '',
      shadowBlur: 0,
      globalAlpha: 1,
      strokeStyle: '',
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    const timestamp = 1_100;

    renderLaserTrail(context, [
      { x: 0, y: 0, timestamp: 1_000, strokeId: 0 },
      { x: 10, y: 0, timestamp: 1_010, strokeId: 0 },
      { x: 20, y: 0, timestamp: 1_020, strokeId: 1 },
      { x: 30, y: 0, timestamp: 1_030, strokeId: 1 },
    ], '#ef4444', 1, timestamp);

    expect(context.moveTo).toHaveBeenNthCalledWith(1, 0, 0);
    expect(context.lineTo).toHaveBeenNthCalledWith(1, 10, 0);
    expect(context.moveTo).toHaveBeenNthCalledWith(2, 20, 0);
    expect(context.lineTo).toHaveBeenNthCalledWith(2, 30, 0);
    expect(context.arc).toHaveBeenCalledTimes(2);
  });
});
