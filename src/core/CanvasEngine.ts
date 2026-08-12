import { generateKeyBetween } from 'fractional-indexing';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import type { CanvasCommand, CommandResult } from './commands.js';
import {
  CANVAS_LIMITS,
  assertJsonSize,
  compareFractionalIndex,
  CanvasReadonlyError,
  CanvasValidationError,
  EMPTY_CANVAS_SNAPSHOT,
  ROOT_PARENT_ID,
  assetRecordSchema,
  bindingRecordSchema,
  canvasDocumentSchema,
  canvasPointSchema,
  canvasSnapshotSchema,
  type AssetRecord,
  type BindingRecord,
  type CanvasDocumentRecord,
  type CanvasSnapshotV2,
  type CanvasViewport,
  type ShapeRecord,
} from './model.js';
import { ShapeRegistry } from './registry.js';
import { assertCanReparent, getWorldTransform, toLocalTransform } from './transforms.js';
import { plainText, readRichText, richTextDocumentSchema, richTextFromString, writeRichText } from './richText.js';
import { CommandPreflight } from './CommandPreflight.js';
import { validateLaserTrail, type LaserPoint } from './laser.js';

const LOCAL_COMMAND_ORIGIN = Symbol('tahta.local-command');
const SYSTEM_ORIGIN = Symbol('tahta.system');
const REMOTE_ORIGIN = Symbol('tahta.remote');
const REMOTE_AWARENESS_ORIGIN = Symbol('tahta.remote-awareness');

type ViewTheme = 'light' | 'dark';

export interface CanvasViewState {
  snapshot: CanvasSnapshotV2;
  selectedIds: readonly string[];
  activeTool: string;
  viewport: CanvasViewport;
  theme: ViewTheme;
  readonly: boolean;
  changedRecordIds: readonly string[];
  collaborators: ReadonlyMap<string, CanvasCollaborator>;
  assetHrefs: ReadonlyMap<string, string>;
  followingId: string | null;
  hoveredShapeId: string | null;
  hoveredPortShapeId: string | null;
  hoveredPortId: string | null;
  drawingShapeId: string | null;
  isDraggingSelection: boolean;
  resizingShapeId: string | null;
  laserTrail: readonly LaserPoint[];
  isPanning: boolean;
  isSpacePanning: boolean;
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  erasingPath: readonly { x: number; y: number; pressure?: number }[] | null;
  erasingShapeIds: readonly string[];
  editingShapeId: string | null;
  snapLines: readonly { x1: number; y1: number; x2: number; y2: number }[];
}

export interface CanvasCollaborator {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
  button?: string;
  zoom?: number;
  presentationFrameId?: string | null;
  pointerTool?: 'pointer' | 'laser';
  laserTrail?: readonly LaserPoint[];
}

export interface CanvasEngineConfig {
  documentId: string;
  registry: ShapeRegistry;
  readonly?: boolean;
  initialSnapshot?: CanvasSnapshotV2;
  initialUpdate?: Uint8Array;
  document?: Y.Doc;
}

export interface CanvasEngine {
  readonly documentId: string;
  readonly registry: ShapeRegistry;
  readonly awareness: Awareness;
  dispatch(command: CanvasCommand, options?: { undoGroup?: string }): CommandResult;
  completeUndoGroup(undoGroup: string): void;
  getSnapshot(): CanvasSnapshotV2;
  getViewState(): CanvasViewState;
  subscribe<T>(selector: (state: CanvasViewState) => T, listener: (value: T) => void): () => void;
  setViewState(patch: Partial<Omit<CanvasViewState, 'snapshot' | 'readonly' | 'changedRecordIds'>>): void;
  setReadonly(readonly: boolean): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  encodeState(): Uint8Array;
  encodeStateVector(): Uint8Array;
  encodeDiff(stateVector: Uint8Array): Uint8Array;
  applyRemoteUpdate(update: Uint8Array): void;
  onDocumentUpdate(listener: (update: Uint8Array) => void): () => void;
  onAwarenessUpdate(listener: (update: Uint8Array) => void): () => void;
  encodeLocalAwareness(): Uint8Array;
  setLocalAwarenessUser(user: { peerId: string; name: string; color: string }): void;
  applyRemoteAwarenessUpdate(update: Uint8Array, transportIdentity: string): void;
  removeRemoteAwareness(transportIdentity: string): void;
  enableIndexedDbPersistence(databaseName?: string): Promise<() => Promise<void>>;
  getRichTextFragment(shapeId: string, field?: 'text' | 'label'): Y.XmlFragment;
  destroy(): void;
}

