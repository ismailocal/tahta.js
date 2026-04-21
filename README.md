# Tahta.js 🖌️

**Tahta.js** is a high-performance, lightweight, and framework-agnostic whiteboard engine built with TypeScript. It is designed to be the "Engine Room" for modern collaborative drawing and technical modeling applications.

## 🔗 [Live Demo](https://ismailocal.github.io/tahta.js/)

---

## 🚀 Core Capabilities

### 📐 Precision Geometry & Tools
- **Transformation Engine**: High-fidelity selection, rotation, and multi-axis scaling.
- **Advanced Connectors**:
  - **Dynamic Binding**: Shapes automatically "snap" and bind to connection points of other shapes.
  - **Smart Routing**: Support for `Straight`, `Curved`, and **`Elbow` (Orthagonal)** paths. Elbow lines automatically calculate midpoints and avoid overlapping with centers.
  - **Customizable Tips**: Mix and match arrowheads (`Arrow`, `Triangle`, `Circle`, `Diamond`, `Bar`) at both start and end points.
- **Rich Interaction**: Hand-panning, smooth zooming, text editing (with multi-font support), and image management.
- **Deep History**: Unlimited Undo/Redo with state snapshots and versioning.
- **Freehand Drawing**: Powered by `perfect-freehand` for smooth, pressure-sensitive drawing with highlighter and thick pen modes.

### 🗄️ Technical Modeling (ERD & DB)
Built-in support for Database and System modeling:
- **Table Plugin**: Manages complex data objects with columns, types, and constraints (PK/FK).
- **View & Enum Plugins**: Specialized visualizations for data architecture.
- **Template Tool**: Instant scaffolding for Decision Trees, Flowcharts, and Mind Maps.

### 📝 DSL (Domain Specific Language)
Create shapes programmatically using a declarative DSL:
- **Parser**: Convert text-based DSL to shape objects
- **Converter**: Transform DSL to canvas shapes
- **Layout**: Automatic layout algorithms for diagrams
- **Exporter**: Export canvas state to DSL format

```typescript
import { parseDSL, convertToShapes } from 'tahta.js/dsl';

const dsl = `
  rectangle rect1 { x: 100, y: 100, width: 200, height: 100 }
  ellipse ellipse1 { x: 400, y: 150, width: 150, height: 150 }
  arrow arrow1 { from: rect1, to: ellipse1 }
`;

const shapes = convertToShapes(parseDSL(dsl));
```

### � Rendering Engine
- **RoughJS Integration**: Hand-drawn aesthetic for all shapes
- **Dual-Canvas Strategy**: Static layer caching for performance
- **Specialized Renderers**: Separate renderers for grid, overlays, text, and UI components
- **Performance Monitoring**: Built-in FPS and render time tracking

---

## �🏗️ Architecture Deep Dive

Tahta.js follows a strictly decoupled architecture inspired by **Clean Architecture** and **Event-Driven** patterns.

### 1. Communication Layer
- **EventBus**: A type-agnostic internal bus for low-latency notifications (e.g., "SelectionChanged", "CanvasResized").
- **CommandBus**: Handles the execution of encapsulated canvas actions, allowing for easy auditing and macro recording.
- **InputManager**: The gateway for browser events. It normalizes `Pointer`, `Touch`, and `Wheel` events into "World Space" coordinates, accounting for viewport panning and zoom.
- **KeyboardManager**: Global keyboard shortcut handling (delete, undo/redo, copy/paste).
- **ClipboardManager**: Copy/paste/cut for shapes.

### 2. State Engine (`src/core/`)
- **WhiteboardStore**: The single source of truth. Uses a subscription model to notify the renderer and UI components of state changes.
- **Spatial Indexing (Quadtree)**: Every shape is registered in a high-performance Quadtree. This allows the renderer to only process shapes currently in the viewport (O(log n) complexity), enabling smooth interaction even with 10k+ objects.
- **HistoryManager**: 50-item circular buffer for undo/redo with state snapshots.

