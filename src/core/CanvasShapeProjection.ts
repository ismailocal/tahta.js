import type { CanvasViewState } from './CanvasEngine.js';
import type { BindingRecord, CanvasSnapshotV2, ShapeRecord } from './model.js';
import { recordToShape, recordsInRenderOrder } from './projection.js';
import type { ShapeRegistry } from './registry.js';
import type { Shape } from './types.js';
import { getWorldTransform, type Transform2D } from './transforms.js';

interface ProjectedShape {
  readonly record: ShapeRecord;
  readonly binding: BindingRecord | undefined;
  readonly assetHref: string | undefined;
  readonly worldTransform: Transform2D;
  readonly shape: Shape;
}

interface ProjectionCandidate {
  readonly record: ShapeRecord;
  readonly zIndex: number;
  readonly binding: BindingRecord | undefined;
  readonly assetHref: string | undefined;
  readonly worldTransform: Transform2D;
  readonly previous: ProjectedShape | undefined;
  readonly canReuseDirectly: boolean;
}

export interface CanvasShapeProjectionChange {
  readonly id: string;
  readonly shape?: Shape;
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
  #changes: readonly CanvasShapeProjectionChange[] = [];

  constructor(registry: ShapeRegistry) {
    this.#registry = registry;
  }

  project(view: CanvasViewState): Shape[] {
    if (this.#snapshot === view.snapshot && this.#assetHrefs === view.assetHrefs) {
      this.#changedShapeIds = [];
      this.#changes = [];
      return this.#shapes;
    }

    const bindingByConnector = new Map(view.snapshot.bindings.map((binding) => [binding.connectorId, binding]));
    const recordById = new Map(view.snapshot.records.map((record) => [record.id, record]));
    const visibleRecords = recordsInRenderOrder(view.snapshot.records).filter((record) => !record.hidden);
    const visibleRecordIds = new Set(visibleRecords.map(({ id }) => id));
    const candidates: ProjectionCandidate[] = visibleRecords.map((record, zIndex) => {
      const binding = bindingByConnector.get(record.id);
      const assetHref = this.#assetHref(record, view.assetHrefs);
      const worldTransform = getWorldTransform(record.id, recordById);
      const previous = this.#projectedById.get(record.id);
      return {
        record,
        zIndex,
        binding,
        assetHref,
        worldTransform,
        previous,
        canReuseDirectly: previous?.record === record
          && previous.binding === binding
          && previous.assetHref === assetHref
          && previous.worldTransform.x === worldTransform.x
          && previous.worldTransform.y === worldTransform.y
          && previous.worldTransform.rotation === worldTransform.rotation
          && previous.shape.zIndex === zIndex,
      };
    });
    const changedIds = new Set<string>();
    candidates.forEach(({ record, canReuseDirectly }) => {
      if (!canReuseDirectly) changedIds.add(record.id);
    });
    this.#projectedById.forEach((_value, id) => {
      if (!visibleRecordIds.has(id)) changedIds.add(id);
    });

    const boundConnectorsByTarget = new Map<string, Set<string>>();
    candidates.forEach(({ record, binding }) => {
      [binding?.start?.shapeId, binding?.end?.shapeId].forEach((targetId) => {
        if (!targetId) return;
        let connectors = boundConnectorsByTarget.get(targetId);
        if (!connectors) {
          connectors = new Set();
          boundConnectorsByTarget.set(targetId, connectors);
        }
        connectors.add(record.id);
      });
    });
    const dependencyQueue = [...changedIds];
    for (let index = 0; index < dependencyQueue.length; index += 1) {
      boundConnectorsByTarget.get(dependencyQueue[index])?.forEach((connectorId) => {
        if (changedIds.has(connectorId)) return;
        changedIds.add(connectorId);
        dependencyQueue.push(connectorId);
      });
    }

    const nextById = new Map<string, ProjectedShape>();
    const nextShapes = new Array<Shape>(visibleRecords.length);
    candidates.forEach(({ record, zIndex, binding, assetHref, worldTransform, previous, canReuseDirectly }) => {
      const canReuse = canReuseDirectly && !changedIds.has(record.id);
      const shape = canReuse && previous
        ? previous.shape
        : this.#createShape(record, zIndex, binding, assetHref, worldTransform);
      nextShapes[zIndex] = shape;
      nextById.set(record.id, { record, binding, assetHref, worldTransform, shape });
    });

    this.#snapshot = view.snapshot;
    this.#assetHrefs = view.assetHrefs;
    this.#projectedById = nextById;
    this.#shapes = nextShapes;
    this.#changedShapeIds = [...changedIds];
    this.#changes = this.#changedShapeIds.map((id) => ({ id, shape: nextById.get(id)?.shape }));
    return this.#shapes;
  }

  get changedShapeIds(): readonly string[] {
    return this.#changedShapeIds;
  }

  get changes(): readonly CanvasShapeProjectionChange[] {
    return this.#changes;
  }

  clear(): void {
    this.#snapshot = null;
    this.#assetHrefs = null;
    this.#projectedById.clear();
    this.#shapes = [];
    this.#changedShapeIds = [];
    this.#changes = [];
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
    worldTransform: Transform2D,
  ): Shape {
    const shape = recordToShape(record, zIndex, binding, this.#registry, worldTransform);
    return assetHref ? Object.freeze({ ...shape, imageSrc: assetHref }) : shape;
  }
}
