import type { CanvasEngine } from './CanvasEngine.js';
import { CanvasValidationError } from './model.js';

const MAX_CSV_BYTES = 10 * 1024 * 1024;

export function parseCsv(source: string): string[][] {
  if (new TextEncoder().encode(source).byteLength > MAX_CSV_BYTES) throw new CanvasValidationError('CSV exceeds 10 MB', 'CSV_LIMIT');
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ',') { row.push(cell); cell = ''; }
    else if (character === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (character !== '\r') cell += character;
  }
  if (quoted) throw new CanvasValidationError('CSV contains an unterminated quoted field', 'INVALID_CSV');
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (rows.length > 5_001) throw new CanvasValidationError('CSV exceeds 5,000 data rows', 'CSV_LIMIT');
  if (rows.some((value) => value.length > 100)) throw new CanvasValidationError('CSV exceeds 100 columns', 'CSV_LIMIT');
  const cells = rows.reduce((sum, value) => sum + value.filter(Boolean).length, 0);
  if (cells > 100_000) throw new CanvasValidationError('CSV exceeds 100,000 non-empty cells', 'CSV_LIMIT');
  return rows;
}

const csvCell = (value: string) => /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
export function serializeCsv(rows: readonly (readonly string[])[]): string { return rows.map((row) => row.map(csvCell).join(',')).join('\r\n'); }

export function applyCsvToTable(engine: CanvasEngine, tableId: string, rows: readonly (readonly string[])[]): void {
  const table = engine.getSnapshot().records.find(({ id }) => id === tableId);
  if (!table || table.type !== 'table') throw new CanvasValidationError(`Table '${tableId}' does not exist`, 'SHAPE_NOT_FOUND');
  const props = table.props as { columns: { id: string; title: string; width: number }[]; rows: { id: string; cells: Record<string, string> }[] } & Record<string, unknown>;
  const header = rows[0] ?? [];
  const columns = header.map((title) => ({ id: crypto.randomUUID(), title, width: 160 }));
  const dataRows = rows.slice(1).map((values) => ({ id: crypto.randomUUID(), cells: Object.fromEntries(columns.map((column, index) => [column.id, values[index] ?? ''])) }));
  engine.dispatch({ type: 'shape.update', id: tableId, patch: { props: { ...props, columns, rows: dataRows } } });
}

export function tableToCsv(engine: CanvasEngine, tableId: string): string {
  const table = engine.getSnapshot().records.find(({ id }) => id === tableId);
  if (!table || table.type !== 'table') throw new CanvasValidationError(`Table '${tableId}' does not exist`, 'SHAPE_NOT_FOUND');
  const props = table.props as { columns: { id: string; title: string }[]; rows: { cells: Record<string, string> }[] };
  return serializeCsv([props.columns.map(({ title }) => title), ...props.rows.map((row) => props.columns.map(({ id }) => row.cells[id] ?? ''))]);
}

interface TableColumn { id: string; title: string; width: number }
interface TableRow { id: string; cells: Record<string, string> }
interface TableProps extends Record<string, unknown> { columns: TableColumn[]; rows: TableRow[] }

function requireTable(engine: CanvasEngine, tableId: string): { props: TableProps } {
  const record = engine.getSnapshot().records.find(({ id }) => id === tableId);
  if (!record || record.type !== 'table') throw new CanvasValidationError(`Table '${tableId}' does not exist`, 'SHAPE_NOT_FOUND');
  return { props: record.props as TableProps };
}

function replaceTable(engine: CanvasEngine, tableId: string, props: TableProps): void {
  engine.dispatch({ type: 'shape.update', id: tableId, patch: { props } });
}

export function insertTableRow(engine: CanvasEngine, tableId: string, beforeRowId?: string): string {
  const { props } = requireTable(engine, tableId);
  if (props.rows.length >= 5_000) throw new CanvasValidationError('Table row limit reached', 'TABLE_LIMIT');
  const id = crypto.randomUUID();
  const row: TableRow = { id, cells: Object.fromEntries(props.columns.map((column) => [column.id, ''])) };
  const index = beforeRowId ? props.rows.findIndex((value) => value.id === beforeRowId) : props.rows.length;
  if (beforeRowId && index < 0) throw new CanvasValidationError(`Row '${beforeRowId}' does not exist`, 'INVALID_TABLE');
  const rows = [...props.rows]; rows.splice(index, 0, row); replaceTable(engine, tableId, { ...props, rows }); return id;
}

