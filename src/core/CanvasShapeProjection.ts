import type { CanvasViewState } from './CanvasEngine.js';
import type { BindingRecord, CanvasSnapshotV2, ShapeRecord } from './model.js';
import { recordToShape } from './projection.js';
import type { ShapeRegistry } from './registry.js';
import type { Shape } from './types.js';

interface ProjectedShape {
  readonly record: ShapeRecord;
  readonly binding: BindingRecord | undefined;
  readonly assetHref: string | undefined;
  readonly shape: Shape;
}

/**
 * Maintains the immutable renderer projection while preserving references for
 * records that did not change. View-only updates return the exact same array.
 */
export class CanvasShapeProjection {
  readonly #registry: ShapeRegistry;
  #snapshot: CanvasSnapshotV2 | null = null;
  #assetHrefs: ReadonlyMap<string, string> | null = null;
  #projectedById = new Map<string, ProjectedShape>();
  #shapes: Shape[] = [];
  #changedShapeIds: readonly string[] = [];

  constructor(registry: ShapeRegistry) {
    this.#registry = registry;
  }

  project(view: CanvasViewState): Shape[] {
    if (this.#snapshot === view.snapshot && this.#assetHrefs === view.assetHrefs) {
      this.#changedShapeIds = [];
      return this.#shapes;
    }

    const bindingByConnector = new Map(view.snapshot.bindings.map((binding) => [binding.connectorId, binding]));
    const visibleRecords = view.snapshot.records.filter((record) => !record.hidden);
    const orderChanged = visibleRecords.length !== this.#shapes.length
      || visibleRecords.some((record, index) => this.#shapes[index]?.id !== record.id);
    const nextById = new Map<string, ProjectedShape>();
    const nextShapes = new Array<Shape>(visibleRecords.length);
    const changedIds = new Set<string>();

    visibleRecords.forEach((record, zIndex) => {
      const binding = bindingByConnector.get(record.id);
      const assetHref = this.#assetHref(record, view.assetHrefs);
      const previous = this.#projectedById.get(record.id);
      const canReuse = !orderChanged
        && previous?.record === record
        && previous.binding === binding
        && previous.assetHref === assetHref;
      const shape = canReuse
        ? previous.shape
        : this.#createShape(record, zIndex, binding, assetHref);
      if (!canReuse) changedIds.add(record.id);
      nextShapes[zIndex] = shape;
      nextById.set(record.id, { record, binding, assetHref, shape });
    });
    this.#projectedById.forEach((_value, id) => {
      if (!nextById.has(id)) changedIds.add(id);
    });

    this.#snapshot = view.snapshot;
    this.#assetHrefs = view.assetHrefs;
    this.#projectedById = nextById;
    this.#shapes = nextShapes;
    this.#changedShapeIds = [...changedIds];
    return this.#shapes;
  }

  get changedShapeIds(): readonly string[] {
    return this.#changedShapeIds;
  }

  clear(): void {
    this.#snapshot = null;
    this.#assetHrefs = null;
    this.#projectedById.clear();
    this.#shapes = [];
    this.#changedShapeIds = [];
  }

  #assetHref(record: ShapeRecord, hrefs: ReadonlyMap<string, string>): string | undefined {
    if (record.type !== 'image') return undefined;
    const assetId = (record.props as { assetId?: unknown }).assetId;
    return typeof assetId === 'string' ? hrefs.get(assetId) : undefined;
  }

  #createShape(
    record: ShapeRecord,
    zIndex: number,
    binding: BindingRecord | undefined,
    assetHref: string | undefined,
  ): Shape {
    const shape = recordToShape(record, zIndex, binding, this.#registry);
    return assetHref ? Object.freeze({ ...shape, imageSrc: assetHref }) : shape;
  }
}
