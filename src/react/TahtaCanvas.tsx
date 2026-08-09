import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CanvasEngine } from '../core/index.js';
import { mountCanvas } from '../dom/index.js';

export interface TahtaCanvasProps {
  engine: CanvasEngine;
  className?: string;
  locale?: 'en' | 'tr';
  resolveAssetUrl?: (assetId: string) => string | Promise<string>;
  onReady?: (view: ReturnType<typeof mountCanvas>) => void;
  onPointerUpdate?: (payload: { pointer: { x: number; y: number }; button: 'left' | 'none' | 'up' }) => void;
  toolbar?: boolean;
  onEditRecord?: (recordId: string) => void;
  onPlaceTemplate?: (templateKey: string, world: { x: number; y: number }) => void;
  onError?: (error: Error) => void;
}

export function TahtaCanvas({ engine, className, locale, resolveAssetUrl, onReady, onPointerUpdate, toolbar, onEditRecord, onPlaceTemplate, onError }: TahtaCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ resolveAssetUrl, onReady, onPointerUpdate, onEditRecord, onPlaceTemplate, onError });
  useLayoutEffect(() => {
    callbacksRef.current = { resolveAssetUrl, onReady, onPointerUpdate, onEditRecord, onPlaceTemplate, onError };
  }, [onEditRecord, onError, onPlaceTemplate, onPointerUpdate, onReady, resolveAssetUrl]);

  useEffect(() => {
    if (!rootRef.current) throw new Error('Tahta canvas root is unavailable');
    const view = mountCanvas({
      root: rootRef.current,
      engine,
      locale,
      resolveAssetUrl: (assetId) => callbacksRef.current.resolveAssetUrl?.(assetId) ?? `/api/canvas-assets/${encodeURIComponent(assetId)}`,
      onPointerUpdate: (payload) => callbacksRef.current.onPointerUpdate?.(payload),
      toolbar,
      onEditRecord: (recordId) => callbacksRef.current.onEditRecord?.(recordId),
      onPlaceTemplate: (templateKey, world) => callbacksRef.current.onPlaceTemplate?.(templateKey, world),
      onError: (error) => callbacksRef.current.onError?.(error),
    });
    callbacksRef.current.onReady?.(view);
    return () => view.destroy();
  }, [engine, locale, toolbar]);
  return <div ref={rootRef} className={className} />;
}
