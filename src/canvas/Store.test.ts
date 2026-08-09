import { describe, it, expect, vi } from 'vitest';
import { WhiteboardStore } from '../core/Store'; 
import { Shape } from '../core/types';

const mockShape = (): Shape => ({
  id: '1',
  type: 'rectangle' as any,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});

describe('WhiteboardStore', () => {
  it('should notify subscribers on state change', () => {
    const store = new WhiteboardStore();
    const handler = vi.fn();
    store.subscribe(handler);
    store.addShape(mockShape());
    expect(handler).toHaveBeenCalled();
  });

  it('should not notify if state is identical', () => {
    const store = new WhiteboardStore();
    const handler = vi.fn();
    store.subscribe(handler);
    store.setState(store.getState()); // no-op
    expect(handler).not.toHaveBeenCalled();
  });
});
