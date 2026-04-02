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

### 🗄️ Technical Modeling (ERD & DB)
Built-in support for Database and System modeling:
- **Table Plugin**: Manages complex data objects with columns, types, and constraints (PK/FK).
- **View & Enum Plugins**: Specialized visualizations for data architecture.
- **Template Tool**: Instant scaffolding for Decision Trees, Flowcharts, and Mind Maps.

---

## 🏗️ Architecture Deep Dive

Tahta.js follows a strictly decoupled architecture inspired by **Clean Architecture** and **Event-Driven** patterns.

### 1. Communication Layer
- **EventBus**: A type-agnostic internal bus for low-latency notifications (e.g., "SelectionChanged", "CanvasResized").
- **CommandBus**: Handles the execution of encapsulated canvas actions, allowing for easy auditing and macro recording.
- **InputManager**: The gateway for browser events. It normalizes `Pointer`, `Touch`, and `Wheel` events into "World Space" coordinates, accounting for viewport panning and zoom.

### 2. State Engine (`src/core/`)
- **WhiteboardStore**: The single source of truth. Uses a subscription model to notify the renderer and UI components of state changes.
- **Spatial Indexing (Quadtree)**: Every shape is registered in a high-performance Quadtree. This allows the renderer to only process shapes currently in the viewport (O(log n) complexity), enabling smooth interaction even with 10k+ objects.

### 3. Rendering Pipeline
- **Dual-Canvas Strategy**: Uses a static off-screen canvas to cache non-moving background elements, combined with a dynamic main canvas for real-time interaction (active dragging, selection boxes).
- **Plugin-Driven Rendering**: The core renderer doesn't know how to draw a "Rectangle" or an "Arrow". It delegates the task to the registered **Plugin** for that shape type.

---

## 🔌 Plugin System & Extensibility

Tahta.js is 90% built from plugins. If you want to add a new feature, you write a plugin.

### Plugin Anatomy
A plugin defines the behavior, rendering, and UI properties of a feature:

```typescript
export interface Plugin {
  readonly manifest: {
    id: string;          // Unique ID (e.g., 'my-custom-shape')
    name: string;
    capabilities: PluginCapability[]; // ['shape', 'tool', 'shortcut']
  };

  // Lifecycle Hooks
  register(ctx: PluginContext): void;  // Called on app initialization
  activate(): void;                    // Called when the tool/shape is selected
  deactivate(): void;
  dispose(): void;                     // Cleanup

  // UI & Tool Hooks
  getToolbarItems?(): ToolbarItem[];
  getCommands?(): CommandDefinition[];
  getShortcuts?(): ShortcutDefinition[];
}
```

### Core Plugins Included
- **Shape Plugins**: `Rectangle`, `Ellipse`, `Diamond`, `Text`, `Image`.
- **Connector Plugins**: `Line`, `Arrow` (with support for sub-styles).
- **Technical Plugins**: `DbTable`, `DbView`, `DbEnum`.
- **Drawing Plugins**: `Freehand` (with Highlighter and Thick Pen modes).

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
| **Cmd/Ctrl + Z** | Undo | Step backward in history |
| **Cmd/Ctrl + Y** | Redo | Step forward in history |
| **Alt + S** | Export | JSON export to console/file |
| **Space (Hold)** | Quick Pan | Temporarily switch to Hand tool |

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

// Listen to specific events
bus.on('selection:changed', (ids) => console.log('Selected:', ids));
```

---

## 📜 Technical Compliance
- **Zero External UI Dependencies**: Pure HTML/CSS for UI overlays.
- **Engine-Only Architecture**: Can be wrapped in React, Vue, or used with Vanilla JS.
- **TypeScript First**: 100% type safety for both state and plugins.

---

Developed with ❤️ by [ismailocal](https://github.com/ismailocal)
