import { generateKeyBetween } from 'fractional-indexing';
import type { CanvasCommand } from './commands.js';
import {
  CANVAS_LIMITS,
  CanvasValidationError,
  ROOT_PARENT_ID,
  assetRecordSchema,
  bindingRecordSchema,
  canvasDocumentSchema,
  canvasPointSchema,
  compareFractionalIndex,
  type AssetRecord,
  type BindingRecord,
  type CanvasDocumentRecord,
  type CanvasSnapshotV2,
  type ShapeRecord,
} from './model.js';
import { plainText, richTextDocumentSchema } from './richText.js';
import type { ShapeRegistry } from './registry.js';
import { assertCanReparent, getWorldTransform, toLocalTransform } from './transforms.js';

type SnapshotValidator = (snapshot: CanvasSnapshotV2) => CanvasSnapshotV2;

/**
 * Validates a command batch against an isolated, in-memory document draft.
 * Yjs transactions cannot roll back after an exception, so every operation is
 * proven valid here before the real transaction starts. The draft deliberately
 * contains no Y.Doc and does not duplicate the complete CRDT graph.
 */
export class CommandPreflight {
  readonly #registry: ShapeRegistry;
  readonly #validateSnapshot: SnapshotValidator;
  #document: CanvasDocumentRecord;
  #records: Map<string, ShapeRecord>;
  #bindings: Map<string, BindingRecord>;
  #assets: Map<string, AssetRecord>;

  constructor(snapshot: CanvasSnapshotV2, registry: ShapeRegistry, validateSnapshot: SnapshotValidator) {
    this.#registry = registry;
    this.#validateSnapshot = validateSnapshot;
    this.#document = snapshot.document;
    this.#records = new Map(snapshot.records.map((record) => [record.id, record]));
    this.#bindings = new Map(snapshot.bindings.map((binding) => [binding.id, binding]));
    this.#assets = new Map(snapshot.assets.map((asset) => [asset.id, asset]));
  }

  validate(command: Extract<CanvasCommand, { type: 'batch' }>): void {
    if (command.commands.length > 150_000) {
      throw new CanvasValidationError('Command batch exceeds 150,000 operations', 'PAYLOAD_TOO_LARGE');
    }
    for (const nested of command.commands) {
      if (nested.type === 'batch') throw new CanvasValidationError('Nested command batches are not allowed');
      this.#apply(nested);
    }
  }

