import { useEffect, useRef } from 'react';
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
  onError?: (error: Error) => void;
}

export function TahtaCanvas({ engine, className, locale, resolveAssetUrl, onReady, onPointerUpdate, toolbar, onEditRecord, onError }: TahtaCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!rootRef.current) throw new Error('Tahta canvas root is unavailable');
    const view = mountCanvas({ root: rootRef.current, engine, locale, resolveAssetUrl, onPointerUpdate, toolbar, onEditRecord, onError });
    onReady?.(view);
    return () => view.destroy();
  }, [engine, locale, onEditRecord, onError, onPointerUpdate, onReady, resolveAssetUrl, toolbar]);
  return <div ref={rootRef} className={className} />;
}
