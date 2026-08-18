import { describe, expect, it, vi } from 'vitest';
import { createBuiltinShapeRegistry } from '../core/builtinRegistry';
import type { CanvasState, Shape } from '../core/types';
import { attachBuiltinShapeRuntimes } from '../plugins';
import {
  getCanvasContentLeftInset,
  getResizeMeasurement,
  renderFrameDropTarget,
  renderLaserTrail,
  renderWelcome,
} from './OverlayRenderer';

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

  it('reports live bounds while a box shape is being created', () => {
    const registry = createBuiltinShapeRegistry();
    attachBuiltinShapeRuntimes(registry);
    const rectangle: Shape = { id: 'rect', type: 'rectangle', x: 10, y: 20, width: 120.4, height: 64.6 };
    const drawingState = {
      ...state(rectangle, null),
      drawingShapeId: rectangle.id,
    };

    expect(getResizeMeasurement(drawingState, registry)).toEqual({
      x: 70.2,
      y: 84.6,
      width: 120.4,
      height: 64.6,
      label: '120 × 65',
    });
  });

  it('does not show a box measurement for point-based drawing tools', () => {
    const registry = createBuiltinShapeRegistry();
    attachBuiltinShapeRuntimes(registry);
    const arrow: Shape = {
      id: 'arrow',
      type: 'arrow',
      x: 10,
      y: 20,
      points: [{ x: 0, y: 0 }, { x: 100, y: 40 }],
    };
    const drawingState = {
      ...state(arrow, null),
      drawingShapeId: arrow.id,
    };

    expect(getResizeMeasurement(drawingState, registry)).toBeNull();
  });
});

describe('frame drop target overlay', () => {
  it('renders a zoom-stable accent border, tint, and shadow around the target frame', () => {
    const registry = createBuiltinShapeRegistry();
    attachBuiltinShapeRuntimes(registry);
    const frame: Shape = { id: 'frame', type: 'frame', x: 100, y: 80, width: 300, height: 200 };
    const frameState = {
      ...state(frame, null),
      frameDropTargetId: frame.id,
      viewport: { x: 0, y: 0, zoom: 2 },
    };
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      lineWidth: 0,
      fillStyle: '',
      strokeStyle: '',
      shadowColor: '',
      shadowBlur: 0,
    } as unknown as CanvasRenderingContext2D;

    renderFrameDropTarget(context, frameState, registry);

    expect(context.fillRect).toHaveBeenCalledWith(98.5, 78.5, 303, 203);
    expect(context.strokeRect).toHaveBeenCalledWith(98.5, 78.5, 303, 203);
    expect(context.lineWidth).toBe(1);
    expect(context.strokeStyle).toBe('#6366f1');
    expect(context.shadowColor).toBe('rgba(99, 102, 241, 0.45)');
    expect(context.shadowBlur).toBe(7);
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

describe('welcome overlay', () => {
  it('fits the empty-state copy within a narrow mobile canvas', () => {
    const renderedFonts: string[] = [];
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(function (this: CanvasRenderingContext2D) { renderedFonts.push(this.font); }),
      measureText: vi.fn(function (this: CanvasRenderingContext2D, text: string) {
        const size = Number.parseFloat(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '16');
        return { width: text.length * size * 0.58 } as TextMetrics;
      }),
      font: '',
      fillStyle: '',
      textAlign: 'start',
    } as unknown as CanvasRenderingContext2D;
    renderWelcome(context, { width: 390, height: 844, leftInset: 0 });

    expect(renderedFonts).toHaveLength(2);
    expect(Number.parseFloat(renderedFonts[0].match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0')).toBeLessThan(42);
    expect(context.fillText).toHaveBeenNthCalledWith(1, 'Welcome to your whiteboard', 195, 412);
  });

  it('centers the empty-state copy in the canvas area not covered by host UI', () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 200 }) as TextMetrics),
      font: '',
      fillStyle: '',
      textAlign: 'start',
    } as unknown as CanvasRenderingContext2D;
    renderWelcome(context, { width: 800, height: 600, leftInset: 96 });

    // 72px sidebar + 24px visual gap leaves a 704px content area.
    expect(context.fillText).toHaveBeenNthCalledWith(1, 'Welcome to your whiteboard', 448, 290);
    expect(context.fillText).toHaveBeenNthCalledWith(2, 'Choose a tool and start drawing.', 448, 340);
  });

  it('derives the content inset from the host UI offset', () => {
    const canvas = {
      ownerDocument: {
        defaultView: {
          getComputedStyle: () => ({
            getPropertyValue: (property: string) => property === '--ui-left-offset' ? '72px' : '',
          }),
        },
      },
    } as unknown as HTMLCanvasElement;

    expect(getCanvasContentLeftInset(canvas, 800)).toBe(96);
  });
});
