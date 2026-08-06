import type { CanvasState, ICanvasAPI, PointerPayload, ToolDefinition } from '../core/types';
import { TemplateTool } from '../tools/TemplateTool';
import { screenToWorld } from '../geometry/Geometry';
import { clamp } from '../core/Utils';
import { setupKeyboard } from './KeyboardManager';
import { setupClipboard } from './ClipboardManager';

export function createPointerPayload(canvas: HTMLCanvasElement, event: PointerEvent, state: CanvasState): PointerPayload {
  const rect = canvas.getBoundingClientRect();
  const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const world = screenToWorld(screen, state.viewport);
  
  if (state.showGrid && state.gridSize) {
    world.x = Math.round(world.x / state.gridSize) * state.gridSize;
    world.y = Math.round(world.y / state.gridSize) * state.gridSize;
  }

  return {
    nativeEvent: event,
    screen,
    world,
    button: event.button,
    pointerId: event.pointerId,
    pressure: event.pressure > 0 ? event.pressure : undefined,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  };
}

export class InputManager {
  private activeOverrideTool: string | null = null;
  private tools: Record<string, ToolDefinition>;
  private api: ICanvasAPI;
  private canvas: HTMLCanvasElement;
  private disposeHandlers: (() => void)[] = [];
  private activeTouches = new Map<number, PointerEvent>();
  private touchGesture: {
    pointerIds: Set<number>;
    initialDistance: number;
    initialWorldCenter: { x: number; y: number };
    initialViewport: CanvasState['viewport'];
  } | null = null;

  constructor(canvas: HTMLCanvasElement, api: ICanvasAPI, tools: Record<string, ToolDefinition>) {
    this.canvas = canvas;
    this.api = api;
    this.tools = tools;
    this.activeOverrideTool = null; // Explicitly reset on initialization
    this.attach();
  }

  private getActiveTool() {
    return this.activeOverrideTool !== null ? this.activeOverrideTool : this.api.getState().activeTool;
  }

  private handlePointer(kind: 'down' | 'move' | 'up', event: PointerEvent) {
    const state = this.api.getState();
    const payload = createPointerPayload(this.canvas, event, state);

    // In readOnly mode, only allow hand tool (pan) — block all drawing/editing
    if (state.readOnly) {
      const hand = this.tools['hand'];
      if (!hand) return;
      if (kind === 'down') { this.activeOverrideTool = 'hand'; hand.onPointerDown?.(payload, this.api); }
      if (kind === 'move') {
        this.api.bus.emit('pointer:update', { pointer: payload.world, button: payload.button });
        hand.onPointerMove?.(payload, this.api);
      }
      if (kind === 'up') { hand.onPointerUp?.(payload, this.api); this.activeOverrideTool = null; this.api.bus.emit('pointer:update', { pointer: payload.world, button: 'up' }); }
      return;
    }

    const toolName = this.getActiveTool();
    let tool = this.tools[toolName];
    
    // Lazy resolution for dynamic tools (e.g. custom user templates)
    if (!tool && toolName.startsWith('template-')) {
      const templateKey = toolName.replace('template-', '');
      tool = new TemplateTool(templateKey);
      this.tools[toolName] = tool;
    }

    if (!tool) return;

    if (kind === 'down' && tool.onPointerDown) tool.onPointerDown(payload, this.api);
    if (kind === 'move') {
      this.api.bus.emit('pointer:update', { pointer: payload.world, button: payload.button });
      if (tool.onPointerMove) tool.onPointerMove(payload, this.api);
    }
    if (kind === 'up') {
      if (tool.onPointerUp) tool.onPointerUp(payload, this.api);
      this.api.bus.emit('pointer:update', { pointer: payload.world, button: 'up' });
    }
  }

