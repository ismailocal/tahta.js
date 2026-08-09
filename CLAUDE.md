# tahta.js contributor guide

`tahta.js` is a typed ESM workspace package. It has one V2 document model and
one Yjs document source of truth; there is no legacy state adapter.

## Commands

```bash
npm run check:release
```

The release gate covers ESLint, strict TypeScript, unit/CRDT/offline tests,
coverage, knip, library and declaration builds, a package-consumer type fixture,
Chromium E2E, WCAG checks, real raster/PDF export, Mermaid conversion and the
10k/50k performance fixtures.

## Boundaries

- `src/core`: V2 schema, Yjs engine, commands, geometry, registry, import/export.
- `src/dom`: instance-scoped canvas renderer, spatial index, pointer/keyboard lifecycle.
- `src/react`: React adapters and full workspace UI.
- `src/dsl`: tokenizer, AST, parser, serializer, official Mermaid conversion and V2 ImportPlan.
- `src/shapes`: built-in `ShapeDefinition` values.

All persistent mutations go through `engine.dispatch(command)`. Selection,
viewport, cursor, presenter-follow and reactions are view/awareness state. Do
not add a second mutable scene store, a legacy decoder, a generic shape/export
fallback, or side-effect registration.

## Adding a shape

Create one `ShapeDefinition<Props>` containing its Zod schema, defaults,
geometry, canvas renderer and SVG exporter, then register it explicitly in the
built-in registry. A missing exporter or duplicate type is a registration
error. Expose tools/properties/commands on the same definition.

DOM objects, listeners, caches, workers and timers must be owned by an instance
and released by `destroy()`. Keep large optional features behind dynamic imports.