### 3. Rendering Pipeline (`src/rendering/`)
- **Dual-Canvas Strategy**: Uses a static off-screen canvas to cache non-moving background elements, combined with a dynamic main canvas for real-time interaction (active dragging, selection boxes).
- **Plugin-Driven Rendering**: The core renderer doesn't know how to draw a "Rectangle" or an "Arrow". It delegates the task to the registered **Plugin** for that shape type.
- **Specialized Renderers**:
  - `GridRenderer`: Infinite grid with customizable spacing
  - `OverlayRenderer`: Selection boxes, connection points, handles
  - `TextRenderer`: Multi-font text rendering
  - `UIComponentsRenderer`: Toolbar, property panels, editors

### 4. Geometry Engine (`src/geometry/`)
- **Spatial Index**: Quadtree for efficient hit-testing
- **ShapeManager**: Shape CRUD and z-order management
- **ViewportUtils**: Screen-to-world coordinate transformations
- **ArrowheadUtils**: Custom arrowhead rendering
- **ElbowRouter**: Orthogonal line routing algorithm
- **lineUtils**: Line intersection and calculation utilities

---

## 🔌 Plugin System & Extensibility

Tahta.js is 90% built from plugins. If you want to add a new feature, you write a plugin.

### Plugin Anatomy
A plugin defines the behavior, rendering, and UI properties of a feature:

```typescript
export interface IShapePlugin {
  readonly type: string;
  readonly isConnector?: boolean;
  readonly defaultStyle?: ShapeStyle;
  readonly defaultProperties?: string[];

  // Lifecycle
  render(ctx: CanvasRenderingContext2D, shape: Shape): void;
  renderSelection(ctx: CanvasRenderingContext2D, shape: Shape): void;

  // Geometry
  getBounds(shape: Shape): Bounds;
  isPointInside(shape: Shape, point: Point): boolean;
  getHandleAtPoint(shape: Shape, point: Point): Handle | null;

  // Creation
  onDrawInit?(point: Point): Partial<Shape>;
  onDrawUpdate?(shape: Partial<Shape>, point: Point): Partial<Shape>;

  // Handles
  onDragHandle?(shape: Shape, handle: Handle, delta: Point): Partial<Shape>;

  // Binding (for connectors)
  onDragBindHandle?(shape: Shape, handle: Handle, delta: Point): Partial<Shape>;
  onBoundShapeChange?(shape: Shape, boundShape: Shape): Partial<Shape>;

  // Advanced
  getConnectionPoints?(shape: Shape): ConnectionPoint[];
  getTextAnchor?(shape: Shape, allShapes: Shape[]): Point | null;
}
```

### Core Plugins Included
- **Shape Plugins**: `Rectangle`, `Ellipse`, `Diamond`, `Triangle`, `Text`, `Image`, `StickyNote`.
- **Connector Plugins**: `Line`, `Arrow` (with support for sub-styles).
- **Technical Plugins**: `DbTable`, `DbView`, `DbEnum`.
- **Drawing Plugins**: `Freehand` (with Highlighter and Thick Pen modes).

### Adding a New Plugin
```typescript
import { IShapePlugin, registerPlugin } from 'tahta.js';

class MyCustomPlugin implements IShapePlugin {
  readonly type = 'my-custom-shape';

  render(ctx: CanvasRenderingContext2D, shape: Shape): void {
    // Your rendering logic
  }

  getBounds(shape: Shape): Bounds {
    // Return shape bounds
  }

  // ... implement required methods
}

registerPlugin(new MyCustomPlugin());
```

---

## ⚛️ React Integration

Tahta.js provides first-class React support through dedicated hooks and components:

```typescript
import { useTahtaCanvas, TahtaCanvas } from 'tahta.js/react';

function MyWhiteboard() {
  const { store, bus } = useTahtaCanvas({
    theme: 'dark',
    zoom: 1.0,
    shapes: []
  });

  return <TahtaCanvas store={store} bus={bus} />;
}
```

