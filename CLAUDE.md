# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Build to dist/
npm run preview   # Preview built app
npm start         # Serve with python3 -m http.server 3000
```

```bash
npx vitest            # Run tests
npx vitest run        # Run tests once (CI mode)
```

## Architecture Overview

Tahta.js is a TypeScript/Canvas whiteboard library. The public API is `mountCanvas(root, canvas)` exported from `src/index.ts`, which wires together all subsystems and returns `{ store, bus, destroy }`.

### Core Subsystems (`src/core/`)

- **Store** (`Store.ts`) — Holds the entire `CanvasState` (shapes, selection, viewport, UI flags). Updates via `setState(updater)`. Supports `batchUpdate` to coalesce renders.
- **EventBus** (`src/canvas/EventBus.ts`) — Pub/sub glue between subsystems. Key event: `'document:changed'`.
- **InputManager** (`src/canvas/InputManager.ts`) — Normalizes pointer/keyboard events and dispatches to the active tool.
- **KeyboardManager** (`src/canvas/KeyboardManager.ts`) — Global keyboard shortcut handling (delete, undo/redo, copy/paste, etc.).
- **ClipboardManager** (`src/canvas/ClipboardManager.ts`) — Copy/paste/cut for shapes.
- **CommandBus** (`src/canvas/CommandBus.ts`) — Command pattern for operations that need to be invokable from multiple places (tools, keyboard, UI).
- **Renderer** (`src/rendering/Renderer.ts`) — RAF-driven render loop using a **split static/dynamic layer** strategy: non-selected shapes are cached to an off-screen canvas; selected/moving shapes re-render each frame on top.
- **SpatialIndex** (`src/geometry/SpatialIndex.ts`) — Quadtree (depth=5, 10 shapes/node) for hit-testing. Lazily built, invalidated on state change.
- **HistoryManager** (`src/canvas/HistoryManager.ts`) — 50-item circular buffer. `commit()` at interaction boundaries; undo clears forward history.
- **ShapeManager** (`src/geometry/ShapeManager.ts`) — Shape CRUD, z-order (`zIndex`), reorder commands (`'forward'`, `'backward'`, `'front'`, `'back'`).
- **Geometry** / **GeometryUtils** (`src/geometry/`) — Viewport coordinate transforms (`screenToWorld`, `worldToScreen`), hit testing, bounds calculation.
- **Export** (`src/canvas/Export.ts`) — Canvas export functionality.

### Plugin System (`src/plugins/`)

Shape types are plugins implementing `IShapePlugin`. `ShapeType = string` (open), so adding new types requires no core changes.

Key plugin capabilities:
- **Rendering**: `render()`, `renderSelection()`
- **Geometry**: `getBounds()`, `getHandleAtPoint()`, `isPointInside()`
- **Creation**: `onDrawInit()`, `onDrawUpdate()`
- **Handle dragging**: `onDragHandle()`
- **Arrow binding**: `onDragBindHandle()`, `onBoundShapeChange()`
- **`isConnector?: boolean`** — marks line/arrow types; affects drag-binding detection and text-label background mask
- **`defaultStyle`** — default shape style; used by `ShapeTool` via `getStylePreset(type)` in `constants.ts`
- **`defaultProperties`** — property panel keys; used by `getShapePropertyKeys(type)` in `PropertyConstants.ts`
- **`getTextAnchor?(shape, allShapes): Point | null`** — custom label anchor (connectors return path midpoint; others return null → bounds center used)
- **`getConnectionPoints?(shape): ConnectionPoint[]`** — named ports for arrow binding (e.g. DB table rows); rendered on hover when not selected

Built-in types: `rectangle`, `ellipse`, `diamond`, `line`, `arrow`, `freehand`, `text`, `image`, `db-table`, `db-enum`, `db-view`. Registered at startup via `src/plugins/index.ts`. All shape rendering uses **RoughJS** for hand-drawn style. DB types (`db-table`, `db-enum`, `db-view`) extend `BaseRectPlugin` and have a dedicated editor (`src/canvas/ui/DbTableEditor.ts`).

**Adding a new shape type** (e.g. `db-table`):
1. Create `src/plugins/DbTablePlugin.ts` implementing `IShapePlugin`
2. Set `defaultStyle`, `defaultProperties`, implement `getConnectionPoints` for row-level ports
3. Register in `src/plugins/index.ts`
4. No changes needed in core

**Shape.data field**: Type-specific payload (e.g. `{ columns: [...] }`) lives in `shape.data: Record<string, unknown>`. Included in the render cache hash.

**Binding ports**: `startBinding` / `endBinding` now include optional `portId?: string` (type `ShapeBinding`) for connecting to specific ports.

### Tool System (`src/tools/`)

Tools implement `ToolDefinition` (`onPointerDown/Move/Up`, `onKeyDown`, `onDoubleClick`). They receive the `ICanvasAPI` facade (defined in `src/core/types.ts`) which is the only way tools and UI interact with state. Middle-mouse always activates HandTool regardless of active tool.

### UI (`src/canvas/ui/`)

`UIBuilder` creates all DOM: toolbar, properties panel, text editor overlay. Toolbar items are defined in `src/core/constants.ts`. `PropertiesPanel` dynamically renders based on selected shape type. `TextEditor` handles in-canvas text editing overlay. `DbTableEditor` handles the DB shape column/row editor.

### React Bindings (`src/react/`)

`src/react/index.ts` exports React hooks/components for embedding the canvas in React apps. Hooks are in `src/react/hooks/`.

### Tests

Tests use Vitest (`.test.ts` files). Run with `npx vitest`. Currently coverage: `Store.test.ts`, `HistoryManager.test.ts`.

### Key Conventions

- **Coordinates**: All shapes live in world space. Convert with `screenToWorld`/`worldToScreen` using `state.viewport`.
- **State shape**: `Shape` has `id`, `type`, `zIndex`, `x/y/width/height`, `points[]` (freehand/line/arrow), style props, `startBinding`/`endBinding` (arrows), `groupId`, `locked`.
- **Rendering cache**: Invalidated when viewport, selection, or `isDraggingSelection` changes. Static layer is an off-screen `HTMLCanvasElement`.
- **Adding a new shape type**: Create a plugin in `src/plugins/` implementing `IShapePlugin`, register it in `src/plugins/index.ts`.
