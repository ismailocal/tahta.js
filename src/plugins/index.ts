import { PluginRegistry } from './PluginRegistry';
import { RectanglePlugin } from './RectanglePlugin';
import { EllipsePlugin } from './EllipsePlugin';
import { LinePlugin } from './LinePlugin';
import { ArrowPlugin } from './ArrowPlugin';
import { FreehandPlugin } from './FreehandPlugin';
import { TextPlugin } from './TextPlugin';
import { ImagePlugin } from './ImagePlugin';
import { DiamondPlugin } from './DiamondPlugin';

PluginRegistry.register(new RectanglePlugin());
PluginRegistry.register(new EllipsePlugin());
PluginRegistry.register(new LinePlugin());
PluginRegistry.register(new ArrowPlugin());
PluginRegistry.register(new FreehandPlugin());
PluginRegistry.register(new TextPlugin());
PluginRegistry.register(new ImagePlugin());
PluginRegistry.register(new DiamondPlugin());

export { PluginRegistry };
