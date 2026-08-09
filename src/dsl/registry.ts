/**
 * Plugin registry for extensible DSL shape types
 */

import type { DSLShapePlugin } from './types';

class DSLRegistry {
  private plugins: Map<string, DSLShapePlugin> = new Map();

  register(plugin: DSLShapePlugin): void {
    if (this.plugins.has(plugin.type)) {
      console.warn(`DSL plugin for type "${plugin.type}" already registered, overwriting`);
    }
    this.plugins.set(plugin.type, plugin);
  }

  getPlugin(type: string): DSLShapePlugin | undefined {
    return this.plugins.get(type);
  }

  getAllPlugins(): DSLShapePlugin[] {
    return Array.from(this.plugins.values());
  }

  hasPlugin(type: string): boolean {
    return this.plugins.has(type);
  }

  unregister(type: string): boolean {
    return this.plugins.delete(type);
  }

  clear(): void {
    this.plugins.clear();
  }
}

// Singleton instance
export const dslRegistry = new DSLRegistry();
