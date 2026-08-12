import { describe, expect, it } from 'vitest';
import { resolveCanvasBackground } from './Renderer';
import { RENDERING_CONSTANTS } from './RenderingConstants';

describe('resolveCanvasBackground', () => {
  it('uses the active theme for the built-in canvas palette', () => {
    expect(resolveCanvasBackground('light', RENDERING_CONSTANTS.THEME_LIGHT_BG))
      .toBe(RENDERING_CONSTANTS.THEME_LIGHT_BG);
    expect(resolveCanvasBackground('dark', RENDERING_CONSTANTS.THEME_LIGHT_BG))
      .toBe(RENDERING_CONSTANTS.THEME_DARK_BG);
    expect(resolveCanvasBackground('light', RENDERING_CONSTANTS.THEME_DARK_BG))
      .toBe(RENDERING_CONSTANTS.THEME_LIGHT_BG);
    expect(resolveCanvasBackground('dark', RENDERING_CONSTANTS.THEME_DARK_BG))
      .toBe(RENDERING_CONSTANTS.THEME_DARK_BG);
  });

  it('defaults to the light theme when no theme or background is available', () => {
    expect(resolveCanvasBackground(undefined, undefined))
      .toBe(RENDERING_CONSTANTS.THEME_LIGHT_BG);
  });

  it('preserves a custom document background in every theme', () => {
    expect(resolveCanvasBackground('light', '#abcdef')).toBe('#abcdef');
    expect(resolveCanvasBackground('dark', '#abcdef')).toBe('#abcdef');
  });
});
