/**
 * DSL shape plugins - loads all shape type plugins
 */

import { dslRegistry } from '../registry';
import { registerBasicPlugins } from './basic';
import { registerDatabasePlugins } from './database';
import { registerOtherPlugins } from './other';
import { registerConnectorPlugins } from './connectors';

/**
 * Register all built-in DSL shape plugins
 */
export function registerAllPlugins(): void {
  registerBasicPlugins();
  registerDatabasePlugins();
  registerOtherPlugins();
  registerConnectorPlugins();
}
