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

  it('restores additions, deletions, nested data and ordering through deltas', () => {
    const first = mockShape('1');
    const second = { ...mockShape('2'), data: { nested: { value: 1 } } };
    const mgr = new HistoryManager([first, second]);
    const changed = { ...second, data: { nested: { value: 2 } } };

    mgr.commit([changed, mockShape('3')]);
    expect(mgr.undo()).toEqual([first, second]);
    expect(mgr.redo()).toEqual([changed, mockShape('3')]);
  });

  it('drops redo deltas after a new commit', () => {
    const mgr = new HistoryManager([mockShape('1')]);
    mgr.commit([mockShape('1'), mockShape('2')]);
    mgr.undo();
    mgr.commit([mockShape('1'), mockShape('3')]);
    expect(mgr.canRedo).toBe(false);
  });
});
