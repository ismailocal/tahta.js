import type { CanvasEngine } from './CanvasEngine.js';
import { CanvasValidationError } from './model.js';

export interface CommandContext { engine: CanvasEngine }
export interface CommandDefinition {
  id: string;
  label: string;
  keywords?: readonly string[];
  shortcut?: string;
  enabled?(context: CommandContext): boolean;
  execute(context: CommandContext): void | Promise<void>;
}

function normalizeShortcut(value: string): string {
  const parts = value.toLowerCase().split('+').map((part) => part.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) throw new CanvasValidationError('A command shortcut requires a key', 'INVALID_SHORTCUT');
  const modifiers = new Set(parts.map((part) => part === 'ctrl' || part === 'cmd' ? 'mod' : part));
  return [...['mod', 'shift', 'alt'].filter((part) => modifiers.has(part)), key].join('+');
}

function fuzzyScore(query: string, text: string): number {
  const needle = query.toLocaleLowerCase(); const haystack = text.toLocaleLowerCase();
  if (!needle) return 1;
  const exact = haystack.indexOf(needle); if (exact >= 0) return 10_000 - exact;
  let cursor = 0; let score = 0;
  for (const character of needle) {
    const position = haystack.indexOf(character, cursor); if (position < 0) return 0;
    score += position === cursor ? 8 : Math.max(1, 5 - (position - cursor)); cursor = position + 1;
  }
  return score;
}

export class CommandRegistry {
  readonly #commands = new Map<string, CommandDefinition>();
  readonly #shortcuts = new Map<string, string>();
  register(command: CommandDefinition): () => void {
    if (!command.id.trim() || !command.label.trim()) throw new CanvasValidationError('Commands require an id and label');
    if (this.#commands.has(command.id)) throw new CanvasValidationError(`Command '${command.id}' is already registered`, 'DUPLICATE_COMMAND');
    const shortcut = command.shortcut ? normalizeShortcut(command.shortcut) : undefined;
    if (shortcut && this.#shortcuts.has(shortcut)) throw new CanvasValidationError(`Shortcut '${shortcut}' conflicts with '${this.#shortcuts.get(shortcut)}'`, 'SHORTCUT_CONFLICT');
    this.#commands.set(command.id, { ...command, shortcut });
    if (shortcut) this.#shortcuts.set(shortcut, command.id);
    return () => { this.#commands.delete(command.id); if (shortcut) this.#shortcuts.delete(shortcut); };
  }
  list(context: CommandContext): readonly CommandDefinition[] { return [...this.#commands.values()].filter((command) => command.enabled?.(context) ?? true); }
  search(query: string, context: CommandContext): readonly CommandDefinition[] {
    return this.list(context).map((command) => ({ command, score: fuzzyScore(query, [command.label, command.id, ...(command.keywords ?? [])].join(' ')) }))
      .filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label)).map(({ command }) => command);
  }
  getByShortcut(shortcut: string): CommandDefinition | undefined { const id = this.#shortcuts.get(normalizeShortcut(shortcut)); return id ? this.#commands.get(id) : undefined; }
  execute(id: string, context: CommandContext): void | Promise<void> {
    const command = this.#commands.get(id); if (!command) throw new CanvasValidationError(`Command '${id}' is not registered`, 'COMMAND_NOT_FOUND');
    if (command.enabled && !command.enabled(context)) throw new CanvasValidationError(`Command '${id}' is disabled`, 'COMMAND_DISABLED');
    return command.execute(context);
  }
}

export function keyboardShortcut(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('mod');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');
  parts.push(event.key.toLowerCase());
  return parts.join('+');
}
