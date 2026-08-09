import { useEffect, useMemo } from 'react';
import { createCanvasEngine, type CanvasEngine, type CanvasEngineConfig } from '../core/index.js';

export * from './TahtaCanvas.js';
export * from './RichTextEditor.js';
export * from './CanvasWorkspace.js';

export function useTahtaEngine(config: CanvasEngineConfig): CanvasEngine {
  const { documentId, registry, initialSnapshot, initialUpdate, document, readonly } = config;
  const engine = useMemo(
    () => createCanvasEngine({ documentId, registry, initialSnapshot, initialUpdate, document }),
    [document, documentId, initialSnapshot, initialUpdate, registry],
  );
  useEffect(() => () => engine.destroy(), [engine]);
  useEffect(() => engine.setReadonly(readonly ?? false), [engine, readonly]);
  return engine;
}
