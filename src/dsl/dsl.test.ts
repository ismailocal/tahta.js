import { describe, expect, it } from 'vitest';
import { createBuiltinShapeRegistry } from '../shapes';
import { astToImportPlan } from './importPlan';
import { parseMermaid } from './mermaid';
import { parseDsl } from './parser';
import { serializeDsl } from './serializer';

describe('Tahta DSL V2', () => {
  it('is quote-aware, ELK-laid out, and parse-serialize stable', async () => {
    const source = 'title "A \\"quoted\\" board"\ndirection TB\nnode a rectangle "Hello, world" at 10,20 size 180,80\nnode b diamond "Ready?"\nedge e a -> b "yes"\n';
    const first = parseDsl(source); const canonical = serializeDsl(first); expect(serializeDsl(parseDsl(canonical))).toBe(canonical);
    const plan = await astToImportPlan(first, createBuiltinShapeRegistry()); expect(plan.commands).toHaveLength(5);
    const created = plan.commands.filter((command) => command.type === 'shape.create').map((command) => command.record);
    expect(created.find(({ id }) => id === 'a')).toMatchObject({ x: 10, y: 20 }); expect(created.find(({ id }) => id === 'b')?.x).not.toBe(0);
  });

  it('returns actionable line and column diagnostics', () => {
    expect(() => parseDsl('direction LR\nnode a rectangle "unterminated')).toThrow(/2:18/u);
  });

  it('rejects executable Mermaid directives before invoking the converter', async () => {
    await expect(parseMermaid('flowchart LR\nclick A "javascript:alert(1)"')).rejects.toThrow('not supported');
    await expect(parseMermaid('flowchart LR\n%%{init: {"securityLevel":"loose"}}%%\nA-->B')).rejects.toThrow('not supported');
  });
});
