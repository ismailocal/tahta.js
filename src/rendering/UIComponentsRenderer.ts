import { getThemeAdjustedStroke } from '../core/Utils';
import type { ConnectionPoint } from '../core/types';
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
