import type { IShapePlugin } from './IShapePlugin';

class Registry {
  private plugins = new Map<string, IShapePlugin>();

  register(plugin: IShapePlugin) {
    this.plugins.set(plugin.type, plugin);
  }

  getPlugin(type: string): IShapePlugin {
    const plugin = this.plugins.get(type);
    if (!plugin) {
      throw new Error(`Plugin for shape type '${type}' not found.`);
    }
    return plugin;
  }

  hasPlugin(type: string): boolean {
    return this.plugins.has(type);
  }
}

export const PluginRegistry = new Registry();
