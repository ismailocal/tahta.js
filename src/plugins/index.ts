import { PluginRegistry } from './PluginRegistry';
import { RectanglePlugin } from './RectanglePlugin';
import { EllipsePlugin } from './EllipsePlugin';
import { LinePlugin } from './LinePlugin';
import { ArrowPlugin } from './ArrowPlugin';
import { FreehandPlugin } from './FreehandPlugin';
import { TextPlugin } from './TextPlugin';
import { ImagePlugin } from './ImagePlugin';
import { DiamondPlugin } from './DiamondPlugin';
import { DbTablePlugin } from './DbTablePlugin';
import { DbViewPlugin } from './DbViewPlugin';
import { DbEnumPlugin } from './DbEnumPlugin';

PluginRegistry.registerShape(new RectanglePlugin());
PluginRegistry.registerShape(new EllipsePlugin());
PluginRegistry.registerShape(new LinePlugin());
PluginRegistry.registerShape(new ArrowPlugin());
PluginRegistry.registerShape(new FreehandPlugin());
PluginRegistry.registerShape(new TextPlugin());
PluginRegistry.registerShape(new ImagePlugin());
PluginRegistry.registerShape(new DiamondPlugin());
PluginRegistry.registerShape(new DbTablePlugin());
PluginRegistry.registerShape(new DbViewPlugin());
PluginRegistry.registerShape(new DbEnumPlugin());

export { PluginRegistry };
