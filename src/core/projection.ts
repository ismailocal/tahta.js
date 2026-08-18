import { generateKeyBetween } from 'fractional-indexing';
import type { CanvasState, Shape, ShapeBinding, ShapeType } from './types.js';
import {
  CANVAS_SCHEMA_VERSION,
  CanvasValidationError,
  ROOT_PARENT_ID,
  compareFractionalIndex,
  type BindingRecord,
  type CanvasSnapshotV2,
  type ShapeRecord,
} from './model.js';
import type { ShapeRegistry } from './registry.js';
import type { CanvasCommand } from './commands.js';
import { getWorldTransform, toLocalTransform, type Transform2D } from './transforms.js';

const RECORD_FIELDS = new Set([
  'id', 'type', 'parentId', 'x', 'y', 'rotation', 'opacity', 'locked', 'startBinding', 'endBinding', 'zIndex',
]);

export function recordsInRenderOrder(records: readonly ShapeRecord[]): ShapeRecord[] {
  const childrenByParent = new Map<string, ShapeRecord[]>();
  records.forEach((record) => {
    const children = childrenByParent.get(record.parentId);
    if (children) children.push(record);
    else childrenByParent.set(record.parentId, [record]);
  });
  childrenByParent.forEach((children) => children.sort((left, right) => compareFractionalIndex(left.index, right.index)));

  const ordered: ShapeRecord[] = [];
  const visit = (parentId: string) => {
    for (const record of childrenByParent.get(parentId) ?? []) {
      ordered.push(record);
      visit(record.id);
    }
  };
  visit(ROOT_PARENT_ID);
  if (ordered.length !== records.length) {
    throw new CanvasValidationError('Canvas hierarchy contains unreachable records', 'HIERARCHY_CYCLE');
  }
  return ordered;
}

function cloneProps(shape: Shape): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(shape)) {
    if (!RECORD_FIELDS.has(key) && value !== undefined) props[key] = structuredClone(value);
  }
  return props;
}

export function toBinding(binding: ShapeBinding | undefined): BindingRecord['start'] {
  if (!binding) return null;
  return {
    shapeId: binding.elementId,
    ...(binding.portId === undefined ? {} : { portId: binding.portId }),
    ...(binding.offsetX === undefined ? {} : { offsetX: binding.offsetX }),
    ...(binding.offsetY === undefined ? {} : { offsetY: binding.offsetY }),
    ...(binding.normalX === undefined ? {} : { normalX: binding.normalX }),
    ...(binding.normalY === undefined ? {} : { normalY: binding.normalY }),
  };
}

function fromBinding(binding: BindingRecord['start']): ShapeBinding | undefined {
  if (!binding) return undefined;
  return {
    elementId: binding.shapeId,
    ...(binding.portId === undefined ? {} : { portId: binding.portId }),
    ...(binding.offsetX === undefined ? {} : { offsetX: binding.offsetX }),
    ...(binding.offsetY === undefined ? {} : { offsetY: binding.offsetY }),
    ...(binding.normalX === undefined ? {} : { normalX: binding.normalX }),
    ...(binding.normalY === undefined ? {} : { normalY: binding.normalY }),
  };
}

export function recordToShape(
  record: ShapeRecord,
  zIndex: number,
  binding: BindingRecord | undefined,
  registry: ShapeRegistry,
  worldTransform: Transform2D,
): Shape {
  const validated = registry.validate(record);
  const props = structuredClone(validated.props) as Record<string, unknown>;
  return Object.freeze({
    id: record.id,
    type: record.type as ShapeType,
    ...(record.parentId === ROOT_PARENT_ID ? {} : { parentId: record.parentId }),
    x: worldTransform.x,
    y: worldTransform.y,
    ...(worldTransform.rotation === 0 ? {} : { rotation: worldTransform.rotation }),
    ...props,
    opacity: record.opacity,
    locked: record.locked,
    zIndex,
    ...(binding?.start ? { startBinding: fromBinding(binding.start) } : {}),
    ...(binding?.end ? { endBinding: fromBinding(binding.end) } : {}),
  }) as Shape;
}

export function shapesToSnapshot(
  documentId: string,
  shapes: readonly Shape[],
  registry: ShapeRegistry,
  state: Pick<CanvasState, 'canvasBackground' | 'showGrid' | 'gridSize'>,
): CanvasSnapshotV2 {
  const previousIndexByParent = new Map<string, string>();
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]));
  const records: ShapeRecord[] = [];
  const bindings: BindingRecord[] = [];

  shapes.forEach((shape) => {
    const parentId = shape.parentId ?? ROOT_PARENT_ID;
    const index = generateKeyBetween(previousIndexByParent.get(parentId) ?? null, null);
    previousIndexByParent.set(parentId, index);
    const parent = parentId === ROOT_PARENT_ID ? undefined : shapeById.get(parentId);
    if (parentId !== ROOT_PARENT_ID && !parent) {
      throw new CanvasValidationError(`Parent '${parentId}' does not exist`, 'PARENT_NOT_FOUND');
    }
    const record = shapeToRecord(shape, index, registry, parent && {
      x: parent.x,
      y: parent.y,
      rotation: parent.rotation ?? 0,
    });
    records.push(record);
    if (shape.startBinding || shape.endBinding) {
      bindings.push(shapeToBindingRecord(shape));
    }
  });

  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    document: {
      id: 'document',
      title: documentId,
      background: state.canvasBackground ?? '#f8fafc',
      grid: { enabled: state.showGrid ?? false, size: state.gridSize ?? 20 },
      presentation: { frameIds: [] },
    },
    records,
    bindings: bindings.sort((a, b) => a.id.localeCompare(b.id)),
    assets: [],
  };
}

