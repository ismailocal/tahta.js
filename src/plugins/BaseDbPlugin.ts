import type { Shape, PointerPayload, Point, ConnectionPoint, ICanvasAPI } from '../core/types';
import { BaseRectPlugin } from './BaseRectPlugin';

/**
 * Base class for database-related shape plugins (Table, View, Enum).
 * Provides common functionality for rendering database shapes with headers and rows.
 */
export abstract class BaseDbPlugin extends BaseRectPlugin {
  protected abstract readonly DEFAULT_WIDTH: number;
  protected abstract readonly DEFAULT_HEIGHT: number;
  protected abstract readonly HEADER_HEIGHT: number;
  protected abstract readonly ROW_HEIGHT: number;
  protected abstract readonly BADGE_HEIGHT: number;

  protected minWidth = 80;
  protected minHeight = 40;

  getCornerRadius(): number { return 6; }

  /**
   * Get the number of rows in the database shape.
   * Must be implemented by subclasses.
   */
  protected abstract getRowCount(shape: Shape): number;

  getDefaultHeight(shape: Shape): number {
    const rowCount = this.getRowCount(shape);
    return this.HEADER_HEIGHT + Math.max(1, rowCount) * this.ROW_HEIGHT;
  }

  getBounds(shape: Shape) {
    return {
      x: shape.x,
      y: shape.y,
      width: shape.width ?? this.DEFAULT_WIDTH,
      height: shape.height ?? this.getDefaultHeight(shape),
    };
  }

  /**
   * Render the common header background for database shapes.
   */
  protected renderHeaderBackground(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    headerColor: string,
    accentColor: string
  ): void {
    ctx.fillStyle = headerColor;
    ctx.beginPath();
    ctx.rect(x, y, w, this.HEADER_HEIGHT);
    ctx.fill();

    ctx.fillStyle = accentColor;
    ctx.fillRect(x, y + this.HEADER_HEIGHT - 2, w, 2);
  }

  /**
   * Render a row separator line.
   */
  protected renderRowSeparator(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    lineColor: string
  ): void {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  }

  /**
   * Render the border around the shape.
   */
  protected renderBorder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    accentColor: string,
    isDashed: boolean = false
  ): void {
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    if (isDashed) {
      ctx.setLineDash([6, 3]);
    }
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.stroke();
    if (isDashed) {
      ctx.setLineDash([]);
    }
  }

  /**
   * Get connection points for each row.
   * Must be implemented by subclasses to provide row labels.
   */
  protected abstract getRowLabels(shape: Shape): string[];

  getConnectionPoints(shape: Shape): ConnectionPoint[] {
    const labels = this.getRowLabels(shape);
    const { x, y } = shape;
    const w = shape.width ?? this.DEFAULT_WIDTH;
    const h = shape.height ?? this.getDefaultHeight(shape);
    const points: ConnectionPoint[] = [];

    labels.forEach((label, i) => {
      const rowY = y + this.HEADER_HEIGHT + i * this.ROW_HEIGHT + this.ROW_HEIGHT / 2;
      if (rowY > y + h) return;
      points.push({ id: `row-${i}-left`, x, y: rowY, label, side: 'left' });
      points.push({ id: `row-${i}-right`, x: x + w, y: rowY, label, side: 'right' });
    });

    return points;
  }
}
