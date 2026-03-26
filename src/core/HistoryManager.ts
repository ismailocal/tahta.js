import type { Shape } from './types';

export const clone = (shapes: Shape[]): Shape[] => [...shapes];

export class HistoryManager {
  private history: Shape[][] = [];
  private historyIndex: number = -1;
  private maxHistory: number = 50;

  constructor(initialShapes: Shape[] = []) {
    this.commit(initialShapes);
  }

  commit(shapes: Shape[]) {
    // If we're in the middle of history and commit something new, discard forward history
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    this.history.push(clone(shapes));
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.historyIndex--; // Shift index back
    }
    
    this.historyIndex = this.history.length - 1;
  }

  undo(): Shape[] | null {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return clone(this.history[this.historyIndex]);
    }
    return null;
  }

  redo(): Shape[] | null {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return clone(this.history[this.historyIndex]);
    }
    return null;
  }

  get canUndo(): boolean {
    return this.historyIndex > 0;
  }

  get canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  get currentShapes(): Shape[] {
    return this.historyIndex >= 0 ? clone(this.history[this.historyIndex]) : [];
  }
}
