import type { CanvasAst, DslNode } from './ast.js';

const quote = (value: string) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\t', '\\t')}"`;

export function serializeDsl(ast: CanvasAst): string {
  const lines: string[] = [];
  if (ast.title !== undefined) lines.push(`title ${quote(ast.title)}`);
  lines.push(`direction ${ast.direction}`);
  ast.statements.forEach((statement) => {
    if (statement.kind === 'edge') {
      lines.push(`edge ${statement.id} ${statement.from} -> ${statement.to}${statement.label ? ` ${quote(statement.label)}` : ''}`);
      return;
    }
    const prefix = statement.shape === 'frame' ? `frame ${statement.id}` : `node ${statement.id} ${statement.shape}`;
    const properties = [quote(statement.label)];
    if (statement.x !== undefined && statement.y !== undefined) properties.push(`at ${statement.x},${statement.y}`);
    if (statement.width !== undefined && statement.height !== undefined) properties.push(`size ${statement.width},${statement.height}`);
    if (statement.fill !== undefined) properties.push(`fill ${quote(statement.fill)}`);
    if (statement.parentId !== undefined) properties.push(`in ${statement.parentId}`);
    lines.push(`${prefix} ${properties.join(' ')}`);
  });
  return `${lines.join('\n')}\n`;
}

export function nodesInAst(ast: CanvasAst): DslNode[] {
  return ast.statements.filter((statement): statement is DslNode => statement.kind === 'node');
}
