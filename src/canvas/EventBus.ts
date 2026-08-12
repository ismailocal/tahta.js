interface IEventBus {
  on<T>(event: string, listener: (payload: T) => void): () => void;
  off<T>(event: string, listener: (payload: T) => void): void;
  emit<T>(event: string, payload: T): void;
}

type EventListener = (payload: unknown) => void;

/**
 * A lightweight, type-agnostic event bus for canvas and document events.
 * Used for decoupling communication between tools, shortcuts, and the renderer.
 */
export class EventBus implements IEventBus {
  private listeners = new Map<string, Set<EventListener>>();

  /**
   * Subscribes to a specific event.
   * 
   * @param event - The unique identifier for the event.
   * @param listener - The callback function to be executed when the event is emitted.
   * @returns A cleanup function that removes the listener when called.
   */
  on<T>(event: string, listener: (payload: T) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener as EventListener);
    return () => this.off(event, listener);
  }

  /**
   * Unsubscribes a previously registered listener from an event.
   * 
   * @param event - The specific event name.
   * @param listener - The exact listener function instance to remove.
   */
  off<T>(event: string, listener: (payload: T) => void) {
    this.listeners.get(event)?.delete(listener as EventListener);
  }

  /**
   * Dispatches an event and triggers all registered listeners with the provided payload.
   * 
   * @param event - The name of the event to broadcast.
   * @param payload - Arbitrary data passed to all listeners.
   */
  emit<T>(event: string, payload: T) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