interface Subscription<T> {
  selector: (state: CanvasViewState) => T;
  listener: (value: T) => void;
  value: T;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export class YjsCanvasEngine implements CanvasEngine {
  readonly documentId: string;
  readonly registry: ShapeRegistry;
  readonly awareness: Awareness;
  readonly #doc: Y.Doc;
  readonly #records: Y.Map<Y.Map<unknown>>;
  readonly #bindings: Y.Map<Y.Map<unknown>>;
  readonly #assets: Y.Map<AssetRecord>;
  readonly #document: Y.Map<unknown>;
  readonly #richText: Y.Map<Y.XmlFragment>;
  readonly #tableCells: Y.Map<Y.Text>;
  readonly #undoManager: Y.UndoManager;
  readonly #subscriptions = new Set<Subscription<unknown>>();
  readonly #updateListeners = new Set<(update: Uint8Array) => void>();
  readonly #persistenceDisposers = new Set<() => Promise<void>>();
  readonly #collaborativeRecordIds = new WeakMap<object, string>();
  readonly #collaborativeBindingIds = new WeakMap<object, string>();
  readonly #documentTypes = new WeakSet<object>();
  readonly #awarenessOwners = new Map<number, string>();
  #destroyed = false;
  #activeUndoGroup: string | null = null;
  #snapshotCache: CanvasSnapshotV2 | null = null;
  #snapshotRecords = new Map<string, ShapeRecord>();
  #snapshotPositions = new Map<string, number>();
  #viewState: Omit<CanvasViewState, 'snapshot'>;

  constructor(config: CanvasEngineConfig) {
    if (!config.documentId.trim()) throw new CanvasValidationError('documentId is required');
    this.documentId = config.documentId;
    this.registry = config.registry;
    if (config.initialSnapshot && config.initialUpdate) throw new CanvasValidationError('Use either initialSnapshot or initialUpdate');
    if (config.document && config.initialUpdate) throw new CanvasValidationError('initialUpdate cannot be combined with document');
    this.#doc = config.document ?? new Y.Doc();
    this.awareness = new Awareness(this.#doc);
    if (config.initialUpdate) {
      try {
        Y.applyUpdate(this.#doc, config.initialUpdate, SYSTEM_ORIGIN);
      } catch {
        this.awareness.destroy();
        this.#doc.destroy();
        throw new CanvasValidationError('initialUpdate could not be decoded', 'INVALID_CANVAS_DATA');
      }
    }
    this.#records = this.#doc.getMap<Y.Map<unknown>>('records');
    this.#bindings = this.#doc.getMap<Y.Map<unknown>>('bindings');
    this.#assets = this.#doc.getMap<AssetRecord>('assets');
    this.#document = this.#doc.getMap<unknown>('document');
    this.#richText = this.#doc.getMap<Y.XmlFragment>('richText');
    this.#tableCells = this.#doc.getMap<Y.Text>('tableCells');
    this.#trackDocumentTypes(this.#document);
    this.#records.forEach((stored, key) => { if (!(stored instanceof Y.Map)) throw new CanvasValidationError(`Shape '${key}' is not stored as a collaborative record`, 'INVALID_CANVAS_DATA'); this.#collaborativeRecordIds.set(stored, key); const props = stored.get('props'); if (props instanceof Y.Map) this.#collaborativeRecordIds.set(props, key); });
    this.#bindings.forEach((stored, key) => { if (!(stored instanceof Y.Map)) throw new CanvasValidationError(`Binding '${key}' is not stored as a collaborative record`, 'INVALID_CANVAS_DATA'); this.#collaborativeBindingIds.set(stored, key); });
    this.#richText.forEach((fragment, key) => this.#collaborativeRecordIds.set(fragment, key.split(':')[0]!));
    this.#tableCells.forEach((text, key) => this.#collaborativeRecordIds.set(text, key.split(':')[0]!));
    if (config.initialUpdate && this.#document.size === 0) {
      this.awareness.destroy();
      this.#doc.destroy();
      throw new CanvasValidationError('initialUpdate is missing the canvas document record');
    }
    this.#viewState = {
      selectedIds: [],
      activeTool: 'select',
      viewport: { x: 0, y: 0, zoom: 1 },
      theme: 'light',
      readonly: config.readonly ?? false,
      collaborators: new Map(),
      assetHrefs: new Map(),
      followingId: null,
      hoveredShapeId: null,
      hoveredPortShapeId: null,
      hoveredPortId: null,
      drawingShapeId: null,
      isDraggingSelection: false,
      resizingShapeId: null,
      laserTrail: [],
      isPanning: false,
      isSpacePanning: false,
      selectionBox: null,
      erasingPath: null,
      erasingShapeIds: [],
      editingShapeId: null,
      snapLines: [],
      changedRecordIds: [],
    };

    this.#undoManager = new Y.UndoManager(
      [this.#records, this.#bindings, this.#assets, this.#document, this.#richText, this.#tableCells],
      { trackedOrigins: new Set([LOCAL_COMMAND_ORIGIN]), captureTimeout: 2_147_483_647 },
    );

    const hasPartialStoredState = this.#records.size > 0
      || this.#bindings.size > 0
      || this.#assets.size > 0
      || this.#richText.size > 0
      || this.#tableCells.size > 0;
    if (this.#document.size === 0 && hasPartialStoredState) {
      this.#undoManager.destroy();
      this.awareness.destroy();
      this.#doc.destroy();
      throw new CanvasValidationError('Stored canvas state is missing the document record', 'INVALID_CANVAS_DATA');
    }
    if (this.#document.size === 0) {
      this.#replaceSnapshot(config.initialSnapshot ?? EMPTY_CANVAS_SNAPSHOT, SYSTEM_ORIGIN);
    } else if (config.initialSnapshot) {
      throw new CanvasValidationError('Cannot provide initialSnapshot with a non-empty Y.Doc');
    }

    try { this.getSnapshot(); } catch (error) { this.#undoManager.destroy(); this.awareness.destroy(); this.#doc.destroy(); throw error; }

    this.#doc.on('update', this.#handleUpdate);
  }

  dispatch(command: CanvasCommand, options: { undoGroup?: string } = {}): CommandResult {
    this.#assertAlive();
    if (this.#viewState.readonly) throw new CanvasReadonlyError();
    if (command.type === 'batch') this.#preflightBatch(command);
    return this.#dispatchValidated(command, options);
  }

  #dispatchValidated(command: CanvasCommand, options: { undoGroup?: string }): CommandResult {

    const undoGroup = options.undoGroup ?? null;
    if (this.#activeUndoGroup !== undoGroup) this.#undoManager.stopCapturing();
    this.#activeUndoGroup = undoGroup;
    const transactionId = crypto.randomUUID();
    const changed = new Set<string>();
    this.#doc.transact(() => this.#execute(command, changed), LOCAL_COMMAND_ORIGIN);
    if (!undoGroup) {
      this.#undoManager.stopCapturing();
      this.#activeUndoGroup = null;
    }
    return { transactionId, changedRecordIds: [...changed] };
  }

  #preflightBatch(command: Extract<CanvasCommand, { type: 'batch' }>): void {
    new CommandPreflight(
      this.getSnapshot(),
      this.registry,
      (snapshot) => this.#validateSnapshot(snapshot),
    ).validate(command);
  }

  completeUndoGroup(undoGroup: string): void {
    this.#assertAlive();
    if (this.#activeUndoGroup !== undoGroup) return;
    this.#undoManager.stopCapturing();
    this.#activeUndoGroup = null;
  }

  getSnapshot(): CanvasSnapshotV2 {
    this.#assertAlive();
    if (this.#snapshotCache) return this.#snapshotCache;
    const document = this.#readStoredDocument(this.#document);
    const snapshot: CanvasSnapshotV2 = {
      schemaVersion: 2,
      document: cloneValue(document),
      records: [...this.#records.values()].map((record) => this.#hydrateRecord(this.#readStoredRecord(record))).sort((a, b) => compareFractionalIndex(a.index, b.index) || a.id.localeCompare(b.id)),
      bindings: [...this.#bindings.values()].map((stored) => this.#readStoredBinding(stored)).sort((a, b) => a.id.localeCompare(b.id)),
      assets: [...this.#assets.values()].map(cloneValue).sort((a, b) => a.id.localeCompare(b.id)),
    };
    this.#snapshotCache = this.#validateSnapshot(snapshot);
    this.#snapshotRecords = new Map(this.#snapshotCache.records.map((record) => [record.id, record]));
    this.#snapshotPositions = new Map(this.#snapshotCache.records.map((record, index) => [record.id, index]));
    return this.#snapshotCache;
  }

  getViewState(): CanvasViewState {
    return {
      ...this.#viewState,
      viewport: { ...this.#viewState.viewport },
      collaborators: this.#viewState.collaborators,
      assetHrefs: this.#viewState.assetHrefs,
      snapshot: this.getSnapshot(),
    };
  }

  subscribe<T>(selector: (state: CanvasViewState) => T, listener: (value: T) => void): () => void {
    this.#assertAlive();
    const subscription: Subscription<T> = { selector, listener, value: selector(this.getViewState()) };
    this.#subscriptions.add(subscription as Subscription<unknown>);
    return () => this.#subscriptions.delete(subscription as Subscription<unknown>);
  }

  setViewState(patch: Partial<Omit<CanvasViewState, 'snapshot' | 'readonly' | 'changedRecordIds'>>): void {
    this.#assertAlive();
    const next = {
      ...this.#viewState,
      ...patch,
      viewport: patch.viewport ? { ...patch.viewport } : this.#viewState.viewport,
      selectedIds: patch.selectedIds ? [...patch.selectedIds] : this.#viewState.selectedIds,
      collaborators: patch.collaborators ? new Map(patch.collaborators) : this.#viewState.collaborators,
      assetHrefs: patch.assetHrefs ? new Map(patch.assetHrefs) : this.#viewState.assetHrefs,
      erasingPath: patch.erasingPath ? [...patch.erasingPath] : patch.erasingPath === null ? null : this.#viewState.erasingPath,
      erasingShapeIds: patch.erasingShapeIds ? [...patch.erasingShapeIds] : this.#viewState.erasingShapeIds,
      snapLines: patch.snapLines ? [...patch.snapLines] : this.#viewState.snapLines,
      laserTrail: patch.laserTrail ? [...(validateLaserTrail(patch.laserTrail) ?? [])] : this.#viewState.laserTrail,
      changedRecordIds: [],
    };
    if (next.selectedIds.some((id) => !this.#records.has(id))) {
      throw new CanvasValidationError('Selection contains a shape that does not exist', 'SHAPE_NOT_FOUND');
    }
    if (next.resizingShapeId && !this.#records.has(next.resizingShapeId)) {
      throw new CanvasValidationError('Resize target does not exist', 'SHAPE_NOT_FOUND');
    }
    this.#viewState = next;
    this.#notify();
  }

  setReadonly(readonly: boolean): void {
    this.#assertAlive();
    if (this.#viewState.readonly === readonly) return;
    this.#viewState = { ...this.#viewState, readonly };
    this.#notify();
  }

  undo(): void {
    this.#assertWritable();
    this.#undoManager.undo();
  }

  redo(): void {
    this.#assertWritable();
    this.#undoManager.redo();
  }

  canUndo(): boolean { return this.#undoManager.undoStack.length > 0; }
  canRedo(): boolean { return this.#undoManager.redoStack.length > 0; }
  encodeState(): Uint8Array { return Y.encodeStateAsUpdate(this.#doc); }
  encodeStateVector(): Uint8Array { return Y.encodeStateVector(this.#doc); }
  encodeDiff(stateVector: Uint8Array): Uint8Array { return Y.encodeStateAsUpdate(this.#doc, stateVector); }

  applyRemoteUpdate(update: Uint8Array): void {
    this.#assertAlive();
    if (update.byteLength === 0 || update.byteLength > 2 * 1024 * 1024) {
      throw new CanvasValidationError('Remote canvas update has an invalid size', 'INVALID_REMOTE_UPDATE');
    }
    const candidate = new Y.Doc();
    try {
      Y.applyUpdate(candidate, Y.encodeStateAsUpdate(this.#doc), SYSTEM_ORIGIN);
      Y.applyUpdate(candidate, update, REMOTE_ORIGIN);
      this.#validateDoc(candidate);
    } catch (error) {
      if (error instanceof CanvasValidationError) throw error;
      throw new CanvasValidationError('Remote canvas update could not be decoded', 'INVALID_REMOTE_UPDATE');
    } finally {
      candidate.destroy();
    }
    Y.applyUpdate(this.#doc, update, REMOTE_ORIGIN);
  }

  onDocumentUpdate(listener: (update: Uint8Array) => void): () => void {
    this.#updateListeners.add(listener);
    return () => this.#updateListeners.delete(listener);
  }

  onAwarenessUpdate(listener: (update: Uint8Array) => void): () => void {
    this.#assertAlive();
    const handler = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === REMOTE_AWARENESS_ORIGIN) return;
      const clients = [...added, ...updated, ...removed];
      if (clients.length) listener(encodeAwarenessUpdate(this.awareness, clients));
    };
    this.awareness.on('update', handler);
    return () => this.awareness.off('update', handler);
  }

  encodeLocalAwareness(): Uint8Array {
    this.#assertAlive();
    return encodeAwarenessUpdate(this.awareness, [this.#doc.clientID]);
  }

  setLocalAwarenessUser(user: { peerId: string; name: string; color: string }): void {
    this.#assertAlive();
    if (!user.peerId.trim() || !user.name.trim() || user.peerId.length > 255 || user.name.length > 255 || !/^#[0-9a-f]{6}$/iu.test(user.color)) {
      throw new CanvasValidationError('Awareness user profile is invalid', 'AWARENESS_PROFILE_INVALID');
    }
    this.awareness.setLocalStateField('peerId', user.peerId);
    this.awareness.setLocalStateField('user', { name: user.name, color: user.color });
  }

  applyRemoteAwarenessUpdate(update: Uint8Array, transportIdentity: string): void {
    this.#assertAlive();
    if (!transportIdentity.trim() || update.byteLength === 0 || update.byteLength > 64 * 1024) throw new CanvasValidationError('Remote awareness update is invalid', 'AWARENESS_UPDATE_INVALID');
    const probeDocument = new Y.Doc(); const probe = new Awareness(probeDocument); probe.setLocalState(null);
    let changed: { added: number[]; updated: number[]; removed: number[] } = { added: [], updated: [], removed: [] };
    probe.on('update', (event: typeof changed) => { changed = event; });
    try { applyAwarenessUpdate(probe, update, REMOTE_AWARENESS_ORIGIN); }
    catch { probe.destroy(); probeDocument.destroy(); throw new CanvasValidationError('Remote awareness update could not be decoded', 'AWARENESS_UPDATE_INVALID'); }
    const clients = [...changed.added, ...changed.updated, ...changed.removed];
    for (const clientId of clients) {
      const owner = this.#awarenessOwners.get(clientId);
      if (owner && owner !== transportIdentity) { probe.destroy(); probeDocument.destroy(); throw new CanvasValidationError('Awareness client identity belongs to another participant', 'AWARENESS_IDENTITY_MISMATCH'); }
      if (!changed.removed.includes(clientId)) {
        const state = probe.getStates().get(clientId) as {
          peerId?: unknown;
          user?: unknown;
          pointerTool?: unknown;
          laserTrail?: unknown;
        } | undefined;
        const profile = state?.user as { name?: unknown; color?: unknown } | undefined;
        if (state?.peerId !== transportIdentity || typeof profile?.name !== 'string' || profile.name.length > 255 || typeof profile.color !== 'string' || !/^#[0-9a-f]{6}$/iu.test(profile.color)) {
          probe.destroy(); probeDocument.destroy(); throw new CanvasValidationError('Awareness identity does not match the transport participant', 'AWARENESS_IDENTITY_MISMATCH');
        }
        if (state.pointerTool !== undefined && state.pointerTool !== 'pointer' && state.pointerTool !== 'laser') {
          probe.destroy(); probeDocument.destroy(); throw new CanvasValidationError('Awareness pointer tool is invalid', 'AWARENESS_POINTER_INVALID');
        }
        try {
          validateLaserTrail(state.laserTrail);
        } catch {
          probe.destroy(); probeDocument.destroy(); throw new CanvasValidationError('Awareness laser trail is invalid', 'AWARENESS_LASER_INVALID');
        }
      }
    }
    const verifiedChanges = { added: [...changed.added], updated: [...changed.updated], removed: [...changed.removed] };
    probe.destroy(); probeDocument.destroy();
    applyAwarenessUpdate(this.awareness, update, REMOTE_AWARENESS_ORIGIN);
    verifiedChanges.removed.forEach((clientId) => this.#awarenessOwners.delete(clientId));
    [...verifiedChanges.added, ...verifiedChanges.updated].forEach((clientId) => this.#awarenessOwners.set(clientId, transportIdentity));
    this.#syncCollaboratorsFromAwareness();
  }

  removeRemoteAwareness(transportIdentity: string): void {
    this.#assertAlive();
    const clients = [...this.#awarenessOwners].filter(([, owner]) => owner === transportIdentity).map(([clientId]) => clientId);
    if (clients.length) removeAwarenessStates(this.awareness, clients, REMOTE_AWARENESS_ORIGIN);
    clients.forEach((clientId) => this.#awarenessOwners.delete(clientId));
    this.#syncCollaboratorsFromAwareness();
  }

  async enableIndexedDbPersistence(databaseName = `tahta:${this.documentId}`): Promise<() => Promise<void>> {
    this.#assertAlive();
    const { IndexeddbPersistence } = await import('y-indexeddb');
    const provider = new IndexeddbPersistence(databaseName, this.#doc);
    await provider.whenSynced;
    let disposed = false;
    const dispose = async () => {
      if (disposed) return;
      disposed = true;
      provider.destroy();
      this.#persistenceDisposers.delete(dispose);
    };
    this.#persistenceDisposers.add(dispose);
    return dispose;
  }

  getRichTextFragment(shapeId: string, field: 'text' | 'label' = 'text'): Y.XmlFragment {
    this.#assertAlive(); this.#requireRecord(shapeId);
    const key = `${shapeId}:${field}`; const fragment = this.#richText.get(key);
    if (!fragment) throw new CanvasValidationError(`Shape '${shapeId}' has no collaborative ${field} field`, 'TEXT_FIELD_NOT_FOUND');
    return fragment;
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#doc.off('update', this.#handleUpdate);
    this.#undoManager.destroy();
    for (const dispose of this.#persistenceDisposers) void dispose();
    this.#persistenceDisposers.clear();
    this.#subscriptions.clear();
    this.#updateListeners.clear();
    this.#awarenessOwners.clear();
    this.awareness.destroy();
    this.#doc.destroy();
  }

  readonly #handleUpdate = (update: Uint8Array, origin: unknown, _document: Y.Doc, transaction: Y.Transaction): void => {
    const changedRecordIds = this.#updateSnapshotCache(transaction);
    if (origin !== REMOTE_ORIGIN && origin !== SYSTEM_ORIGIN) {
      for (const listener of this.#updateListeners) listener(update);
    }
    this.#viewState = {
      ...this.#viewState,
      selectedIds: this.#viewState.selectedIds.filter((id) => this.#records.has(id)),
      changedRecordIds: [...changedRecordIds],
    };
    this.#notify();
  };

  #execute(command: CanvasCommand, changed: Set<string>): void {
    switch (command.type) {
      case 'batch': {
        if (command.commands.length > 150_000) throw new CanvasValidationError('Command batch exceeds 150,000 operations', 'PAYLOAD_TOO_LARGE');
        command.commands.forEach((nested) => {
          if (nested.type === 'batch') throw new CanvasValidationError('Nested command batches are not allowed');
          this.#execute(nested, changed);
        });
        return;
      }
      case 'shape.create': {
        if (this.#records.size >= CANVAS_LIMITS.records) throw new CanvasValidationError('Canvas shape limit reached');
        if (this.#records.has(command.record.id)) throw new CanvasValidationError(`Shape '${command.record.id}' already exists`);
        const records = this.#recordMap();
        this.#validateParent(command.record.parentId, records);
        const record = this.registry.validate(command.record);
        this.#validateRecordAsset(record);
        this.#storeRecord(record);
        if (record.type === 'frame') this.#appendPresentationFrame(record.id);
        changed.add(record.id);
        return;
      }
      case 'shape.update': {
        const current = this.#requireRecord(command.id);
        const patchKeys = Object.keys(command.patch);
        if (current.locked && !patchKeys.every((key) => key === 'locked' || key === 'hidden')) throw new CanvasValidationError(`Shape '${command.id}' is locked`, 'SHAPE_LOCKED');
        const next = this.registry.validate({ ...current, ...cloneValue(command.patch), id: current.id, type: current.type, typeVersion: current.typeVersion });
        if (next.parentId !== current.parentId) throw new CanvasValidationError('Use shape.reparent to change parentId');
        this.#validateRecordAsset(next);
        this.#storeRecord(next);
        changed.add(next.id);
        return;
      }
      case 'shape.points.append': {
        const record = this.#requireRecord(command.id);
        if (record.type !== 'freehand') throw new CanvasValidationError(`Shape '${record.id}' does not support point appends`, 'INVALID_POINT_APPEND');
        if (record.locked) throw new CanvasValidationError(`Shape '${record.id}' is locked`, 'SHAPE_LOCKED');
        const points = command.points.map((point) => canvasPointSchema.parse(point));
        const stored = this.#records.get(record.id);
        const storedProps = stored?.get('props');
        const storedPoints = storedProps instanceof Y.Map ? storedProps.get('points') : undefined;
        if (!(storedPoints instanceof Y.Array)) throw new CanvasValidationError(`Shape '${record.id}' point storage is invalid`, 'INVALID_CANVAS_DATA');
        if (storedPoints.length + points.length > 100_000) throw new CanvasValidationError('Shape point limit reached', 'PAYLOAD_TOO_LARGE');
        if (points.length > 0) storedPoints.push(points.map(cloneValue));
        changed.add(record.id);
        return;
      }
      case 'shape.delete': {
        if (command.ids.length > CANVAS_LIMITS.records) throw new CanvasValidationError('Shape delete exceeds the record limit', 'PAYLOAD_TOO_LARGE');
        this.#deleteShapes(command.ids, command.mode, changed);
        return;
      }
      case 'shape.reparent': {
        if (command.ids.length > CANVAS_LIMITS.records) throw new CanvasValidationError('Shape reparent exceeds the record limit', 'PAYLOAD_TOO_LARGE');
        this.#reparent(command.ids, command.parentId, command.beforeId, changed);
        return;
      }
      case 'shape.reorder': {
        const record = this.#requireRecord(command.id);
        if (record.locked) throw new CanvasValidationError(`Shape '${record.id}' is locked`, 'SHAPE_LOCKED');
        const index = this.#indexBefore(record.parentId, command.beforeId, command.id);
        this.#storeRecord({ ...record, index });
        changed.add(record.id);
        return;
      }
      case 'text.replace': {
        const record = this.#requireRecord(command.shapeId);
        if (record.locked) throw new CanvasValidationError(`Shape '${record.id}' is locked`, 'SHAPE_LOCKED');
        const props = record.props as Record<string, unknown>;
        const field = 'text' in props ? 'text' : 'label' in props ? 'label' : null;
        if (!field) throw new CanvasValidationError(`Shape '${record.id}' has no rich text field`, 'TEXT_FIELD_NOT_FOUND');
        const document = richTextDocumentSchema.parse(command.document);
        this.registry.validate({ ...record, props: { ...props, [field]: plainText(document) } });
        const fragment = this.#richText.get(`${record.id}:${field}`);
        if (!fragment) throw new CanvasValidationError(`Shape '${record.id}' has no collaborative ${field} field`, 'TEXT_FIELD_NOT_FOUND');
        writeRichText(fragment, document); changed.add(record.id); return;
      }
      case 'table.cell.set': {
        const record = this.#requireRecord(command.shapeId);
        if (record.type !== 'table') throw new CanvasValidationError(`Shape '${record.id}' is not a table`, 'INVALID_TABLE');
        if (record.locked) throw new CanvasValidationError(`Shape '${record.id}' is locked`, 'SHAPE_LOCKED');
        if (command.text.length > 20_000) throw new CanvasValidationError('Table cell text exceeds 20,000 characters', 'PAYLOAD_TOO_LARGE');
        const props = record.props as { columns: { id: string }[]; rows: { id: string }[] };
        if (!props.columns.some(({ id }) => id === command.columnId) || !props.rows.some(({ id }) => id === command.rowId)) throw new CanvasValidationError('Table cell does not exist', 'TABLE_CELL_NOT_FOUND');
        const key = `${record.id}:${command.rowId}:${command.columnId}`; let text = this.#tableCells.get(key);
        if (!text) { text = new Y.Text(); this.#tableCells.set(key, text); }
        this.#collaborativeRecordIds.set(text, record.id);
        if (text.length) text.delete(0, text.length); if (command.text) text.insert(0, command.text); changed.add(record.id); return;
      }
      case 'document.update': {
        if ('presentation' in command.patch) throw new CanvasValidationError('Use presentation.reorder to change frame order', 'INVALID_PRESENTATION');
        const current = this.#requireDocument();
        const document = canvasDocumentSchema.parse({ ...current, ...cloneValue(command.patch), id: 'document' });
        this.#validateDocumentReferences(document, this.#recordMap()); this.#storeDocument(document);
        changed.add('document');
        return;
      }
      case 'presentation.reorder': {
        const frame = this.#requireRecord(command.frameId);
        if (frame.type !== 'frame') throw new CanvasValidationError(`Shape '${frame.id}' is not a frame`, 'INVALID_PRESENTATION');
        const order = this.#presentationOrder();
        if (!order.has(frame.id)) throw new CanvasValidationError(`Presentation frame '${frame.id}' does not exist`, 'INVALID_PRESENTATION');
        if (command.beforeId === frame.id) return;
        const siblings = [...order.entries()]
          .filter(([id]) => id !== frame.id)
          .sort((left, right) => compareFractionalIndex(left[1], right[1]) || left[0].localeCompare(right[0]));
        const beforePosition = command.beforeId === undefined
          ? siblings.length
          : siblings.findIndex(([id]) => id === command.beforeId);
        if (beforePosition < 0) throw new CanvasValidationError(`Presentation beforeId '${command.beforeId}' does not exist`, 'INVALID_PRESENTATION');
        const previous = beforePosition > 0 ? siblings[beforePosition - 1]![1] : null;
        const next = beforePosition < siblings.length ? siblings[beforePosition]![1] : null;
        order.set(frame.id, generateKeyBetween(previous, next));
        changed.add('document');
        return;
      }
      case 'binding.set': {
        if (!this.#bindings.has(command.binding.id) && this.#bindings.size >= CANVAS_LIMITS.bindings) throw new CanvasValidationError('Canvas binding limit reached', 'PAYLOAD_TOO_LARGE');
        const binding = bindingRecordSchema.parse(command.binding);
        const connector = this.#requireRecord(binding.connectorId);
        if (connector.type !== 'line' && connector.type !== 'arrow') throw new CanvasValidationError(`Binding '${binding.id}' connector is not a line or arrow`, 'INVALID_BINDING');
        const validateEndpoint = (endpoint: BindingRecord['start'], name: 'start' | 'end') => {
          if (!endpoint) return;
          if (endpoint.shapeId === connector.id) throw new CanvasValidationError(`Binding '${binding.id}' cannot bind ${name} to its connector`, 'INVALID_BINDING');
          const target = this.#requireRecord(endpoint.shapeId);
          if (!endpoint.portId) return;
          const ports = this.registry.get(target.type).geometry.getConnectionPorts?.(target) ?? [];
          if (!ports.some(({ id }) => id === endpoint.portId)) throw new CanvasValidationError(`Port '${endpoint.portId}' does not exist on shape '${target.id}'`, 'UNKNOWN_CONNECTION_PORT');
        };
        validateEndpoint(binding.start, 'start'); validateEndpoint(binding.end, 'end');
        this.#storeBinding(binding);
        changed.add(binding.id);
        return;
      }
      case 'binding.delete': {
        command.ids.forEach((id) => { this.#bindings.delete(id); changed.add(id); });
        return;
      }
      case 'asset.set': {
        if (!this.#assets.has(command.asset.id) && this.#assets.size >= CANVAS_LIMITS.assets) throw new CanvasValidationError('Canvas asset limit reached', 'PAYLOAD_TOO_LARGE');
        const asset = assetRecordSchema.parse(command.asset);
        this.#assets.set(asset.id, asset);
        changed.add(asset.id);
        return;
      }
      case 'asset.delete': {
        const used = new Set<string>();
        this.#records.forEach((stored) => { const props = this.#readStoredRecord(stored).props as Record<string, unknown>; for (const key of ['assetId', 'imageAssetId', 'faviconAssetId']) { const value = props[key]; if (typeof value === 'string') used.add(value); } });
        command.ids.forEach((id) => { const asset = this.#assets.get(id); if (used.has(id) || (asset && used.has(asset.assetId))) throw new CanvasValidationError(`Asset '${id}' is still in use`, 'ASSET_IN_USE'); });
        command.ids.forEach((id) => { this.#assets.delete(id); changed.add(id); });
        return;
      }
      case 'document.replace': {
        this.#replaceSnapshot(command.snapshot, LOCAL_COMMAND_ORIGIN);
        command.snapshot.records.forEach(({ id }) => changed.add(id));
        return;
      }
    }
  }

  #deleteShapes(ids: readonly string[], mode: 'only' | 'cascade', changed: Set<string>): void {
    const records = this.#recordMap();
    const deleting = new Set(ids);
    ids.forEach((id) => {
      const record = this.#requireRecord(id);
      if (record.locked) throw new CanvasValidationError(`Shape '${id}' is locked`, 'SHAPE_LOCKED');
    });
    if (mode === 'cascade') {
      let added = true;
      while (added) {
        added = false;
        for (const record of records.values()) {
          if (deleting.has(record.parentId) && !deleting.has(record.id)) {
            deleting.add(record.id);
            added = true;
          }
        }
      }
    } else {
      for (const record of records.values()) {
        if (!deleting.has(record.parentId) || deleting.has(record.id)) continue;
        const world = getWorldTransform(record.id, records);
        const deletedParent = records.get(record.parentId);
        const nextParentId = deletedParent?.parentId ?? ROOT_PARENT_ID;
        const parentWorld = nextParentId === ROOT_PARENT_ID
          ? { x: 0, y: 0, rotation: 0 }
          : getWorldTransform(nextParentId, records);
        const local = toLocalTransform(parentWorld, world);
        const next = this.registry.validate({ ...record, parentId: nextParentId, ...local });
        this.#storeRecord(next);
        changed.add(next.id);
      }
    }
    for (const id of deleting) {
      this.#records.delete(id);
      [...this.#richText.keys()].filter((key) => key.startsWith(`${id}:`)).forEach((key) => this.#richText.delete(key));
      [...this.#tableCells.keys()].filter((key) => key.startsWith(`${id}:`)).forEach((key) => this.#tableCells.delete(key));
      changed.add(id);
    }
    const presentationOrder = this.#presentationOrder();
    for (const id of deleting) presentationOrder.delete(id);
    for (const [id, stored] of this.#bindings) {
      const binding = this.#readStoredBinding(stored);
      if (deleting.has(binding.connectorId) || (binding.start && deleting.has(binding.start.shapeId)) || (binding.end && deleting.has(binding.end.shapeId))) {
        this.#bindings.delete(id);
        changed.add(id);
      }
    }
  }

  #reparent(ids: readonly string[], parentId: string, beforeId: string | undefined, changed: Set<string>): void {
    const records = this.#recordMap();
    this.#validateParent(parentId, records);
    assertCanReparent(ids, parentId, records);
    ids.forEach((id) => {
      const record = records.get(id);
      if (!record) throw new CanvasValidationError(`Shape '${id}' does not exist`, 'SHAPE_NOT_FOUND');
      if (record.locked) throw new CanvasValidationError(`Shape '${id}' is locked`, 'SHAPE_LOCKED');
    });
    const parentWorld = parentId === ROOT_PARENT_ID ? { x: 0, y: 0, rotation: 0 } : getWorldTransform(parentId, records);
    let previousIndex: string | null = null;
    const before = beforeId ? this.#requireRecord(beforeId) : undefined;
    if (before && before.parentId !== parentId) throw new CanvasValidationError('beforeId must belong to the destination parent');
    const siblings = [...records.values()]
      .filter((record) => record.parentId === parentId && !ids.includes(record.id))
      .sort((a, b) => compareFractionalIndex(a.index, b.index));
    const beforePosition = before ? siblings.findIndex(({ id }) => id === before.id) : siblings.length;
    if (before && beforePosition < 0) throw new CanvasValidationError(`beforeId '${before.id}' does not exist`);
    previousIndex = beforePosition > 0 ? siblings[beforePosition - 1]?.index ?? null : null;
    const nextIndex = before?.index ?? null;

    for (const id of ids) {
      const record = this.#requireRecord(id);
      const world = getWorldTransform(id, records);
      const local = toLocalTransform(parentWorld, world);
      const index = generateKeyBetween(previousIndex, nextIndex);
      const next = this.registry.validate({ ...record, parentId, index, ...local });
      this.#storeRecord(next);
      records.set(id, next);
      previousIndex = index;
      changed.add(id);
    }
  }

  #replaceSnapshot(snapshot: CanvasSnapshotV2, origin: unknown): void {
    const validated = this.#validateSnapshot(snapshot);
    this.#doc.transact(() => {
      this.#records.clear(); this.#bindings.clear(); this.#assets.clear(); this.#document.clear(); this.#richText.clear(); this.#tableCells.clear();
      this.#storeDocument(validated.document);
      validated.records.forEach((record) => this.#storeRecord(record));
      validated.bindings.forEach((binding) => this.#storeBinding(binding));
      validated.assets.forEach((asset) => this.#assets.set(asset.id, cloneValue(asset)));
    }, origin);
    this.#undoManager?.clear();
  }

  #validateSnapshot(snapshot: CanvasSnapshotV2): CanvasSnapshotV2 {
    assertJsonSize(snapshot, 25 * 1024 * 1024, 'Canvas snapshot');
    const base = canvasSnapshotSchema.parse(snapshot) as CanvasSnapshotV2;
    const records = new Map<string, ShapeRecord>();
    for (const record of base.records) {
      if (records.has(record.id)) throw new CanvasValidationError(`Duplicate shape id '${record.id}'`);
      assertJsonSize(record.props, 10 * 1024 * 1024, `Shape '${record.id}' properties`);
      records.set(record.id, this.registry.validate(record));
    }
    for (const record of records.values()) {
      this.#validateParent(record.parentId, records);
      getWorldTransform(record.id, records);
    }
    this.#validateDocumentReferences(base.document, records);
    const ids = new Set<string>();
    for (const binding of base.bindings) {
      if (ids.has(binding.id)) throw new CanvasValidationError(`Duplicate binding id '${binding.id}'`);
      ids.add(binding.id);
      const connector = records.get(binding.connectorId);
      if (!connector || (connector.type !== 'line' && connector.type !== 'arrow') || (binding.start && !records.has(binding.start.shapeId)) || (binding.end && !records.has(binding.end.shapeId))) {
        throw new CanvasValidationError(`Binding '${binding.id}' references a missing shape`);
      }
    }
    const assets = new Set(base.assets.flatMap((asset) => [asset.id, asset.assetId]));
    records.forEach((record) => {
      if (record.type !== 'image') return;
      const props = record.props as { assetId?: unknown; imageSrc?: unknown };
      if (typeof props.assetId === 'string' && !assets.has(props.assetId)) {
        throw new CanvasValidationError(`Image '${record.id}' references missing asset '${props.assetId}'`, 'ASSET_NOT_FOUND');
      }
      if (typeof props.assetId !== 'string' && (typeof props.imageSrc !== 'string' || !/^data:image\/(?:png|jpeg|webp|gif);base64,/iu.test(props.imageSrc))) {
        throw new CanvasValidationError(`Image '${record.id}' has no valid image source`, 'ASSET_NOT_FOUND');
      }
    });
    return {
      ...base,
      records: [...records.values()].sort((a, b) => compareFractionalIndex(a.index, b.index) || a.id.localeCompare(b.id)),
      bindings: [...base.bindings].sort((a, b) => a.id.localeCompare(b.id)),
      assets: [...base.assets].sort((a, b) => a.id.localeCompare(b.id)),
    };
  }

  #validateDocumentReferences(document: CanvasDocumentRecord, records: ReadonlyMap<string, ShapeRecord>): void {
    const ids = new Set<string>();
    document.presentation.frameIds.forEach((id) => { if (ids.has(id)) throw new CanvasValidationError(`Presentation frame '${id}' is duplicated`, 'INVALID_PRESENTATION'); ids.add(id); if (records.get(id)?.type !== 'frame') throw new CanvasValidationError(`Presentation frame '${id}' does not exist`, 'INVALID_PRESENTATION'); });
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

  #validateDoc(doc: Y.Doc): void {
    const document = this.#readStoredDocument(doc.getMap<unknown>('document'));
    this.#validateSnapshot({
      schemaVersion: 2,
      document,
      records: [...doc.getMap<Y.Map<unknown>>('records').values()].map((record) => this.#hydrateRecord(this.#readStoredRecord(record), doc.getMap<Y.XmlFragment>('richText'), doc.getMap<Y.Text>('tableCells'))),
      bindings: [...doc.getMap<Y.Map<unknown>>('bindings').values()].map((binding) => this.#readStoredBinding(binding)),
      assets: [...doc.getMap<AssetRecord>('assets').values()],
    });
  }

  #notify(): void {
    if (this.#subscriptions.size === 0) return;
    const state = this.getViewState();
    for (const subscription of this.#subscriptions) {
      const next = subscription.selector(state);
      if (Object.is(next, subscription.value)) continue;
      subscription.value = next;
      subscription.listener(next);
    }
  }

  #updateSnapshotCache(transaction: Y.Transaction): Set<string> {
    const changedKeys = <Value>(map: Y.Map<Value>): Set<string> => {
      const result = new Set<string>();
      const type = map as unknown as Parameters<typeof transaction.changed.get>[0];
      transaction.changed.get(type)?.forEach((key) => { if (typeof key === 'string') result.add(key); });
      transaction.changedParentTypes.get(type)?.forEach((event) => { const key = event.path[0]; if (typeof key === 'string') result.add(key); });
      return result;
    };
    const recordIds = changedKeys(this.#records);
    changedKeys(this.#richText).forEach((key) => recordIds.add(key.split(':')[0]!));
    changedKeys(this.#tableCells).forEach((key) => recordIds.add(key.split(':')[0]!));
    transaction.changed.forEach((_keys, type) => {
      const recordId = this.#collaborativeRecordIds.get(type);
      if (recordId) recordIds.add(recordId);
    });
    transaction.changedParentTypes.forEach((_events, type) => {
      const recordId = this.#collaborativeRecordIds.get(type);
      if (recordId) recordIds.add(recordId);
    });
    if (!this.#snapshotCache) return recordIds;
    const bindingIds = changedKeys(this.#bindings); const assetIds = changedKeys(this.#assets);
    transaction.changed.forEach((_keys, type) => { const bindingId = this.#collaborativeBindingIds.get(type); if (bindingId) bindingIds.add(bindingId); });
    // Snapshots are public point-in-time values. Always work on a new array so a
    // later command or undo cannot mutate a snapshot already handed to a caller.
    const records = [...this.#snapshotCache.records];
    const structuralChange = [...recordIds].some((id) => {
      const storedValue = this.#records.get(id); const stored = storedValue ? this.#readStoredRecord(storedValue) : undefined;
      const previous = this.#snapshotRecords.get(id);
      return !stored || !previous || stored.index !== previous.index;
    });
    if (structuralChange || recordIds.size > 100 || recordIds.size > Math.max(10, records.length / 2)) {
      records.splice(0, records.length, ...[...this.#records.values()].map((record) => this.#hydrateRecord(this.#readStoredRecord(record))).sort((a, b) => compareFractionalIndex(a.index, b.index) || a.id.localeCompare(b.id)));
      this.#snapshotRecords = new Map(records.map((record) => [record.id, record])); this.#snapshotPositions = new Map(records.map((record, index) => [record.id, index]));
    } else {
    let orderChanged = false;
    recordIds.forEach((id) => {
      const storedValue = this.#records.get(id); const stored = storedValue ? this.#readStoredRecord(storedValue) : undefined; const position = this.#snapshotPositions.get(id); const previous = this.#snapshotRecords.get(id);
      if (!stored) { if (position !== undefined) records.splice(position, 1); this.#snapshotRecords.delete(id); this.#snapshotPositions.delete(id); orderChanged = true; return; }
      const next = this.#hydrateRecord(stored); this.#snapshotRecords.set(id, next);
      if (position !== undefined && previous?.index === next.index) records[position] = next;
      else { if (position !== undefined) records.splice(position, 1); records.push(next); orderChanged = true; }
    });
    if (orderChanged) { records.sort((a, b) => compareFractionalIndex(a.index, b.index) || a.id.localeCompare(b.id)); this.#snapshotPositions = new Map(records.map((record, index) => [record.id, index])); }
    }
    let bindingRecords = this.#snapshotCache.bindings;
    if (bindingIds.size) { const bindings = new Map(bindingRecords.map((binding) => [binding.id, binding])); bindingIds.forEach((id) => { const binding = this.#bindings.get(id); if (binding) bindings.set(id, this.#readStoredBinding(binding)); else bindings.delete(id); }); bindingRecords = [...bindings.values()].sort((a, b) => a.id.localeCompare(b.id)); }
    let assetRecords = this.#snapshotCache.assets;
    if (assetIds.size) { const assets = new Map(assetRecords.map((asset) => [asset.id, asset])); assetIds.forEach((id) => { const asset = this.#assets.get(id); if (asset) assets.set(id, cloneValue(asset)); else assets.delete(id); }); assetRecords = [...assets.values()].sort((a, b) => a.id.localeCompare(b.id)); }
    let documentChanged = false;
    transaction.changed.forEach((_keys, type) => { if (this.#documentTypes.has(type)) documentChanged = true; });
    transaction.changedParentTypes.forEach((_events, type) => { if (this.#documentTypes.has(type)) documentChanged = true; });
    const document = documentChanged ? this.#requireDocument() : this.#snapshotCache.document;
    this.#snapshotCache = {
      schemaVersion: 2, document,
      records,
      bindings: bindingRecords,
      assets: assetRecords,
    };
    return recordIds;
  }

  #recordMap(): Map<string, ShapeRecord> { return new Map([...this.#records.entries()].map(([id, stored]) => [id, this.#readStoredRecord(stored)])); }
  #requireRecord(id: string): ShapeRecord {
    const stored = this.#records.get(id);
    if (!stored) throw new CanvasValidationError(`Shape '${id}' does not exist`, 'SHAPE_NOT_FOUND');
    return this.#hydrateRecord(this.#readStoredRecord(stored));
  }

  #storeRecord(record: ShapeRecord): void {
    const props = cloneValue(record.props) as Record<string, unknown>;
    for (const field of ['text', 'label'] as const) {
      if (!(field in props)) continue;
      const value = props[field];
      if (typeof value !== 'string') throw new CanvasValidationError(`Shape '${record.id}' has invalid ${field} text`, 'INVALID_CANVAS_DATA');
      const document = richTextFromString(value);
      const key = `${record.id}:${field}`; let fragment = this.#richText.get(key);
      if (!fragment) { fragment = new Y.XmlFragment(); this.#richText.set(key, fragment); }
      this.#collaborativeRecordIds.set(fragment, record.id);
      if (JSON.stringify(readRichText(fragment)) !== JSON.stringify(document)) writeRichText(fragment, document);
      props[field] = '';
    }
    if (record.type === 'table') {
      const table = props as unknown as { rows: { id: string; cells: Record<string, string> }[] };
      const validKeys = new Set<string>();
      table.rows.forEach((row) => { Object.entries(row.cells).forEach(([columnId, value]) => { const key = `${record.id}:${row.id}:${columnId}`; validKeys.add(key); let text = this.#tableCells.get(key); if (!text) { text = new Y.Text(); this.#tableCells.set(key, text); } this.#collaborativeRecordIds.set(text, record.id); if (text.toString() !== value) { if (text.length) text.delete(0, text.length); if (value) text.insert(0, value); } }); row.cells = {}; });
      [...this.#tableCells.keys()].filter((key) => key.startsWith(`${record.id}:`) && !validKeys.has(key)).forEach((key) => this.#tableCells.delete(key));
    }
    let stored = this.#records.get(record.id);
    if (!stored) { stored = new Y.Map<unknown>(); this.#records.set(record.id, stored); }
    this.#collaborativeRecordIds.set(stored, record.id);
    const scalarRecord = { ...cloneValue(record) } as Record<string, unknown>; delete scalarRecord.props;
    Object.entries(scalarRecord).forEach(([key, value]) => { if (!Object.is(stored!.get(key), value)) stored!.set(key, value); });
    const existingProps = stored.get('props');
    if (existingProps !== undefined && !(existingProps instanceof Y.Map)) throw new CanvasValidationError(`Shape '${record.id}' properties are not stored as a collaborative map`, 'INVALID_CANVAS_DATA');
    const storedProps: Y.Map<unknown> = existingProps instanceof Y.Map ? existingProps : new Y.Map<unknown>();
    if (existingProps === undefined) stored.set('props', storedProps);
    this.#collaborativeRecordIds.set(storedProps, record.id);
    const propsRecord = props as Record<string, unknown>;
    [...storedProps.keys()].filter((key) => !(key in propsRecord)).forEach((key) => storedProps.delete(key));
    Object.entries(propsRecord).forEach(([key, value]) => {
      if (key === 'points') {
        if (!Array.isArray(value)) throw new CanvasValidationError(`Shape '${record.id}' points are invalid`, 'INVALID_CANVAS_DATA');
        const existingPoints = storedProps.get(key);
        if (existingPoints !== undefined && !(existingPoints instanceof Y.Array)) {
          throw new CanvasValidationError(`Shape '${record.id}' points are not stored collaboratively`, 'INVALID_CANVAS_DATA');
        }
        const storedPoints = existingPoints instanceof Y.Array ? existingPoints : new Y.Array<unknown>();
        if (existingPoints === undefined) storedProps.set(key, storedPoints);
        this.#collaborativeRecordIds.set(storedPoints, record.id);
        if (JSON.stringify(storedPoints.toArray()) !== JSON.stringify(value)) {
          if (storedPoints.length > 0) storedPoints.delete(0, storedPoints.length);
          if (value.length > 0) storedPoints.push(value.map(cloneValue));
        }
        return;
      }
      if (JSON.stringify(storedProps.get(key)) !== JSON.stringify(value)) storedProps.set(key, cloneValue(value));
    });
  }

  #readStoredRecord(stored: unknown): ShapeRecord {
    if (!(stored instanceof Y.Map)) throw new CanvasValidationError('Canvas shape is not a collaborative record', 'INVALID_CANVAS_DATA');
    const props = stored.get('props');
    if (!(props instanceof Y.Map)) throw new CanvasValidationError(`Shape '${String(stored.get('id') ?? 'unknown')}' has invalid collaborative properties`, 'INVALID_CANVAS_DATA');
    const id = stored.get('id'); if (typeof id === 'string') { this.#collaborativeRecordIds.set(stored, id); this.#collaborativeRecordIds.set(props, id); }
    const plainProps = Object.fromEntries([...props.entries()].map(([key, value]) => {
      if (key !== 'points') return [key, value];
      if (!(value instanceof Y.Array)) {
        throw new CanvasValidationError(`Shape '${String(stored.get('id') ?? 'unknown')}' points are not stored collaboratively`, 'INVALID_CANVAS_DATA');
      }
      const recordId = String(stored.get('id') ?? 'unknown');
      this.#collaborativeRecordIds.set(value, recordId);
      return [key, value.toArray().map(cloneValue)];
    }));
    return { ...Object.fromEntries([...stored.entries()].filter(([key]) => key !== 'props')), props: plainProps } as unknown as ShapeRecord;
  }

  #storeBinding(binding: BindingRecord): void {
    let stored = this.#bindings.get(binding.id); if (!stored) { stored = new Y.Map<unknown>(); this.#bindings.set(binding.id, stored); } this.#collaborativeBindingIds.set(stored, binding.id);
    Object.entries(cloneValue(binding)).forEach(([key, value]) => { if (JSON.stringify(stored!.get(key)) !== JSON.stringify(value)) stored!.set(key, value); });
  }

  #readStoredBinding(stored: unknown): BindingRecord {
    if (!(stored instanceof Y.Map)) throw new CanvasValidationError('Canvas binding is not a collaborative record', 'INVALID_CANVAS_DATA'); const value = Object.fromEntries(stored.entries());
    const binding = bindingRecordSchema.parse(value); this.#collaborativeBindingIds.set(stored, binding.id); return binding;
  }
  #hydrateRecord(record: ShapeRecord, richText = this.#richText, tableCells = this.#tableCells): ShapeRecord {
    const props = cloneValue(record.props) as Record<string, unknown>;
    for (const field of ['text', 'label'] as const) { const fragment = richText.get(`${record.id}:${field}`); if (fragment) props[field] = plainText(readRichText(fragment)); }
    if (record.type === 'table') {
      const table = props as unknown as { rows: { id: string; cells: Record<string, string> }[]; columns: { id: string }[] };
      table.rows.forEach((row) => { row.cells = Object.fromEntries(table.columns.map(({ id }) => [id, tableCells.get(`${record.id}:${row.id}:${id}`)?.toString() ?? ''])); });
    }
    return { ...cloneValue(record), props };
  }
  #requireDocument(): CanvasDocumentRecord {
    return this.#readStoredDocument(this.#document);
  }

  #trackDocumentTypes(document: Y.Map<unknown>): void {
    this.#documentTypes.add(document); const grid = document.get('grid'); const presentation = document.get('presentation');
    if (grid instanceof Y.Map) this.#documentTypes.add(grid); if (presentation instanceof Y.Map) { this.#documentTypes.add(presentation); const order = presentation.get('frameOrder'); if (order instanceof Y.Map) this.#documentTypes.add(order); }
  }

  #presentationOrder(): Y.Map<string> {
    const presentation = this.#document.get('presentation');
    const order = presentation instanceof Y.Map ? presentation.get('frameOrder') : undefined;
    if (!(presentation instanceof Y.Map) || !(order instanceof Y.Map)) throw new CanvasValidationError('Canvas presentation order is missing', 'INVALID_CANVAS_DATA');
    this.#documentTypes.add(presentation);
    this.#documentTypes.add(order);
    return order as Y.Map<string>;
  }

  #appendPresentationFrame(frameId: string): void {
    const order = this.#presentationOrder();
    if (order.has(frameId)) return;
    const last = [...order.entries()].sort((left, right) => compareFractionalIndex(left[1], right[1]) || left[0].localeCompare(right[0])).at(-1);
    order.set(frameId, generateKeyBetween(last?.[1] ?? null, null));
  }

  #storeDocument(document: CanvasDocumentRecord): void {
    for (const key of ['id', 'title', 'background'] as const) if (!Object.is(this.#document.get(key), document[key])) this.#document.set(key, document[key]);
    const gridValue = this.#document.get('grid'); if (gridValue !== undefined && !(gridValue instanceof Y.Map)) throw new CanvasValidationError('Canvas grid is not collaborative', 'INVALID_CANVAS_DATA');
    const grid: Y.Map<unknown> = gridValue instanceof Y.Map ? gridValue : new Y.Map<unknown>(); if (gridValue === undefined) this.#document.set('grid', grid); this.#documentTypes.add(grid);
    if (!Object.is(grid.get('enabled'), document.grid.enabled)) grid.set('enabled', document.grid.enabled); if (!Object.is(grid.get('size'), document.grid.size)) grid.set('size', document.grid.size);
    const presentationValue = this.#document.get('presentation'); if (presentationValue !== undefined && !(presentationValue instanceof Y.Map)) throw new CanvasValidationError('Canvas presentation is not collaborative', 'INVALID_CANVAS_DATA');
    const presentation: Y.Map<unknown> = presentationValue instanceof Y.Map ? presentationValue : new Y.Map<unknown>(); if (presentationValue === undefined) this.#document.set('presentation', presentation); this.#documentTypes.add(presentation);
    const orderValue = presentation.get('frameOrder'); if (orderValue !== undefined && !(orderValue instanceof Y.Map)) throw new CanvasValidationError('Canvas presentation order is not collaborative', 'INVALID_CANVAS_DATA');
    const order: Y.Map<string> = orderValue instanceof Y.Map ? orderValue as Y.Map<string> : new Y.Map<string>(); if (orderValue === undefined) presentation.set('frameOrder', order); this.#documentTypes.add(order);
    const wanted = new Set(document.presentation.frameIds); [...order.keys()].filter((id) => !wanted.has(id)).forEach((id) => order.delete(id));
    let previous: string | null = null; document.presentation.frameIds.forEach((id) => { const index = generateKeyBetween(previous, null); if (order.get(id) !== index) order.set(id, index); previous = index; });
  }

  #readStoredDocument(document: Y.Map<unknown>): CanvasDocumentRecord {
    const grid = document.get('grid'); const presentation = document.get('presentation'); const order = presentation instanceof Y.Map ? presentation.get('frameOrder') : undefined;
    if (!(grid instanceof Y.Map) || !(presentation instanceof Y.Map) || !(order instanceof Y.Map)) throw new CanvasValidationError('Canvas document collaborative structure is missing', 'INVALID_CANVAS_DATA');
    this.#documentTypes.add(document); this.#documentTypes.add(grid); this.#documentTypes.add(presentation); this.#documentTypes.add(order);
    return canvasDocumentSchema.parse({ id: document.get('id'), title: document.get('title'), background: document.get('background'), grid: { enabled: grid.get('enabled'), size: grid.get('size') }, presentation: { frameIds: [...order.entries()].sort((left, right) => compareFractionalIndex(String(left[1]), String(right[1])) || String(left[0]).localeCompare(String(right[0]))).map(([id]) => String(id)) } });
  }
  #validateParent(parentId: string, records: ReadonlyMap<string, ShapeRecord>): void {
    if (parentId !== ROOT_PARENT_ID && !records.has(parentId)) {
      throw new CanvasValidationError(`Parent '${parentId}' does not exist`, 'PARENT_NOT_FOUND');
    }
    const parent = records.get(parentId);
    if (parent && parent.type !== 'frame' && parent.type !== 'group') throw new CanvasValidationError(`Shape '${parentId}' cannot contain child shapes`, 'INVALID_PARENT_TYPE');
  }
  #indexBefore(parentId: string, beforeId?: string, excludingId?: string): string {
    const siblings = [...this.#records.values()].map((stored) => this.#readStoredRecord(stored))
      .filter((record) => record.parentId === parentId && record.id !== excludingId)
      .sort((a, b) => compareFractionalIndex(a.index, b.index));
    if (!beforeId) return generateKeyBetween(siblings.at(-1)?.index ?? null, null);
    const position = siblings.findIndex(({ id }) => id === beforeId);
    if (position < 0) throw new CanvasValidationError(`beforeId '${beforeId}' is not a sibling`);
    return generateKeyBetween(siblings[position - 1]?.index ?? null, siblings[position]?.index ?? null);
  }
  #assertAlive(): void { if (this.#destroyed) throw new Error('Canvas engine has been destroyed'); }
  #assertWritable(): void { this.#assertAlive(); if (this.#viewState.readonly) throw new CanvasReadonlyError(); }

  #syncCollaboratorsFromAwareness(): void {
    const collaborators = new Map<string, CanvasCollaborator>();
    for (const [clientId, state] of this.awareness.getStates()) {
      if (clientId === this.#doc.clientID) continue;
      const candidate = state as {
        peerId?: unknown;
        user?: { name?: unknown; color?: unknown; avatarUrl?: unknown };
        cursor?: { x?: unknown; y?: unknown };
        button?: unknown;
        viewportZoom?: unknown;
        presentationFrameId?: unknown;
        pointerTool?: unknown;
        laserTrail?: unknown;
      };
      if (typeof candidate.peerId !== 'string' || typeof candidate.user?.name !== 'string' || typeof candidate.user.color !== 'string') continue;
      const cursor = candidate.cursor;
      const laserTrail = validateLaserTrail(candidate.laserTrail);
      collaborators.set(candidate.peerId, {
        id: candidate.peerId,
        name: candidate.user.name,
        color: candidate.user.color,
        ...(typeof candidate.user.avatarUrl === 'string' ? { avatarUrl: candidate.user.avatarUrl } : {}),
        ...(cursor && typeof cursor.x === 'number' && Number.isFinite(cursor.x) && typeof cursor.y === 'number' && Number.isFinite(cursor.y)
          ? { cursor: { x: cursor.x, y: cursor.y } }
          : {}),
        ...(typeof candidate.button === 'string' ? { button: candidate.button } : {}),
        ...(typeof candidate.viewportZoom === 'number' && Number.isFinite(candidate.viewportZoom) && candidate.viewportZoom >= 0.05 && candidate.viewportZoom <= 32
          ? { zoom: candidate.viewportZoom }
          : {}),
        ...(typeof candidate.presentationFrameId === 'string' || candidate.presentationFrameId === null
          ? { presentationFrameId: candidate.presentationFrameId }
          : {}),
        ...(candidate.pointerTool === 'pointer' || candidate.pointerTool === 'laser'
          ? { pointerTool: candidate.pointerTool }
          : {}),
        ...(laserTrail ? { laserTrail } : {}),
      });
    }
    this.#viewState = { ...this.#viewState, collaborators };
    this.#notify();
  }
}

export function createCanvasEngine(config: CanvasEngineConfig): CanvasEngine {
  return new YjsCanvasEngine(config);
}

export function mergeCanvasUpdates(updates: readonly Uint8Array[]): Uint8Array {
  if (updates.length === 0) throw new CanvasValidationError('At least one canvas update is required');
  return Y.mergeUpdates([...updates]);
}
