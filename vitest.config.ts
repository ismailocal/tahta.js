import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/core/CanvasEngine.ts',
        'src/core/CanvasShapeProjection.ts',
        'src/core/CommandPreflight.ts',
        'src/core/model.ts',
        'src/core/registry.ts',
        'src/core/richText.ts',
        'src/core/projection.ts',
        'src/core/transforms.ts',
        'src/core/builtinRegistry.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