  #apply(command: Exclude<CanvasCommand, { type: 'batch' }>): void {
    switch (command.type) {
      case 'shape.create': {
        if (this.#records.size >= CANVAS_LIMITS.records) throw new CanvasValidationError('Canvas shape limit reached');
        if (this.#records.has(command.record.id)) throw new CanvasValidationError(`Shape '${command.record.id}' already exists`);
        this.#validateParent(command.record.parentId);
        const record = this.#registry.validate(command.record);
        this.#validateRecordAsset(record);
        this.#records.set(record.id, record);
        if (record.type === 'frame' && !this.#document.presentation.frameIds.includes(record.id)) {
          this.#document = { ...this.#document, presentation: { frameIds: [...this.#document.presentation.frameIds, record.id] } };
        }
        return;
      }
      case 'shape.update': {
        const current = this.#requireRecord(command.id);
        const patchKeys = Object.keys(command.patch);
        if (current.locked && !patchKeys.every((key) => key === 'locked' || key === 'hidden')) {
          throw new CanvasValidationError(`Shape '${command.id}' is locked`, 'SHAPE_LOCKED');
        }
        const next = this.#registry.validate({
          ...current,
          ...structuredClone(command.patch),
          id: current.id,
          type: current.type,
          typeVersion: current.typeVersion,
        });
        if (next.parentId !== current.parentId) throw new CanvasValidationError('Use shape.reparent to change parentId');
        this.#validateRecordAsset(next);
        this.#records.set(next.id, next);
        return;
      }
      case 'shape.points.append': {
        const record = this.#requireRecord(command.id);
        if (record.type !== 'freehand') throw new CanvasValidationError(`Shape '${record.id}' does not support point appends`, 'INVALID_POINT_APPEND');
        if (record.locked) throw new CanvasValidationError(`Shape '${record.id}' is locked`, 'SHAPE_LOCKED');
        const props = record.props as Record<string, unknown>;
        const current = Array.isArray(props.points) ? props.points : [];
        const points = command.points.map((point) => canvasPointSchema.parse(point));
        if (current.length + points.length > 100_000) throw new CanvasValidationError('Shape point limit reached', 'PAYLOAD_TOO_LARGE');
        const next = this.#registry.validate({ ...record, props: { ...props, points: [...current, ...points] } });
        this.#records.set(next.id, next);
        return;
      }
      case 'shape.delete':
        if (command.ids.length > CANVAS_LIMITS.records) throw new CanvasValidationError('Shape delete exceeds the record limit', 'PAYLOAD_TOO_LARGE');
        this.#deleteShapes(command.ids, command.mode);
        return;
      case 'shape.reparent':
        if (command.ids.length > CANVAS_LIMITS.records) throw new CanvasValidationError('Shape reparent exceeds the record limit', 'PAYLOAD_TOO_LARGE');
        this.#reparent(command.ids, command.parentId, command.beforeId);
        return;
      case 'shape.reorder': {
        const record = this.#requireRecord(command.id);
        if (record.locked) throw new CanvasValidationError(`Shape '${record.id}' is locked`, 'SHAPE_LOCKED');
        this.#records.set(record.id, { ...record, index: this.#indexBefore(record.parentId, command.beforeId, command.id) });
        return;
      }
      case 'text.replace': {
        const record = this.#requireRecord(command.shapeId);
        if (record.locked) throw new CanvasValidationError(`Shape '${record.id}' is locked`, 'SHAPE_LOCKED');
        const props = record.props as Record<string, unknown>;
        const field = 'text' in props ? 'text' : 'label' in props ? 'label' : null;
        if (!field) throw new CanvasValidationError(`Shape '${record.id}' has no rich text field`, 'TEXT_FIELD_NOT_FOUND');
        const document = richTextDocumentSchema.parse(command.document);
        const next = this.#registry.validate({ ...record, props: { ...props, [field]: plainText(document) } });
        this.#records.set(next.id, next);
        return;
      }
      case 'table.cell.set': {
        const record = this.#requireRecord(command.shapeId);
        if (record.type !== 'table') throw new CanvasValidationError(`Shape '${record.id}' is not a table`, 'INVALID_TABLE');
        if (record.locked) throw new CanvasValidationError(`Shape '${record.id}' is locked`, 'SHAPE_LOCKED');
        if (command.text.length > 20_000) throw new CanvasValidationError('Table cell text exceeds 20,000 characters', 'PAYLOAD_TOO_LARGE');
        const props = record.props as { columns: { id: string }[]; rows: { id: string; cells: Record<string, string> }[] };
        if (!props.columns.some(({ id }) => id === command.columnId) || !props.rows.some(({ id }) => id === command.rowId)) {
          throw new CanvasValidationError('Table cell does not exist', 'TABLE_CELL_NOT_FOUND');
        }
        const rows = props.rows.map((row) => row.id === command.rowId
          ? { ...row, cells: { ...row.cells, [command.columnId]: command.text } }
          : row);
        const next = this.#registry.validate({ ...record, props: { ...props, rows } });
        this.#records.set(next.id, next);
        return;
      }
      case 'document.update': {
        if ('presentation' in command.patch) throw new CanvasValidationError('Use presentation.reorder to change frame order', 'INVALID_PRESENTATION');
        const document = canvasDocumentSchema.parse({ ...this.#document, ...structuredClone(command.patch), id: 'document' });
        this.#validateDocumentReferences(document);
        this.#document = document;
        return;
      }
      case 'presentation.reorder': {
        const frame = this.#requireRecord(command.frameId);
        if (frame.type !== 'frame') throw new CanvasValidationError(`Shape '${frame.id}' is not a frame`, 'INVALID_PRESENTATION');
        const current = this.#document.presentation.frameIds;
        if (!current.includes(frame.id)) throw new CanvasValidationError(`Presentation frame '${frame.id}' does not exist`, 'INVALID_PRESENTATION');
        if (command.beforeId === frame.id) return;
        const frameIds = current.filter((id) => id !== frame.id);
        const position = command.beforeId === undefined ? frameIds.length : frameIds.indexOf(command.beforeId);
        if (position < 0) throw new CanvasValidationError(`Presentation beforeId '${command.beforeId}' does not exist`, 'INVALID_PRESENTATION');
        frameIds.splice(position, 0, frame.id);
        this.#document = { ...this.#document, presentation: { frameIds } };
        return;
      }
      case 'binding.set': {
        if (!this.#bindings.has(command.binding.id) && this.#bindings.size >= CANVAS_LIMITS.bindings) {
          throw new CanvasValidationError('Canvas binding limit reached', 'PAYLOAD_TOO_LARGE');
        }
        const binding = bindingRecordSchema.parse(command.binding);
        const connector = this.#requireRecord(binding.connectorId);
        if (connector.type !== 'line' && connector.type !== 'arrow') {
          throw new CanvasValidationError(`Binding '${binding.id}' connector is not a line or arrow`, 'INVALID_BINDING');
        }
        this.#validateBindingEndpoint(binding, binding.start, 'start');
        this.#validateBindingEndpoint(binding, binding.end, 'end');
        this.#bindings.set(binding.id, binding);
        return;
      }
      case 'binding.delete':
        command.ids.forEach((id) => this.#bindings.delete(id));
        return;
      case 'asset.set': {
        if (!this.#assets.has(command.asset.id) && this.#assets.size >= CANVAS_LIMITS.assets) {
          throw new CanvasValidationError('Canvas asset limit reached', 'PAYLOAD_TOO_LARGE');
        }
        this.#assets.set(command.asset.id, assetRecordSchema.parse(command.asset));
        return;
      }
      case 'asset.delete': {
        const used = new Set<string>();
        this.#records.forEach((record) => {
          const props = record.props as Record<string, unknown>;
          for (const key of ['assetId', 'imageAssetId', 'faviconAssetId']) {
            const value = props[key];
            if (typeof value === 'string') used.add(value);
          }
        });
        command.ids.forEach((id) => {
          const asset = this.#assets.get(id);
          if (used.has(id) || (asset && used.has(asset.assetId))) {
            throw new CanvasValidationError(`Asset '${id}' is still in use`, 'ASSET_IN_USE');
          }
        });
        command.ids.forEach((id) => this.#assets.delete(id));
        return;
      }
      case 'document.replace': {
        const snapshot = this.#validateSnapshot(command.snapshot);
        this.#document = snapshot.document;
        this.#records = new Map(snapshot.records.map((record) => [record.id, record]));
        this.#bindings = new Map(snapshot.bindings.map((binding) => [binding.id, binding]));
        this.#assets = new Map(snapshot.assets.map((asset) => [asset.id, asset]));
      }
    }
  }

  #deleteShapes(ids: readonly string[], mode: 'only' | 'cascade'): void {
    const deleting = new Set(ids);
    ids.forEach((id) => {
      const record = this.#requireRecord(id);
      if (record.locked) throw new CanvasValidationError(`Shape '${id}' is locked`, 'SHAPE_LOCKED');
    });
    if (mode === 'cascade') {
      let added = true;
      while (added) {
        added = false;
        for (const record of this.#records.values()) {
          if (deleting.has(record.parentId) && !deleting.has(record.id)) {
            deleting.add(record.id);
            added = true;
          }
        }
      }
    } else {
      for (const record of this.#records.values()) {
        if (!deleting.has(record.parentId) || deleting.has(record.id)) continue;
        const world = getWorldTransform(record.id, this.#records);
        const deletedParent = this.#records.get(record.parentId);
        const nextParentId = deletedParent?.parentId ?? ROOT_PARENT_ID;
        const parentWorld = nextParentId === ROOT_PARENT_ID
          ? { x: 0, y: 0, rotation: 0 }
          : getWorldTransform(nextParentId, this.#records);
        const next = this.#registry.validate({ ...record, parentId: nextParentId, ...toLocalTransform(parentWorld, world) });
        this.#records.set(next.id, next);
      }
    }
    deleting.forEach((id) => this.#records.delete(id));
    this.#document = {
      ...this.#document,
      presentation: { frameIds: this.#document.presentation.frameIds.filter((id) => !deleting.has(id)) },
    };
    for (const [id, binding] of this.#bindings) {
      if (deleting.has(binding.connectorId)
        || (binding.start && deleting.has(binding.start.shapeId))
        || (binding.end && deleting.has(binding.end.shapeId))) this.#bindings.delete(id);
    }
  }

  #reparent(ids: readonly string[], parentId: string, beforeId?: string): void {
    this.#validateParent(parentId);
    assertCanReparent(ids, parentId, this.#records);
    ids.forEach((id) => {
      const record = this.#requireRecord(id);
      if (record.locked) throw new CanvasValidationError(`Shape '${id}' is locked`, 'SHAPE_LOCKED');
    });
    const parentWorld = parentId === ROOT_PARENT_ID ? { x: 0, y: 0, rotation: 0 } : getWorldTransform(parentId, this.#records);
    const before = beforeId ? this.#requireRecord(beforeId) : undefined;
    if (before && before.parentId !== parentId) throw new CanvasValidationError('beforeId must belong to the destination parent');
    const siblings = [...this.#records.values()]
      .filter((record) => record.parentId === parentId && !ids.includes(record.id))
      .sort((left, right) => compareFractionalIndex(left.index, right.index));
    const beforePosition = before ? siblings.findIndex(({ id }) => id === before.id) : siblings.length;
    if (before && beforePosition < 0) throw new CanvasValidationError(`beforeId '${before.id}' does not exist`);
    let previousIndex = beforePosition > 0 ? siblings[beforePosition - 1]?.index ?? null : null;
    const nextIndex = before?.index ?? null;
    for (const id of ids) {
      const record = this.#requireRecord(id);
      const world = getWorldTransform(id, this.#records);
      const index = generateKeyBetween(previousIndex, nextIndex);
      const next = this.#registry.validate({ ...record, parentId, index, ...toLocalTransform(parentWorld, world) });
      this.#records.set(id, next);
      previousIndex = index;
    }
  }

  #validateBindingEndpoint(binding: BindingRecord, endpoint: BindingRecord['start'], name: 'start' | 'end'): void {
    if (!endpoint) return;
    if (endpoint.shapeId === binding.connectorId) {
      throw new CanvasValidationError(`Binding '${binding.id}' cannot bind ${name} to its connector`, 'INVALID_BINDING');
    }
    const target = this.#requireRecord(endpoint.shapeId);
    if (!endpoint.portId) return;
    const ports = this.#registry.get(target.type).geometry.getConnectionPorts?.(target) ?? [];
    if (!ports.some(({ id }) => id === endpoint.portId)) {
      throw new CanvasValidationError(`Port '${endpoint.portId}' does not exist on shape '${target.id}'`, 'UNKNOWN_CONNECTION_PORT');
    }
  }

  #validateRecordAsset(record: ShapeRecord): void {
    if (record.type !== 'image') return;
    const props = record.props as { assetId?: unknown; imageSrc?: unknown };
    if (typeof props.assetId === 'string') {
      const asset = this.#assets.get(props.assetId) ?? [...this.#assets.values()].find((candidate) => candidate.assetId === props.assetId);
      if (!asset) throw new CanvasValidationError(`Image '${record.id}' references missing asset '${props.assetId}'`, 'ASSET_NOT_FOUND');
      return;
    }
    if (typeof props.imageSrc !== 'string' || !/^data:image\/(?:png|jpeg|webp|gif);base64,/iu.test(props.imageSrc)) {
      throw new CanvasValidationError(`Image '${record.id}' has no valid image source`, 'ASSET_NOT_FOUND');
    }
  }

  #validateDocumentReferences(document: CanvasDocumentRecord): void {
    const ids = new Set<string>();
    document.presentation.frameIds.forEach((id) => {
      if (ids.has(id)) throw new CanvasValidationError(`Presentation frame '${id}' is duplicated`, 'INVALID_PRESENTATION');
      ids.add(id);
      if (this.#records.get(id)?.type !== 'frame') throw new CanvasValidationError(`Presentation frame '${id}' does not exist`, 'INVALID_PRESENTATION');
    });
  }

  #validateParent(parentId: string): void {
    if (parentId !== ROOT_PARENT_ID && !this.#records.has(parentId)) {
      throw new CanvasValidationError(`Parent '${parentId}' does not exist`, 'PARENT_NOT_FOUND');
    }
    const parent = this.#records.get(parentId);
    if (parent && parent.type !== 'frame' && parent.type !== 'group') {
      throw new CanvasValidationError(`Shape '${parentId}' cannot contain child shapes`, 'INVALID_PARENT_TYPE');
    }
  }

  #indexBefore(parentId: string, beforeId?: string, excludingId?: string): string {
    const siblings = [...this.#records.values()]
      .filter((record) => record.parentId === parentId && record.id !== excludingId)
      .sort((left, right) => compareFractionalIndex(left.index, right.index));
    if (!beforeId) return generateKeyBetween(siblings.at(-1)?.index ?? null, null);
    const position = siblings.findIndex(({ id }) => id === beforeId);
    if (position < 0) throw new CanvasValidationError(`beforeId '${beforeId}' is not a sibling`);
    return generateKeyBetween(siblings[position - 1]?.index ?? null, siblings[position]?.index ?? null);
  }

  #requireRecord(id: string): ShapeRecord {
    const record = this.#records.get(id);
    if (!record) throw new CanvasValidationError(`Shape '${id}' does not exist`, 'SHAPE_NOT_FOUND');
    return record;
  }
}
