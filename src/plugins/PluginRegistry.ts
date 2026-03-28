import type { IShapePlugin } from './IShapePlugin';
import type { Shape } from '../core/types';

class Registry {
  private plugins = new Map<string, IShapePlugin>();
  private toolAliases = new Map<string, string>(); // toolKey → pluginType

  register(plugin: IShapePlugin) {
    this.plugins.set(plugin.type, plugin);
  }

  /** Map a tool key to an existing plugin type (e.g. 'arrow-double' → 'arrow'). */
  registerToolAlias(toolKey: string, pluginType: string) {
    this.toolAliases.set(toolKey, pluginType);
  }

  /** Resolve a tool key to its plugin. Returns null if not found. */
  getPluginForTool(toolKey: string): IShapePlugin | null {
    if (this.plugins.has(toolKey)) return this.plugins.get(toolKey)!;
    const aliased = this.toolAliases.get(toolKey);
    if (aliased && this.plugins.has(aliased)) return this.plugins.get(aliased)!;
    return null;
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

  /** All registered plugins in registration order. */
  getAll(): IShapePlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Default style declared by the plugin, or empty object if not set. */
  getDefaultStyle(type: string): Partial<Shape> {
    return this.plugins.get(type)?.defaultStyle ?? {};
  }

  /** Property panel keys declared by the plugin, or ['layer', 'action'] as fallback. */
  getDefaultProperties(type: string): string[] {
    return this.plugins.get(type)?.defaultProperties ?? ['layer', 'action'];
  }
}

export const PluginRegistry = new Registry();
