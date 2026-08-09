import type { CanvasAst, DslDirection, DslEdge, DslNode } from './ast.js';
import { DslDiagnosticError } from './ast.js';
import { tokenizeDsl, type Token, type TokenKind } from './tokenizer.js';

class Parser {
  readonly tokens: Token[];
  index = 0;
  constructor(source: string) { this.tokens = tokenizeDsl(source); }
  current(): Token { return this.tokens[this.index]!; }
  take(kind?: TokenKind): Token {
    const token = this.current();
    if (kind && token.kind !== kind) throw new DslDiagnosticError(`Expected ${kind}, received ${token.kind}`, token.line, token.column);
    this.index++; return token;
  }
  word(value?: string): Token {
    const token = this.take('word');
    if (value && token.value !== value) throw new DslDiagnosticError(`Expected '${value}'`, token.line, token.column);
    return token;
  }
  text(): string {
    const token = this.current();
    if (token.kind !== 'word' && token.kind !== 'string') throw new DslDiagnosticError('Expected text', token.line, token.column);
    return this.take().value;
  }
  number(): number {
    const token = this.word(); const value = Number(token.value);
    if (!Number.isFinite(value)) throw new DslDiagnosticError(`'${token.value}' is not a finite number`, token.line, token.column);
    return value;
  }
  endLine(): void {
    if (this.current().kind !== 'newline' && this.current().kind !== 'eof') {
      const token = this.current(); throw new DslDiagnosticError(`Unexpected token '${token.value}'`, token.line, token.column);
    }
    while (this.current().kind === 'newline') this.take();
  }
}

export function parseDsl(source: string): CanvasAst {
  const parser = new Parser(source);
  const ast: CanvasAst = { direction: 'LR', statements: [] };
  const ids = new Map<string, Token>();
  while (parser.current().kind !== 'eof') {
    if (parser.current().kind === 'newline') { parser.take(); continue; }
    const keyword = parser.word();
    if (keyword.value === 'title') { ast.title = parser.text(); parser.endLine(); continue; }
    if (keyword.value === 'direction') {
      const direction = parser.word();
      if (!['LR', 'RL', 'TB', 'BT'].includes(direction.value)) throw new DslDiagnosticError('Direction must be LR, RL, TB, or BT', direction.line, direction.column);
      ast.direction = direction.value as DslDirection; parser.endLine(); continue;
    }
    if (keyword.value === 'node' || keyword.value === 'frame') {
      const id = parser.word();
      if (ids.has(id.value)) throw new DslDiagnosticError(`Duplicate id '${id.value}'`, id.line, id.column);
      ids.set(id.value, id);
      const shape = keyword.value === 'frame' ? 'frame' : parser.word().value;
      const node: DslNode = { kind: 'node', id: id.value, shape, label: parser.text(), location: { line: keyword.line, column: keyword.column } };
      while (parser.current().kind !== 'newline' && parser.current().kind !== 'eof') {
        const property = parser.word();
        if (property.value === 'at') { node.x = parser.number(); parser.take('comma'); node.y = parser.number(); }
        else if (property.value === 'size') { node.width = parser.number(); parser.take('comma'); node.height = parser.number(); }
        else if (property.value === 'fill') node.fill = parser.text();
        else if (property.value === 'in') node.parentId = parser.word().value;
        else throw new DslDiagnosticError(`Unknown node property '${property.value}'`, property.line, property.column);
      }
      ast.statements.push(node); parser.endLine(); continue;
    }
    if (keyword.value === 'edge') {
      const id = parser.word();
      if (ids.has(id.value)) throw new DslDiagnosticError(`Duplicate id '${id.value}'`, id.line, id.column);
      ids.set(id.value, id);
      const from = parser.word(); parser.take('arrow'); const to = parser.word();
      const edge: DslEdge = { kind: 'edge', id: id.value, from: from.value, to: to.value, label: parser.current().kind === 'string' ? parser.take().value : '', location: { line: keyword.line, column: keyword.column } };
      ast.statements.push(edge); parser.endLine(); continue;
    }
    throw new DslDiagnosticError(`Unknown statement '${keyword.value}'`, keyword.line, keyword.column);
  }
  const nodeIds = new Set(ast.statements.filter((value): value is DslNode => value.kind === 'node').map(({ id }) => id));
  ast.statements.forEach((statement) => {
    if (statement.kind === 'node' && statement.parentId && !nodeIds.has(statement.parentId)) throw new DslDiagnosticError(`Unknown parent '${statement.parentId}'`, statement.location.line, statement.location.column);
    if (statement.kind === 'edge' && (!nodeIds.has(statement.from) || !nodeIds.has(statement.to))) throw new DslDiagnosticError(`Edge '${statement.id}' references an unknown node`, statement.location.line, statement.location.column);
  });
  return ast;
}
