export interface IEventBus {
  on(event: string, listener: (payload: any) => void): () => void;
  off(event: string, listener: (payload: any) => void): void;
  emit(event: string, payload: any): void;
}

/**
 * A lightweight, type-agnostic event bus for canvas and document events.
 * Used for decoupling communication between tools, shortcuts, and the renderer.
 */
export class EventBus implements IEventBus {
  private listeners = new Map<string, Set<(payload: any) => void>>();

  /**
   * Subscribes to a specific event.
   * 
   * @param event - The unique identifier for the event.
   * @param listener - The callback function to be executed when the event is emitted.
   * @returns A cleanup function that removes the listener when called.
   */
  on(event: string, listener: (payload: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener);
    return () => this.off(event, listener);
  }

  /**
   * Unsubscribes a previously registered listener from an event.
   * 
   * @param event - The specific event name.
   * @param listener - The exact listener function instance to remove.
   */
  off(event: string, listener: (payload: any) => void) {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Dispatches an event and triggers all registered listeners with the provided payload.
   * 
   * @param event - The name of the event to broadcast.
   * @param payload - Arbitrary data passed to all listeners.
   */
  emit(event: string, payload: any) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
