import { z } from 'zod';

export const CANVAS_SCHEMA_VERSION = 2 as const;
export const ROOT_PARENT_ID = 'root';

export function compareFractionalIndex(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

export const CANVAS_LIMITS = {
  records: 50_000,
  bindings: 100_000,
  assets: 5_000,
  nestingDepth: 32,
  idLength: 255,
  typeLength: 100,
  titleLength: 500,
  metadataBytes: 64 * 1024,
} as const;

const finiteNumber = z.number().finite();
const identifier = z.string().min(1).max(CANVAS_LIMITS.idLength);

export const viewportSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  zoom: finiteNumber.min(0.05).max(32),
});

export type CanvasViewport = z.infer<typeof viewportSchema>;

export const canvasDocumentSchema = z.object({
  id: z.literal('document'),
  title: z.string().max(CANVAS_LIMITS.titleLength),
  background: z.string().min(1).max(64),
  grid: z.object({
    enabled: z.boolean(),
    size: z.number().int().min(4).max(256),
  }),
  presentation: z.object({
    frameIds: z.array(identifier).max(CANVAS_LIMITS.records),
  }),
});

export type CanvasDocumentRecord = z.infer<typeof canvasDocumentSchema>;

export interface ShapeRecord<Props = unknown> {
  id: string;
  type: string;
  typeVersion: number;
  parentId: string;
  index: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  props: Props;
}

export const shapeRecordSchema = z.object({
  id: identifier,
  type: z.string().min(1).max(CANVAS_LIMITS.typeLength),
  typeVersion: z.number().int().positive(),
  parentId: identifier,
  index: z.string().min(1).max(255),
  x: finiteNumber,
  y: finiteNumber,
  rotation: finiteNumber,
  opacity: finiteNumber.min(0).max(1),
  locked: z.boolean(),
  hidden: z.boolean(),
  props: z.unknown(),
});

export const bindingRecordSchema = z.object({
  id: identifier,
  connectorId: identifier,
  start: z.object({ shapeId: identifier, portId: identifier.optional() }).nullable(),
  end: z.object({ shapeId: identifier, portId: identifier.optional() }).nullable(),
});

export type BindingRecord = z.infer<typeof bindingRecordSchema>;

export const assetRecordSchema = z.object({
  id: identifier,
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']),
  width: z.number().int().positive().max(16_384),
  height: z.number().int().positive().max(16_384),
  byteSize: z.number().int().positive().max(25 * 1024 * 1024),
  assetId: z.uuid(),
});

export type AssetRecord = z.infer<typeof assetRecordSchema>;

export interface CanvasSnapshotV2 {
  schemaVersion: typeof CANVAS_SCHEMA_VERSION;
  document: CanvasDocumentRecord;
  records: ShapeRecord[];
  bindings: BindingRecord[];
  assets: AssetRecord[];
}

export const canvasSnapshotSchema = z.object({
  schemaVersion: z.literal(CANVAS_SCHEMA_VERSION),
  document: canvasDocumentSchema,
  records: z.array(shapeRecordSchema).max(CANVAS_LIMITS.records),
  bindings: z.array(bindingRecordSchema).max(CANVAS_LIMITS.bindings),
  assets: z.array(assetRecordSchema).max(CANVAS_LIMITS.assets),
});

export const EMPTY_CANVAS_SNAPSHOT: CanvasSnapshotV2 = {
  schemaVersion: CANVAS_SCHEMA_VERSION,
  document: {
    id: 'document',
    title: '',
    background: '#f8fafc',
    grid: { enabled: false, size: 20 },
    presentation: { frameIds: [] },
  },
  records: [],
  bindings: [],
  assets: [],
};

export function assertJsonSize(value: unknown, maximumBytes: number, label: string): void {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (bytes > maximumBytes) {
    throw new CanvasValidationError(`${label} exceeds ${maximumBytes} bytes`, 'PAYLOAD_TOO_LARGE');
  }
}

export class CanvasValidationError extends Error {
  constructor(message: string, readonly code = 'INVALID_CANVAS_DATA') {
    super(message);
    this.name = 'CanvasValidationError';
  }
}

export class CanvasReadonlyError extends Error {
  constructor() {
    super('The canvas is read-only');
    this.name = 'CanvasReadonlyError';
  }
}