export function shapeToRecord(
  shape: Shape,
  index: string,
  registry: ShapeRegistry,
  parentWorld?: Transform2D,
): ShapeRecord {
  const parentId = shape.parentId ?? ROOT_PARENT_ID;
  if (parentId !== ROOT_PARENT_ID && !parentWorld) {
    throw new CanvasValidationError(`Parent transform for '${parentId}' is required`, 'PARENT_NOT_FOUND');
  }
  const world = { x: shape.x, y: shape.y, rotation: shape.rotation ?? 0 };
  const local = parentWorld ? toLocalTransform(parentWorld, world) : world;
  return registry.validate({
    id: shape.id,
    type: shape.type,
    typeVersion: registry.get(shape.type).version,
    parentId,
    index,
    ...local,
    opacity: shape.opacity ?? 1,
    locked: shape.locked ?? false,
    hidden: false,
    props: cloneProps(shape),
  });
}

export function shapeToBindingRecord(shape: Shape): BindingRecord {
  return {
    id: `${shape.id}:binding`,
    connectorId: shape.id,
    start: toBinding(shape.startBinding),
    end: toBinding(shape.endBinding),
  };
}

export function snapshotToShapes(snapshot: CanvasSnapshotV2, registry: ShapeRegistry): readonly Shape[] {
  const bindingByConnector = new Map(snapshot.bindings.map((binding) => [binding.connectorId, binding]));
  const records = new Map(snapshot.records.map((record) => [record.id, record]));
  return recordsInRenderOrder(snapshot.records)
    .filter((record) => !record.hidden)
    .map((record, zIndex) => recordToShape(
      record,
      zIndex,
      bindingByConnector.get(record.id),
      registry,
      getWorldTransform(record.id, records),
    ));
}

export function shapePatchToRecordPatch(
  shape: Shape,
  current: ShapeRecord,
  records: ReadonlyMap<string, ShapeRecord>,
): Omit<ShapeRecord, 'id' | 'type' | 'typeVersion' | 'index'> {
  const currentWorld = getWorldTransform(current.id, records);
  const world = {
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation ?? currentWorld.rotation,
  };
  const parentWorld = current.parentId === ROOT_PARENT_ID
    ? { x: 0, y: 0, rotation: 0 }
    : getWorldTransform(current.parentId, records);
  const local = toLocalTransform(parentWorld, world);
  return {
    parentId: current.parentId,
    ...local,
    opacity: shape.opacity ?? 1,
    locked: shape.locked ?? false,
    hidden: current.hidden,
    props: cloneProps(shape),
  };
}

export function commandsForShapeReplacement(
  current: CanvasSnapshotV2,
  shapes: readonly Shape[],
  registry: ShapeRegistry,
): CanvasCommand[] {
  const target = shapesToSnapshot(current.document.title, shapes, registry, {
    canvasBackground: current.document.background,
    showGrid: current.document.grid.enabled,
    gridSize: current.document.grid.size,
  });
  const currentRecords = new Map(current.records.map((record) => [record.id, record]));
  const targetRecords = new Map(target.records.map((record) => [record.id, record]));
  const commands: CanvasCommand[] = [];
  const deleted = current.records.filter(({ id }) => !targetRecords.has(id)).map(({ id }) => id);
  if (deleted.length > 0) commands.push({ type: 'shape.delete', ids: deleted, mode: 'only' });
  for (const record of target.records) {
    const existing = currentRecords.get(record.id);
    if (!existing) commands.push({ type: 'shape.create', record });
    else if (existing.type !== record.type || existing.typeVersion !== record.typeVersion) {
      commands.push({ type: 'shape.delete', ids: [record.id], mode: 'only' });
      commands.push({ type: 'shape.create', record });
    } else if (JSON.stringify(existing) !== JSON.stringify(record)) {
      commands.push({
        type: 'shape.update',
        id: record.id,
        patch: {
          parentId: record.parentId,
          index: record.index,
          x: record.x,
          y: record.y,
          rotation: record.rotation,
          opacity: record.opacity,
          locked: record.locked,
          hidden: record.hidden,
          props: record.props,
        },
      });
    }
  }
  const currentBindings = new Map(current.bindings.map((binding) => [binding.id, binding]));
  const targetBindings = new Map(target.bindings.map((binding) => [binding.id, binding]));
  const removedBindings = current.bindings.filter(({ id }) => !targetBindings.has(id)).map(({ id }) => id);
  if (removedBindings.length > 0) commands.push({ type: 'binding.delete', ids: removedBindings });
  for (const binding of target.bindings) {
    if (JSON.stringify(currentBindings.get(binding.id)) !== JSON.stringify(binding)) commands.push({ type: 'binding.set', binding });
  }
  return commands;
}
