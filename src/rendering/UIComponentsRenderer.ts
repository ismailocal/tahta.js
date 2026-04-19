import { getThemeAdjustedStroke } from '../core/Utils';
import type { Shape, ConnectionPoint } from '../core/types';
import { UI_CONSTANTS } from '../core/constants';

const FRAME_COLOR = '#60a5fa';
const HANDLE_STROKE = '#3b82f6';

/**
 * Draws a universal selection frame (bounding rect + circular handles) for any shape.
 * Called centrally from ShapeRenderer — no plugin needs to duplicate this.
 */
export function renderSelectionFrame(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  theme: 'light' | 'dark',
  showHandles: boolean
) {
  const { x, y, width: w, height: h } = bounds;
  const fx = x - UI_CONSTANTS.FRAME_PAD, fy = y - UI_CONSTANTS.FRAME_PAD;
  const fw = w + UI_CONSTANTS.FRAME_PAD * 2, fh = h + UI_CONSTANTS.FRAME_PAD * 2;
  const handleFill = theme === 'light' ? '#ffffff' : '#1e293b';

  // Frame rectangle
  ctx.save();
  ctx.strokeStyle = FRAME_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.85;
  ctx.strokeRect(fx, fy, fw, fh);
  ctx.restore();

  if (!showHandles) return;

  // Corner handles + midpoint handles
  const corners = [
    { x: fx,           y: fy           },
    { x: fx + fw,      y: fy           },
    { x: fx + fw,      y: fy + fh      },
    { x: fx,           y: fy + fh      },
  ];
  const mids = [
    { x: fx + fw / 2,  y: fy           },
    { x: fx + fw,      y: fy + fh / 2  },
    { x: fx + fw / 2,  y: fy + fh      },
    { x: fx,           y: fy + fh / 2  },
  ];

  ctx.save();
  ctx.shadowColor = 'rgba(59,130,246,0.25)';
  ctx.shadowBlur = 5;
  ctx.setLineDash([]);

  for (const c of corners) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, UI_CONSTANTS.HANDLE_CORNER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = handleFill;
    ctx.fill();
    ctx.strokeStyle = HANDLE_STROKE;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  for (const m of mids) {
    ctx.beginPath();
    ctx.arc(m.x, m.y, UI_CONSTANTS.HANDLE_MIDPOINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = handleFill;
    ctx.fill();
    ctx.strokeStyle = FRAME_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Visual indicators for selecting, hovering, and connecting shapes.
 * All functions use shared canvas state where possible to reduce boilerplate.
 */

/**
 * Draws rounded rectangular hover highlights.
 */
export function renderHoverBorder(ctx: CanvasRenderingContext2D, shape: Shape, plugin: any) {
  if (!plugin.getBounds || plugin.isConnector) return;
  const { x, y, width: w, height: h } = plugin.getBounds(shape);
  ctx.save();
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.setLineDash([]);
  if (plugin.drawHoverOutline) {
    plugin.drawHoverOutline(ctx, shape);
  } else {
    const r = plugin.getBracketRadius ? plugin.getBracketRadius(shape) : 0;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Central bracket renderer. Each handle provides a `draw` closure that renders
 * its own indicator (arc, L-bracket, tick, ellipse arc…). The renderer only
 * sets up shared canvas state and dispatches — no shape-specific logic here.
 */
export function renderHandleBrackets(
  ctx: CanvasRenderingContext2D,
  handles: Array<{ x: number; y: number; angle: number; draw?: (ctx: CanvasRenderingContext2D) => void }>,
  shapeStroke?: string,
  theme: 'light' | 'dark' = 'dark'
) {
  if (!handles.length) return;

  const fallback = theme === 'light' ? '#475569' : '#cbd5e0';
  const effectiveStroke = (!shapeStroke || shapeStroke === 'transparent' || shapeStroke === 'none')
    ? fallback
    : shapeStroke;

  ctx.save();
  ctx.strokeStyle = effectiveStroke;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  for (const h of handles) {
    if (h.draw) {
      h.draw(ctx);
    }
  }

  ctx.restore();
}

/**
 * Small diamond-shaped connection targets for arrows.
 * If activePortId is provided, that port is rendered highlighted (filled blue, larger).
 */
export function renderConnectionPoints(
  ctx: CanvasRenderingContext2D,
  points: ConnectionPoint[],
  shapeStroke?: string,
  theme: 'light' | 'dark' = 'dark',
  activePortId?: string | null
) {
  ctx.setLineDash([]);

  points.forEach(cp => {
    const isActive = activePortId != null && cp.id === activePortId;
    const s = isActive ? 8 : 5; // half-size of the diamond icon

    ctx.beginPath();
    ctx.moveTo(cp.x,     cp.y - s);
    ctx.lineTo(cp.x + s, cp.y    );
    ctx.lineTo(cp.x,     cp.y + s);
    ctx.lineTo(cp.x - s, cp.y    );
    ctx.closePath();

    ctx.fillStyle = theme === 'light' ? '#ffffff' : '#1e1e24';
    ctx.strokeStyle = getThemeAdjustedStroke(shapeStroke, theme);
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
  });
}
