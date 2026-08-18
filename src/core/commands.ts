import type { AssetRecord, BindingRecord, CanvasDocumentRecord, CanvasPoint, ShapeRecord } from './model.js';

export type ShapePatch = Partial<Omit<ShapeRecord, 'id' | 'type' | 'typeVersion'>>;

export type CanvasCommand =
  | { type: 'batch'; commands: CanvasCommand[] }
  | { type: 'shape.create'; record: ShapeRecord }
  | { type: 'shape.update'; id: string; patch: ShapePatch }
  | { type: 'frame.resize'; id: string; patch: ShapePatch }
  | { type: 'shape.points.append'; id: string; points: CanvasPoint[] }
  | { type: 'shape.delete'; ids: string[]; mode: 'only' | 'cascade' }
  | { type: 'shape.reparent'; ids: string[]; parentId: string; beforeId?: string }
  | { type: 'shape.reorder'; id: string; beforeId?: string }
  | { type: 'text.replace'; shapeId: string; document: unknown }
  | { type: 'table.cell.set'; shapeId: string; rowId: string; columnId: string; text: string }
  | { type: 'document.update'; patch: Partial<Omit<CanvasDocumentRecord, 'id' | 'presentation'>> }
  | { type: 'presentation.reorder'; frameId: string; beforeId?: string }
  | { type: 'binding.set'; binding: BindingRecord }
  | { type: 'binding.delete'; ids: string[] }
  | { type: 'asset.set'; asset: AssetRecord }
  | { type: 'asset.delete'; ids: string[] }
  | { type: 'document.replace'; snapshot: import('./model.js').CanvasSnapshotV2 };

export interface CommandResult {
  transactionId: string;
  changedRecordIds: readonly string[];
}
