import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?inline';
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff2?inline';
import interItalic from '@fontsource/inter/files/inter-latin-400-italic.woff2?inline';
import interBoldItalic from '@fontsource/inter/files/inter-latin-700-italic.woff2?inline';

const exportFonts = [
  { source: interRegular, weight: '400', style: 'normal' },
  { source: interBold, weight: '700', style: 'normal' },
  { source: interItalic, weight: '400', style: 'italic' },
  { source: interBoldItalic, weight: '700', style: 'italic' },
] as const;

export function embeddedExportFontCss(): string {
  return exportFonts.map(({ source, weight, style }) => `@font-face{font-family:'Inter';src:url('${source}') format('woff2');font-weight:${weight};font-style:${style};font-display:block;}`).join('');
}

let browserFonts: Promise<void> | null = null;

export function ensureBrowserExportFonts(): Promise<void> {
  if (browserFonts) return browserFonts;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
    return Promise.reject(new Error('Browser font loading APIs are unavailable'));
  }
  browserFonts = Promise.all(exportFonts.map(async ({ source, weight, style }) => {
    const font = new FontFace('Inter', `url('${source}')`, { weight, style });
    document.fonts.add(await font.load());
  })).then(() => undefined).catch((error: unknown) => {
    browserFonts = null;
    throw error;
  });
  return browserFonts;
}
