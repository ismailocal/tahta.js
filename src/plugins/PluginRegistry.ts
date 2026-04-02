import type { IShapePlugin } from './IShapePlugin';
import type { Shape } from '../core/types';
import type { Plugin, PluginId, PluginContext } from './types';

export class Registry {
  private plugins = new Map<PluginId, Plugin>();
  private shapePlugins = new Map<string, IShapePlugin>();
  private toolAliases = new Map<string, string>(); // toolKey → pluginType
  private status = new Map<PluginId, 'registered' | 'active' | 'inactive' | 'error'>();

  async register(plugin: Plugin, ctx: PluginContext): Promise<void> {
    this.validateDependencies(plugin.manifest.dependencies);

    try {
      await plugin.register(ctx);
      this.plugins.set(plugin.manifest.id, plugin);
      this.status.set(plugin.manifest.id, 'registered');
    } catch (err) {
      this.status.set(plugin.manifest.id, 'error');
      ctx.logger.error(`Plugin ${plugin.manifest.id} failed to register:`, err);
    }
  }

  async activate(pluginId: PluginId): Promise<void> {
    const plugin = this.getOrThrow(pluginId);
    await this.withErrorBoundary(pluginId, () => plugin.activate());
    this.status.set(pluginId, 'active');
  }

  async deactivate(pluginId: PluginId): Promise<void> {
    const plugin = this.getOrThrow(pluginId);
    await this.withErrorBoundary(pluginId, () => plugin.deactivate());
    this.status.set(pluginId, 'inactive');
  }

  async dispose(pluginId: PluginId): Promise<void> {
    const plugin = this.getOrThrow(pluginId);
    await this.withErrorBoundary(pluginId, () => plugin.dispose());
    this.plugins.delete(pluginId);
    this.status.delete(pluginId);
  }

  private validateDependencies(dependencies?: PluginId[]): void {
    if (!dependencies) return;
    for (const dep of dependencies) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Missing dependency: ${dep}`);
      }
    }
  }

  private getOrThrow(pluginId: PluginId): Plugin {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
    return plugin;
  }

  private async withErrorBoundary(id: PluginId, fn: () => void | Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.status.set(id, 'error');
      console.error(`[Plugin:${id}] error:`, err);
    }
  }

  // --- Legacy / Shape Plugin Logic ---

  registerShape(plugin: IShapePlugin) {
    this.shapePlugins.set(plugin.type, plugin);
  }

  registerToolAlias(toolKey: string, pluginType: string) {
    this.toolAliases.set(toolKey, pluginType);
  }

  getPluginForTool(toolKey: string): IShapePlugin | null {
    if (this.shapePlugins.has(toolKey)) return this.shapePlugins.get(toolKey)!;
    const aliased = this.toolAliases.get(toolKey);
    if (aliased && this.shapePlugins.has(aliased)) return this.shapePlugins.get(aliased)!;
    return null;
  }

  getPlugin(type: string): IShapePlugin {
    const plugin = this.shapePlugins.get(type);
    if (!plugin) {
      throw new Error(`Plugin for shape type '${type}' not found.`);
    }
    return plugin;
  }

  getShape(type: string): IShapePlugin {
    return this.getPlugin(type);
  }

  hasPlugin(type: string): boolean {
    return this.shapePlugins.has(type);
  }

  getAllShapes(): IShapePlugin[] {
    return Array.from(this.shapePlugins.values());
  }

  getDefaultStyle(type: string): Partial<Shape> {
    return this.shapePlugins.get(type)?.defaultStyle ?? {};
  }

  getDefaultProperties(type: string): string[] {
    return this.shapePlugins.get(type)?.defaultProperties ?? ['layer', 'action'];
  }
}

export const PluginRegistry = new Registry();
