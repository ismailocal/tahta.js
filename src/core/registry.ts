import type { z } from 'zod';
import type { ShapeRecord } from './model.js';
import { CanvasValidationError, shapeRecordSchema } from './model.js';

export interface ShapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConnectionPort {
  id: string;
  x: number;
  y: number;
  direction: 'up' | 'right' | 'down' | 'left';
}

export interface ShapeGeometry<Props> {
  getBounds(record: ShapeRecord<Props>): ShapeBounds;
  containsPoint(record: ShapeRecord<Props>, point: { x: number; y: number }): boolean;
  getConnectionPorts?(record: ShapeRecord<Props>): readonly ConnectionPort[];
}

export interface ShapeRenderContext<Props> {
  context: CanvasRenderingContext2D;
  record: ShapeRecord<Props>;
  selected: boolean;
  theme: 'light' | 'dark';
  getImage(assetId: string): CanvasImageSource | null;
}

export interface ShapeExportContext<Props> {
  record: ShapeRecord<Props>;
  theme: 'light' | 'dark';
  resolveAssetHref(assetId: string): string;
}

export interface ToolDefinition { label: string; shortcut?: string }
export interface PropertyDefinition { key: string; label: string; control: 'number' | 'color' | 'select' | 'text'; options?: readonly string[]; scope?: 'props' | 'record' }

export interface ShapeDefinition<Props = unknown> {
  readonly type: string;
  readonly version: number;
  readonly schema: z.ZodType<Props>;
  defaults(): Props;
  readonly geometry: ShapeGeometry<Props>;
  render(context: ShapeRenderContext<Props>): void;
  exportSvg(context: ShapeExportContext<Props>): string;
  readonly tool?: ToolDefinition;
  readonly properties?: readonly PropertyDefinition[];
  readonly commands?: readonly string[];
}

export class ShapeRegistry {
  readonly #definitions = new Map<string, ShapeDefinition>();

  register<Props>(definition: ShapeDefinition<Props>): void {
    if (this.#definitions.has(definition.type)) {
      throw new CanvasValidationError(`Shape definition '${definition.type}' is already registered`, 'DUPLICATE_SHAPE_TYPE');
    }
    if (!definition.type || !Number.isInteger(definition.version) || definition.version < 1) {
      throw new CanvasValidationError('Shape definitions require a type and positive integer version');
    }
    this.#definitions.set(definition.type, definition as ShapeDefinition);
  }

  get(type: string): ShapeDefinition {
    const definition = this.#definitions.get(type);
    if (!definition) {
      throw new CanvasValidationError(`Shape definition '${type}' is not registered`, 'UNKNOWN_SHAPE_TYPE');
    }
    return definition;
  }

  has(type: string): boolean {
    return this.#definitions.has(type);
  }

  list(): readonly ShapeDefinition[] {
    return [...this.#definitions.values()];
  }

  validate(record: ShapeRecord): ShapeRecord {
    const base = shapeRecordSchema.parse(record) as ShapeRecord;
    const definition = this.get(base.type);
    if (base.typeVersion !== definition.version) {
      throw new CanvasValidationError(
        `Shape '${base.id}' uses ${base.type}@${base.typeVersion}; expected version ${definition.version}`,
        'UNSUPPORTED_SHAPE_VERSION',
      );
    }
    return { ...base, props: definition.schema.parse(base.props) };
  }
}
