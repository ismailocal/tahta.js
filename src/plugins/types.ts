import type { ICanvasAPI, Shape, Point, CanvasState } from '../core/types';
import type { IEventBus } from '../canvas/EventBus';
import type { ICommandBus } from '../canvas/CommandBus';

export type PluginId = string & { readonly __brand: 'PluginId' };

export type PluginCapability =
  | 'shape'
  | 'tool'
  | 'toolbar-item'
  | 'panel'
  | 'command'
  | 'shortcut'
  | 'context-menu'
  | 'export';

export interface PluginManifest {
  readonly id: PluginId;
  readonly name: string;
  readonly version: string;
  readonly dependencies?: PluginId[];
  readonly capabilities: PluginCapability[];
}

export interface PluginContext {
  readonly api: ICanvasAPI;
  readonly eventBus: IEventBus;
  readonly commandBus: ICommandBus;
  readonly getStoreState: () => Readonly<CanvasState>;
  readonly logger: { error: (...args: any[]) => void; info: (...args: any[]) => void };
  readonly config: Readonly<Record<string, unknown>>;
}

export interface ToolbarItem {
  id: string;
  icon: string | (() => HTMLElement);
  label: string;
  tool: string;             // hangi tool'u aktive ettiği
  group?: string;           // toolbar group
  shortcut?: string;
  order?: number;
}

export interface PanelDefinition {
  id: string;
  position: 'left' | 'right' | 'bottom';
  render: (ctx: PluginContext) => HTMLElement;
  defaultVisible?: boolean;
}

export interface CommandDefinition {
  id: string;
  label: string;
  execute: (ctx: PluginContext) => void | Promise<void>;
  shortcut?: string;
  when?: (state: CanvasState) => boolean; 
}

export interface ContextMenuItem {
  id: string;
  label: string;
  execute: (ctx: PluginContext, targetId?: string) => void | Promise<void>;
}

export interface ShortcutDefinition {
  keys: string;
  commandId: string;
}

export interface Plugin {
  readonly manifest: PluginManifest;

  // Lifecycle
  register(ctx: PluginContext): void | Promise<void>;
  activate(): void | Promise<void>;
  deactivate(): void | Promise<void>;
  dispose(): void | Promise<void>;

  // Optional extension points
  getToolbarItems?(): ToolbarItem[];
  getPanels?(): PanelDefinition[];
  getCommands?(): CommandDefinition[];
  getShortcuts?(): ShortcutDefinition[];
  getContextMenuItems?(): ContextMenuItem[];
}
