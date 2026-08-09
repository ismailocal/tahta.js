import { DslDiagnosticError } from './ast.js';

export type TokenKind = 'word' | 'string' | 'arrow' | 'comma' | 'newline' | 'eof';
export interface Token { kind: TokenKind; value: string; line: number; column: number }

export function tokenizeDsl(source: string): Token[] {
  if (source.length > 200_000) throw new DslDiagnosticError('DSL exceeds 200,000 characters', 1, 1);
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let column = 1;
  const push = (kind: TokenKind, value: string, startLine = line, startColumn = column) => tokens.push({ kind, value, line: startLine, column: startColumn });
  while (index < source.length) {
    const character = source[index]!;
    if (character === '\r') { index++; continue; }
    if (character === '\n') { push('newline', ''); index++; line++; column = 1; continue; }
    if (/\s/u.test(character)) { index++; column++; continue; }
    if (character === '#') {
      while (index < source.length && source[index] !== '\n') { index++; column++; }
      continue;
    }
    if (source.startsWith('->', index)) { push('arrow', '->'); index += 2; column += 2; continue; }
    if (character === ',') { push('comma', ','); index++; column++; continue; }
    if (character === '"') {
      const startLine = line; const startColumn = column; index++; column++;
      let value = '';
      let closed = false;
      while (index < source.length) {
        const current = source[index]!;
        if (current === '\n') throw new DslDiagnosticError('String literal cannot span lines', startLine, startColumn);
        if (current === '"') { closed = true; index++; column++; break; }
        if (current === '\\') {
          const escaped = source[index + 1];
          if (escaped !== '"' && escaped !== '\\' && escaped !== 'n' && escaped !== 't') throw new DslDiagnosticError('Unsupported escape sequence', line, column);
          value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped;
          index += 2; column += 2; continue;
        }
        value += current; index++; column++;
      }
      if (!closed) throw new DslDiagnosticError('Unterminated string literal', startLine, startColumn);
      push('string', value, startLine, startColumn); continue;
    }
    const start = index; const startColumn = column;
    while (index < source.length && !/[\s,#"]/u.test(source[index]!) && !source.startsWith('->', index)) { index++; column++; }
    if (start === index) throw new DslDiagnosticError(`Unexpected character '${character}'`, line, column);
    push('word', source.slice(start, index), line, startColumn);
  }
  push('eof', '');
  return tokens;
}
