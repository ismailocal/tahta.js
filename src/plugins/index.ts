import type { ShapeRegistry } from '../core/registry';
import type { IShapePlugin } from './IShapePlugin';
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
import { TrianglePlugin } from './TrianglePlugin';
import { StickyNotePlugin } from './StickyNotePlugin';
import { FramePlugin } from './FramePlugin';

export function attachBuiltinShapeRuntimes(registry: ShapeRegistry): void {
  const plugins: IShapePlugin[] = [
    new RectanglePlugin(),
    new EllipsePlugin(),
    new LinePlugin(registry),
    new ArrowPlugin(registry),
    new FreehandPlugin(),
    new TextPlugin(),
    new ImagePlugin(),
    new DiamondPlugin(),
    new DbTablePlugin(),
    new DbViewPlugin(),
    new DbEnumPlugin(),
    new TrianglePlugin(),
    new StickyNotePlugin(),
    new FramePlugin(),
  ];
  for (const plugin of plugins) {
    registry.attachRuntime(plugin.type, plugin);
  }
}

export function getShapePlugin(registry: ShapeRegistry, type: string): IShapePlugin {
  return registry.getRuntime<IShapePlugin>(type);
}