export function deleteTableRow(engine: CanvasEngine, tableId: string, rowId: string): void {
  const { props } = requireTable(engine, tableId); const rows = props.rows.filter((row) => row.id !== rowId);
  if (rows.length === props.rows.length) throw new CanvasValidationError(`Row '${rowId}' does not exist`, 'INVALID_TABLE');
  replaceTable(engine, tableId, { ...props, rows });
}

export function moveTableRow(engine: CanvasEngine, tableId: string, rowId: string, beforeRowId?: string): void {
  const { props } = requireTable(engine, tableId); const row = props.rows.find((value) => value.id === rowId);
  if (!row) throw new CanvasValidationError(`Row '${rowId}' does not exist`, 'INVALID_TABLE');
  const rows = props.rows.filter((value) => value.id !== rowId); const index = beforeRowId ? rows.findIndex((value) => value.id === beforeRowId) : rows.length;
  if (beforeRowId && index < 0) throw new CanvasValidationError(`Row '${beforeRowId}' does not exist`, 'INVALID_TABLE');
  rows.splice(index, 0, row); replaceTable(engine, tableId, { ...props, rows });
}

export function insertTableColumn(engine: CanvasEngine, tableId: string, beforeColumnId?: string): string {
  const { props } = requireTable(engine, tableId);
  if (props.columns.length >= 100) throw new CanvasValidationError('Table column limit reached', 'TABLE_LIMIT');
  const id = crypto.randomUUID(); const column: TableColumn = { id, title: `Column ${props.columns.length + 1}`, width: 160 };
  const index = beforeColumnId ? props.columns.findIndex((value) => value.id === beforeColumnId) : props.columns.length;
  if (beforeColumnId && index < 0) throw new CanvasValidationError(`Column '${beforeColumnId}' does not exist`, 'INVALID_TABLE');
  const columns = [...props.columns]; columns.splice(index, 0, column);
  const rows = props.rows.map((row) => ({ ...row, cells: { ...row.cells, [id]: '' } })); replaceTable(engine, tableId, { ...props, columns, rows }); return id;
}

export function deleteTableColumn(engine: CanvasEngine, tableId: string, columnId: string): void {
  const { props } = requireTable(engine, tableId); const columns = props.columns.filter((column) => column.id !== columnId);
  if (columns.length === props.columns.length) throw new CanvasValidationError(`Column '${columnId}' does not exist`, 'INVALID_TABLE');
  const rows = props.rows.map((row) => { const cells = { ...row.cells }; delete cells[columnId]; return { ...row, cells }; });
  replaceTable(engine, tableId, { ...props, columns, rows });
}

export function moveTableColumn(engine: CanvasEngine, tableId: string, columnId: string, beforeColumnId?: string): void {
  const { props } = requireTable(engine, tableId); const column = props.columns.find((value) => value.id === columnId);
  if (!column) throw new CanvasValidationError(`Column '${columnId}' does not exist`, 'INVALID_TABLE');
  const columns = props.columns.filter((value) => value.id !== columnId); const index = beforeColumnId ? columns.findIndex((value) => value.id === beforeColumnId) : columns.length;
  if (beforeColumnId && index < 0) throw new CanvasValidationError(`Column '${beforeColumnId}' does not exist`, 'INVALID_TABLE');
  columns.splice(index, 0, column); replaceTable(engine, tableId, { ...props, columns });
}

export function resizeTableColumn(engine: CanvasEngine, tableId: string, columnId: string, width: number): void {
  if (!Number.isFinite(width) || width < 40 || width > 2_000) throw new CanvasValidationError('Column width must be between 40 and 2,000', 'INVALID_TABLE');
  const { props } = requireTable(engine, tableId); let found = false;
  const columns = props.columns.map((column) => { if (column.id !== columnId) return column; found = true; return { ...column, width }; });
  if (!found) throw new CanvasValidationError(`Column '${columnId}' does not exist`, 'INVALID_TABLE');
  replaceTable(engine, tableId, { ...props, columns });
}
