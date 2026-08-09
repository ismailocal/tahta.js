/** @vitest-environment jsdom */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasEngine } from '../core/index.js';
import type { MountCanvasOptions } from '../dom/index.js';
import { TahtaCanvas } from './TahtaCanvas.js';

const { mountCanvas } = vi.hoisted(() => ({ mountCanvas: vi.fn() }));

vi.mock('../dom/index.js', () => ({ mountCanvas }));

describe('TahtaCanvas', () => {
  it('keeps the imperative canvas mounted when host callbacks change', async () => {
    const view = { destroy: vi.fn() };
    mountCanvas.mockReturnValue(view);
    const engine = {} as CanvasEngine;
    const firstError = vi.fn();
    const nextError = vi.fn();
    const firstResolver = vi.fn().mockResolvedValue('first');
    const nextResolver = vi.fn().mockResolvedValue('next');
    const rendered = render(
      <TahtaCanvas engine={engine} onError={firstError} resolveAssetUrl={firstResolver} />,
    );

    rendered.rerender(
      <TahtaCanvas engine={engine} onError={nextError} resolveAssetUrl={nextResolver} />,
    );

    expect(mountCanvas).toHaveBeenCalledOnce();
    expect(view.destroy).not.toHaveBeenCalled();
    const options = mountCanvas.mock.calls[0]![0] as MountCanvasOptions;
    const error = new Error('render failed');
    options.onError?.(error);
    expect(firstError).not.toHaveBeenCalled();
    expect(nextError).toHaveBeenCalledWith(error);
    await expect(options.resolveAssetUrl?.('asset')).resolves.toBe('next');
    expect(firstResolver).not.toHaveBeenCalled();
    expect(nextResolver).toHaveBeenCalledWith('asset');

    rendered.unmount();
    expect(view.destroy).toHaveBeenCalledOnce();
  });
});