Available hooks:
- `useTahtaCanvas`: Initialize and manage canvas instance
- `useCanvasState`: Subscribe to canvas state changes
- `useSelection`: Track selected shapes
- `useViewport`: Monitor viewport transformations

---

## 🧪 Testing

Tahta.js uses **Vitest** for unit testing:

```bash
npm test              # Run tests in watch mode
npx vitest run        # Run tests once (CI mode)
```

Test coverage includes:
- Store state management
- History manager (undo/redo)
- Plugin rendering
- Geometry calculations

---

## ⌨️ Shortcuts & Developer API

### Shortcuts Table
| Key | Command | Note |
| :--- | :--- | :--- |
| **V** | Select | Select and move shapes |
| **H** | Hand | Pan the canvas |
| **R** / **E** / **D** | Shapes | Rectangle, Ellipse, Diamond |
| **L** / **A** | Lines | Line, Arrow (Standard) |
| **P** | Pen | Freehand drawing |
| **T** | Text | Add/Edit text |
| **X** | Eraser | Remove shapes by hovering |
| **Delete/Backspace** | Delete | Remove selected shapes |
| **Cmd/Ctrl + Z** | Undo | Step backward in history |
| **Cmd/Ctrl + Y** | Redo | Step forward in history |
| **Cmd/Ctrl + C** | Copy | Copy selected shapes |
| **Cmd/Ctrl + V** | Paste | Paste from clipboard |
| **Cmd/Ctrl + X** | Cut | Cut selected shapes |
| **Alt + S** | Export | JSON export to console/file |
| **Space (Hold)** | Quick Pan | Temporarily switch to Hand tool |
| **Middle Mouse** | Quick Pan | Always activates Hand tool |

### Initialization API
```typescript
import { mountCanvas } from 'tahta.js';

const { store, bus, destroy } = mountCanvas(root, canvas, {
  theme: 'dark',
  zoom: 1.0,
  shapes: [] // Initial data
});

// Programmatic control via CommandBus
bus.execute('ChangeTool', { tool: 'arrow-elbow' });
bus.execute('AddShape', { shape: { type: 'rectangle', x: 100, y: 100 } });

// Listen to specific events
bus.on('selection:changed', (ids) => console.log('Selected:', ids));
bus.on('document:changed', () => console.log('Canvas changed'));

// Direct state access
const state = store.getState();
const selectedShapes = state.shapes.filter(s => state.selection.includes(s.id));

// Cleanup
destroy();
```

### DSL API
```typescript
import { parseDSL, convertToShapes, exportToDSL } from 'tahta.js/dsl';

// Parse DSL to shapes
const dsl = `
  rectangle rect1 { x: 100, y: 100, width: 200, height: 100, fill: "#f0f0f0" }
  ellipse ellipse1 { x: 400, y: 150, width: 150, height: 150 }
  arrow arrow1 { from: rect1, to: ellipse1, style: "elbow" }
`;

const shapes = convertToShapes(parseDSL(dsl));

// Export shapes to DSL
const exportedDSL = exportToDSL(shapes);
```

---

## 📜 Technical Compliance
- **Zero External UI Dependencies**: Pure HTML/CSS for UI overlays.
- **Framework Agnostic**: Can be wrapped in React, Vue, Svelte, or used with Vanilla JS.
- **TypeScript First**: 100% type safety for both state and plugins.
- **Performance Optimized**: Quadtree spatial indexing, dual-canvas rendering, RAF loop.
- **Test Coverage**: Vitest integration with comprehensive unit tests.

---

## 📦 Dependencies

### Runtime
- **perfect-freehand**: Smooth freehand drawing
- **roughjs**: Hand-drawn aesthetic rendering
- **mermaid**: Diagram integration (optional)

### Development
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Vitest**: Testing framework
- **gh-pages**: GitHub Pages deployment

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/ismailocal/tahta.js.git
cd tahta.js

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

---

## 📄 License

MIT License - see LICENSE file for details
