import type { ICanvasAPI } from '../core/types';

export interface Command<TPayload = unknown> {
  readonly type: string;
  readonly payload: TPayload;
}

export type CommandHandler<T extends Command = Command> = (
  command: T,
  api: ICanvasAPI
) => void | Promise<void>;

export interface ICommandBus {
  execute<T extends Command>(command: T, api: ICanvasAPI): Promise<void>;
  register<T extends Command>(
    type: string,
    handler: CommandHandler<T>
  ): void;
}

export class CommandBus implements ICommandBus {
  private handlers = new Map<string, CommandHandler<any>>();

  async execute<T extends Command>(command: T, api: ICanvasAPI): Promise<void> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`Command handler not found for type: ${command.type}`);
    }
    await handler(command, api);
  }

  register<T extends Command>(
    type: string,
    handler: CommandHandler<T>
  ): void {
    if (this.handlers.has(type)) {
      console.warn(`Overriding existing command handler for type: ${type}`);
    }
    this.handlers.set(type, handler);
  }
}
