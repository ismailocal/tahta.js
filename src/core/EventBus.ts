export class EventBus {
  private listeners = new Map<string, Set<(payload: any) => void>>();

  on(event: string, listener: (payload: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: (payload: any) => void) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, payload: any) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
