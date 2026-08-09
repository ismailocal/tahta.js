# tahta.js

Typed, framework-independent collaborative canvas engine with DOM and React adapters.

```ts
import { createBuiltinShapeRegistry, createCanvasEngine } from 'tahta.js/core';
import { mountCanvas } from 'tahta.js/dom';

const engine = createCanvasEngine({
  documentId: 'board-id',
  registry: createBuiltinShapeRegistry(),
});

const view = mountCanvas({ root: document.querySelector('#canvas')!, engine });

// Every persistent mutation uses the command boundary.
engine.dispatch({ type: 'document.update', patch: { title: 'Architecture' } });

view.destroy();
engine.destroy();
```

React consumers can use `CanvasWorkspace` for the complete product UI or `TahtaCanvas` for the canvas surface alone. Imports and plugins are validated; unknown shapes and unsupported exports raise explicit errors.

## Package boundaries

- `tahta.js/core`: V2 document schema, command dispatcher, Yjs state, registry, geometry and exports.
- `tahta.js/dom`: instance-scoped canvas renderer, input handling and lifecycle.
- `tahta.js/react`: React adapters and the complete workspace UI.
- `tahta.js/dsl`: quote-aware DSL/Mermaid parsing and validated V2 import plans.
- `tahta.js/styles.css`: the explicit stylesheet entry point.

Document mutations must use `engine.dispatch()`. Selection, viewport, cursors,
reactions and presenter-follow state are session or awareness state and are not
stored in the document snapshot. Call both `view.destroy()` and
`engine.destroy()` when unmounting a non-React consumer.

## Release validation

```sh
npm run check:release
```

The release gate runs lint, strict type checking, unit and CRDT tests, unused
file/export/dependency analysis, the ESM and declaration build, coverage
thresholds, a package-consumer type fixture, and Chromium accessibility and
ELK/DSL smoke tests. The browser fixture uses axe-core against WCAG 2, 2.1 and
2.2 A/AA tags.
