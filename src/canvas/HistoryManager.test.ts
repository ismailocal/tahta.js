import { describe, it, expect } from 'vitest';
import { HistoryManager } from './HistoryManager';
import { Shape } from '../core/types';

const mockShape = (id: string): Shape => ({
  id,
  type: 'rectangle' as any,
  x: 0,
  y: 0,
});

describe('HistoryManager', () => {
  it('should undo the last action', () => {
    const mgr = new HistoryManager([mockShape('1')]);
    mgr.commit([mockShape('1'), mockShape('2')]);
    
    expect(mgr.canUndo).toBe(true);
    const shapes = mgr.undo();
    expect(shapes?.length).toBe(1);
    expect(shapes?.[0].id).toBe('1');
  });

  it('should redo the last undone action', () => {
    const mgr = new HistoryManager([mockShape('1')]);
    mgr.commit([mockShape('1'), mockShape('2')]);
    mgr.undo();
    
    expect(mgr.canRedo).toBe(true);
    const shapes = mgr.redo();
    expect(shapes?.length).toBe(2);
    expect(shapes?.[1].id).toBe('2');
  });
});