  private attach() {
    const onDown = (e: PointerEvent) => {
      this.canvas.setPointerCapture(e.pointerId);
      if (e.pointerType === 'touch') {
        this.activeTouches.set(e.pointerId, e);
        if (this.activeTouches.size === 2) {
          const touches = [...this.activeTouches.values()];
          // Finish a potential one-finger action before switching to a gesture.
          this.handlePointer('up', touches[0]);
          const first = this.getScreenPoint(touches[0]);
          const second = this.getScreenPoint(touches[1]);
          const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
          const viewport = this.api.getState().viewport;
          this.touchGesture = {
            pointerIds: new Set(touches.map(({ pointerId }) => pointerId)),
            initialDistance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
            initialWorldCenter: screenToWorld(center, viewport),
            initialViewport: { ...viewport },
          };
          e.preventDefault();
          return;
        }
      }
      if (e.button === 1) this.activeOverrideTool = 'hand';
      this.handlePointer('down', e);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && this.activeTouches.has(e.pointerId)) {
        this.activeTouches.set(e.pointerId, e);
      }
      if (this.touchGesture?.pointerIds.has(e.pointerId)) {
        this.updateTouchGesture();
        e.preventDefault();
        return;
      }
      this.handlePointer('move', e);
    };
    const onUp = (e: PointerEvent) => {
      if (this.touchGesture?.pointerIds.has(e.pointerId)) {
        this.activeTouches.delete(e.pointerId);
        this.touchGesture.pointerIds.delete(e.pointerId);
        if (this.touchGesture.pointerIds.size === 0) this.touchGesture = null;
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
        return;
      }
      this.handlePointer('up', e);
      this.activeTouches.delete(e.pointerId);
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      this.activeOverrideTool = null;
    };
    const onCancel = (e: PointerEvent) => {
      if (this.touchGesture?.pointerIds.has(e.pointerId)) {
        this.activeTouches.delete(e.pointerId);
        this.touchGesture.pointerIds.delete(e.pointerId);
        if (this.touchGesture.pointerIds.size === 0) this.touchGesture = null;
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
        return;
      }
      this.handlePointer('up', e);
      this.activeTouches.delete(e.pointerId);
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      this.activeOverrideTool = null;
    };
    const onLeave = (e: PointerEvent) => {
      if (e.buttons !== 0) this.handlePointer('up', e);
      this.activeOverrideTool = null;
    };
    const onWheel = (e: WheelEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const state = this.api.getState();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const worldBeforeZoom = screenToWorld(screen, state.viewport);
        const nextZoom = clamp(state.viewport.zoom * (e.deltaY > 0 ? 0.95 : 1.05), 0.2, 4);
        this.api.setViewport({
          zoom: nextZoom,
          x: screen.x - worldBeforeZoom.x * nextZoom,
          y: screen.y - worldBeforeZoom.y * nextZoom,
        });
        return;
      }
      // Shift+scroll for horizontal panning
      if (e.shiftKey) {
        e.preventDefault();
        this.api.setViewport({
          ...state.viewport,
          x: state.viewport.x - e.deltaY,
          y: state.viewport.y,
        });
        return;
      }
      this.api.setViewport({
        ...state.viewport,
        x: state.viewport.x - e.deltaX,
        y: state.viewport.y - e.deltaY,
      });
    };

    const keyboardDisposers = setupKeyboard(this.api, this.tools, (tool) => {
      this.activeOverrideTool = tool;
    });

    const clipboardDisposers = setupClipboard(this.api, this.canvas);

    const onDoubleClick = (e: MouseEvent) => {
      const state = this.api.getState();
      const payload = createPointerPayload(this.canvas, e as unknown as PointerEvent, state);
      const toolName = this.getActiveTool();
      const tool = this.tools[toolName];
      if (tool && tool.onDoubleClick) tool.onDoubleClick(payload, this.api);
    };

    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('pointerup', onUp);
    this.canvas.addEventListener('pointercancel', onCancel);
    this.canvas.addEventListener('pointerleave', onLeave);
    this.canvas.addEventListener('dblclick', onDoubleClick);
    this.canvas.addEventListener('wheel', onWheel, { passive: false });

    this.disposeHandlers = [
      () => this.canvas.removeEventListener('pointerdown', onDown),
      () => this.canvas.removeEventListener('pointermove', onMove),
      () => this.canvas.removeEventListener('pointerup', onUp),
      () => this.canvas.removeEventListener('pointercancel', onCancel),
      () => this.canvas.removeEventListener('pointerleave', onLeave),
      () => this.canvas.removeEventListener('dblclick', onDoubleClick),
      () => this.canvas.removeEventListener('wheel', onWheel),
      ...keyboardDisposers,
      ...clipboardDisposers,
    ];
  }

  private getScreenPoint(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private updateTouchGesture(): void {
    if (!this.touchGesture || this.touchGesture.pointerIds.size < 2) return;
    const touches = [...this.touchGesture.pointerIds]
      .map((pointerId) => this.activeTouches.get(pointerId))
      .filter((event): event is PointerEvent => Boolean(event));
    if (touches.length < 2) return;

    const first = this.getScreenPoint(touches[0]);
    const second = this.getScreenPoint(touches[1]);
    const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
    const zoom = clamp(
      this.touchGesture.initialViewport.zoom * distance / this.touchGesture.initialDistance,
      0.2,
      4,
    );
    this.api.setViewport({
      zoom,
      x: center.x - this.touchGesture.initialWorldCenter.x * zoom,
      y: center.y - this.touchGesture.initialWorldCenter.y * zoom,
    });
  }

  destroy() {
    this.disposeHandlers.forEach(fn => fn());
    this.disposeHandlers = [];
    this.activeTouches.clear();
    this.touchGesture = null;
  }
}
