import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { generateKeyBetween } from "fractional-indexing";
import {
  applyAutoLayout,
  applyCsvToTable,
  applyStickyClusters,
  buildNavigatorTree,
  CanvasSearchIndex,
  CommandRegistry,
  compareFractionalIndex,
  createClipboardPayload,
  exportCanvas,
  getWorldTransform,
  groupSelection,
  keyboardShortcut,
  parseClipboardPayload,
  parseCsv,
  pasteClipboardPayload,
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableRow,
  plainText,
  previewAutoLayout,
  previewStickyClusters,
  quickCreate,
  resizeTableColumn,
  richTextFromString,
  ungroupSelection,
  ROOT_PARENT_ID,
  serializeClipboardPayload,
  TAHTA_CLIPBOARD_MIME,
  type AssetRecord,
  type CanvasEngine,
  type CanvasSnapshotV2,
  type CanvasViewState,
  type ExportFormat,
  type ExportScope,
  type LayoutAlignment,
  type LayoutDirection,
  type LayoutPreview,
  type ShapeRecord,
  type StickyCluster,
} from "../core/index.js";
import {
  applyImportPlan,
  astToImportPlan,
  parseDsl,
  parseMermaid,
  isMermaidSource,
  type ImportPlanV2,
} from "../dsl/index.js";
import type { CanvasView } from "../dom/index.js";
import { RichTextEditor } from "./RichTextEditor.js";
import { TahtaCanvas, type TahtaCanvasProps } from "./TahtaCanvas.js";

interface LinkMetadata {
  url: string;
  title: string;
  description: string;
  siteName: string;
  fetchedAt: number;
  imageAsset: AssetRecord | null;
  faviconAsset: AssetRecord | null;
  warnings: string[];
}
export interface CanvasWorkspaceProps
  extends Omit<TahtaCanvasProps, "toolbar" | "onEditRecord"> {
  fetchLinkMetadata?: (url: string, refresh: boolean) => Promise<LinkMetadata>;
  uploadAsset?: (file: File) => Promise<AssetRecord>;
  onPresentationFrameChange?: (frameId: string | null) => void;
  statusContent?: ReactNode;
  onError?: (error: Error) => void;
}

type CanvasIconName =
  | "select" | "hand" | "rectangle" | "ellipse" | "diamond" | "triangle"
  | "sticky-note" | "frame" | "text" | "line" | "arrow" | "freehand"
  | "layers" | "layout" | "present" | "import" | "link" | "export"
  | "command" | "fit" | "minus" | "plus";

function CanvasIcon({ name }: { name: CanvasIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let content: ReactNode;
  switch (name) {
    case "select": content = <path d="m5 3 13 9-6 1.5-3.5 5.5z" />; break;
    case "hand": content = <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10 5.5a1.5 1.5 0 0 1 3 0V10 7a1.5 1.5 0 0 1 3 0v4-2a1.5 1.5 0 0 1 3 0v4c0 5-3 8-7 8-3.5 0-5.5-2-7-5l-2-3a1.6 1.6 0 0 1 2.6-1.8L7 13" />; break;
    case "rectangle": content = <rect x="4" y="5" width="16" height="14" rx="2" />; break;
    case "ellipse": content = <ellipse cx="12" cy="12" rx="8" ry="7" />; break;
    case "diamond": content = <path d="m12 3 9 9-9 9-9-9z" />; break;
    case "triangle": content = <path d="m12 4 9 16H3z" />; break;
    case "sticky-note": content = <><path d="M5 3h14v12l-5 6H5z" /><path d="M14 21v-6h5" /></>; break;
    case "frame": content = <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><rect x="8" y="8" width="8" height="8" rx="1" /></>; break;
    case "text": content = <><path d="M5 5h14M12 5v14M8 19h8" /></>; break;
    case "line": content = <path d="M4 20 20 4" />; break;
    case "arrow": content = <><path d="M4 20 20 4" /><path d="M12 4h8v8" /></>; break;
    case "freehand": content = <path d="M4 17c3-8 5-10 7-8s-4 8-1 9 5-8 7-6-1 7 3 7" />; break;
    case "layers": content = <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>; break;
    case "layout": content = <><rect x="3" y="4" width="6" height="5" rx="1" /><rect x="15" y="15" width="6" height="5" rx="1" /><path d="M9 6.5h4a4 4 0 0 1 4 4V15M14 12l3 3 3-3" /></>; break;
    case "present": content = <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="m10 8 5 2.5-5 2.5zM12 17v4M8 21h8" /></>; break;
    case "import": content = <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></>; break;
    case "link": content = <><path d="m9 15-2 2a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" /><path d="m15 9 2-2a3.5 3.5 0 1 1 5 5l-3 3a3.5 3.5 0 0 1-5 0M8 12h8" /></>; break;
    case "export": content = <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>; break;
    case "command": content = <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />; break;
    case "fit": content = <><circle cx="12" cy="12" r="3" /><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /></>; break;
    case "minus": content = <path d="M5 12h14" />; break;
    case "plus": content = <path d="M12 5v14M5 12h14" />; break;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>{content}</svg>;
}

function FocusDialog({
  label,
  children,
  onClose,
}: {
  label: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    if (root && !root.contains(document.activeElement)) {
      root.querySelector<HTMLElement>("button,input,textarea,select")?.focus();
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const focusable = [
        ...root.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="tahta-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="tahta-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

function flattenTree(
  nodes: ReturnType<typeof buildNavigatorTree>,
  depth = 0,
): { record: ShapeRecord; depth: number }[] {
  return nodes.flatMap((node) => [
    { record: node.record, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function frameThumbnailSignatures(snapshot: CanvasSnapshotV2): ReadonlyMap<string, string> {
  const children = new Map<string, ShapeRecord[]>();
  snapshot.records.forEach((record) => { const list = children.get(record.parentId) ?? []; list.push(record); children.set(record.parentId, list); });
  return new Map(snapshot.document.presentation.frameIds.map((frameId) => {
    const ids = new Set<string>(); const queue = [frameId];
    while (queue.length) { const id = queue.shift()!; if (ids.has(id)) continue; ids.add(id); (children.get(id) ?? []).forEach(({ id: childId }) => queue.push(childId)); }
    const records = snapshot.records.filter(({ id }) => ids.has(id));
    const bindings = snapshot.bindings.filter((binding) => ids.has(binding.connectorId));
    const assetIds = new Set<string>();
    records.forEach((record) => { const props = record.props as { assetId?: unknown; imageAssetId?: unknown; faviconAssetId?: unknown }; [props.assetId, props.imageAssetId, props.faviconAssetId].forEach((value) => { if (typeof value === 'string') assetIds.add(value); }); });
    const assets = snapshot.assets.filter((asset) => assetIds.has(asset.id) || assetIds.has(asset.assetId));
    return [frameId, JSON.stringify({ background: snapshot.document.background, records, bindings, assets })] as const;
  }));
}

function FrameThumbnail({ engine, frameId, label, signature, resolveAssetHref, onError }: {
  engine: CanvasEngine;
  frameId: string;
  label: string;
  signature: string;
  resolveAssetHref?: (assetId: string) => string | Promise<string>;
  onError: (error: unknown) => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let generated: string | null = null;
    void exportCanvas(engine, { format: 'svg', scope: { kind: 'frame', frameId }, transparent: false, resolveAssetHref })
      .then((blob) => {
        generated = URL.createObjectURL(blob);
        if (!active) { URL.revokeObjectURL(generated); return; }
        setSource(generated);
      })
      .catch((error: unknown) => { if (active) onError(error); });
    return () => { active = false; if (generated) URL.revokeObjectURL(generated); };
  }, [engine, frameId, onError, resolveAssetHref, signature]);
  return source
    ? <img className="tahta-frame-thumbnail" src={source} alt={`${label} preview`} />
    : <span className="tahta-frame-thumbnail tahta-frame-thumbnail-loading" aria-hidden="true" />;
}

interface EditableTableProps extends Record<string, unknown> {
  columns: { id: string; title: string; width: number }[];
  rows: { id: string; cells: Record<string, string> }[];
  header: boolean;
}

function TableEditor({
  engine,
  record,
  readonly,
  fail,
}: {
  engine: CanvasEngine;
  record: ShapeRecord;
  readonly: boolean;
  fail: (error: unknown) => void;
}) {
  const props = record.props as EditableTableProps;
  const replaceProps = (next: EditableTableProps) => {
    try {
      engine.dispatch({
        type: "shape.update",
        id: record.id,
        patch: { props: next },
      });
    } catch (error) {
      fail(error);
    }
  };
  return (
    <div className="tahta-table-editor">
      <div className="tahta-table-editor-scroll">
        <table>
          <thead>
            <tr>
              <th aria-label="Row controls" />
              {props.columns.map((column, columnIndex) => (
                <th key={column.id} style={{ width: column.width }}>
                  <input
                    aria-label={`Column ${columnIndex + 1} title`}
                    disabled={readonly}
                    value={column.title}
                    onChange={(event) =>
                      replaceProps({
                        ...props,
                        columns: props.columns.map((value) =>
                          value.id === column.id
                            ? { ...value, title: event.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                  <div className="tahta-table-editor-controls">
                    <button
                      type="button"
                      disabled={readonly || columnIndex === 0}
                      aria-label="Move column left"
                      onClick={() =>
                        moveTableColumn(
                          engine,
                          record.id,
                          column.id,
                          props.columns[columnIndex - 1]?.id,
                        )
                      }
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={
                        readonly || columnIndex === props.columns.length - 1
                      }
                      aria-label="Move column right"
                      onClick={() =>
                        moveTableColumn(
                          engine,
                          record.id,
                          column.id,
                          props.columns[columnIndex + 2]?.id,
                        )
                      }
                    >
                      →
                    </button>
                    <input
                      aria-label="Column width"
                      type="number"
                      min={40}
                      max={2000}
                      disabled={readonly}
                      value={column.width}
                      onChange={(event) => {
                        try {
                          resizeTableColumn(
                            engine,
                            record.id,
                            column.id,
                            Number(event.target.value),
                          );
                        } catch (error) {
                          fail(error);
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={readonly}
                      aria-label="Delete column"
                      onClick={() => {
                        try {
                          deleteTableColumn(engine, record.id, column.id);
                        } catch (error) {
                          fail(error);
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th>
                <button
                  type="button"
                  disabled={readonly || props.columns.length >= 100}
                  onClick={() => insertTableColumn(engine, record.id)}
                >
                  + Column
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                <th>
                  <div className="tahta-table-editor-controls">
                    <button
                      type="button"
                      disabled={readonly || rowIndex === 0}
                      aria-label="Move row up"
                      onClick={() =>
                        moveTableRow(
                          engine,
                          record.id,
                          row.id,
                          props.rows[rowIndex - 1]?.id,
                        )
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={readonly || rowIndex === props.rows.length - 1}
                      aria-label="Move row down"
                      onClick={() =>
                        moveTableRow(
                          engine,
                          record.id,
                          row.id,
                          props.rows[rowIndex + 2]?.id,
                        )
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={readonly}
                      aria-label="Delete row"
                      onClick={() => deleteTableRow(engine, record.id, row.id)}
                    >
                      ×
                    </button>
                  </div>
                </th>
                {props.columns.map((column, columnIndex) => (
                  <td key={column.id}>
                    <input
                      aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                      disabled={readonly}
                      value={row.cells[column.id] ?? ""}
                      onChange={(event) => {
                        try {
                          engine.dispatch({
                            type: "table.cell.set",
                            shapeId: record.id,
                            rowId: row.id,
                            columnId: column.id,
                            text: event.target.value,
                          });
                        } catch (error) {
                          fail(error);
                        }
                      }}
                    />
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={readonly || props.rows.length >= 5_000}
        onClick={() => insertTableRow(engine, record.id)}
      >
        + Row
      </button>
    </div>
  );
}

export function CanvasWorkspace({
  engine,
  className,
  locale = "en",
  resolveAssetUrl,
  onReady,
  onPointerUpdate,
  fetchLinkMetadata,
  uploadAsset,
  onPresentationFrameChange,
  statusContent,
  onError,
}: CanvasWorkspaceProps) {
  const [state, setState] = useState<CanvasViewState>(() =>
    engine.getViewState(),
  );
  const [view, setView] = useState<CanvasView | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"dsl" | "mermaid">("dsl");
  const [importSource, setImportSource] = useState(
    'direction LR\nnode start ellipse "Start"\nnode finish rectangle "Finish"\nedge flow start -> finish',
  );
  const [importPreview, setImportPreview] = useState<ImportPlanV2 | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [layoutPreview, setLayoutPreview] = useState<LayoutPreview | null>(
    null,
  );
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutSettings, setLayoutSettings] = useState<{
    scope: "selection" | "frame" | "board";
    frameId: string;
    direction: LayoutDirection;
    alignment: LayoutAlignment;
    spacing: number;
  }>({
    scope: "selection",
    frameId: "",
    direction: "LR",
    alignment: "automatic",
    spacing: 80,
  });
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [layerScroll, setLayerScroll] = useState(0);
  const [message, setMessage] = useState("");
  const [csvPreview, setCsvPreview] = useState<{
    tableId: string;
    rows: string[][];
  } | null>(null);
  const [tableEditorId, setTableEditorId] = useState<string | null>(null);
  const [clusterPreview, setClusterPreview] = useState<StickyCluster[] | null>(
    null,
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<{
    format: ExportFormat;
    scope: ExportScope["kind"];
    frameId: string;
    transparent: boolean;
    scale: number;
  }>({
    format: "png",
    scope: "board",
    frameId: "",
    transparent: false,
    scale: 2,
  });
  const commandRegistry = useMemo(() => new CommandRegistry(), []);
  const toolbarTools = useMemo(() => [
    { id: "tool.select", tool: "select", label: "Select", shortcut: "V" },
    { id: "tool.hand", tool: "hand", label: "Hand", shortcut: "H" },
    ...engine.registry.list().filter((definition) => definition.tool).map((definition) => ({
      id: `tool.${definition.type}`,
      tool: definition.type,
      label: definition.tool!.label,
      shortcut: definition.tool!.shortcut ?? "",
    })),
  ], [engine]);
  const searchIndex = useMemo(() => new CanvasSearchIndex(), []);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const followedFrameRef = useRef<string | null>(null);
  const layoutAbortRef = useRef<AbortController | null>(null);

  const fail = useCallback(
    (value: unknown) => {
      const error = value instanceof Error ? value : new Error(String(value));
      setMessage(error.message);
      onError?.(error);
    },
    [onError],
  );
  useEffect(() => engine.subscribe((value) => value, setState), [engine]);
  useEffect(() => {
    searchIndex.update(state.snapshot.records);
  }, [searchIndex, state.snapshot.records]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5_000);
    return () => clearTimeout(timer);
  }, [message]);

  const ready = useCallback(
    (mounted: CanvasView) => {
      setView(mounted);
      onReady?.(mounted);
    },
    [onReady],
  );
  const setZoom = useCallback((requestedZoom: number) => {
    const current = engine.getViewState().viewport;
    const rect = view?.canvas.getBoundingClientRect();
    const zoom = Math.min(8, Math.max(0.1, requestedZoom));
    if (!rect) {
      engine.setViewState({ viewport: { ...current, zoom } });
      return;
    }
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldX = (centerX - current.x) / current.zoom;
    const worldY = (centerY - current.y) / current.zoom;
    engine.setViewState({ viewport: { x: centerX - worldX * zoom, y: centerY - worldY * zoom, zoom } });
  }, [engine, view]);
  const openLayoutSettings = useCallback(() => {
    const frameId =
      state.snapshot.records.find(({ type }) => type === "frame")?.id ?? "";
    setLayoutSettings((value) => ({
      ...value,
      scope:
        state.selectedIds.length >= 2
          ? "selection"
          : frameId
            ? "frame"
            : "board",
      frameId: value.frameId || frameId,
    }));
    setLayoutOpen(true);
  }, [state.selectedIds.length, state.snapshot.records]);
  const createLayout = useCallback(async () => {
    if (layoutBusy) return;
    const controller = new AbortController();
    layoutAbortRef.current = controller;
    setLayoutBusy(true);
    try {
      const frameId =
        layoutSettings.scope === "frame"
          ? layoutSettings.frameId ||
            state.snapshot.records.find(({ type }) => type === "frame")?.id
          : undefined;
      setLayoutPreview(
        await previewAutoLayout(engine, {
          ...layoutSettings,
          frameId,
          signal: controller.signal,
        }),
      );
      setLayoutOpen(false);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        fail(error);
    } finally {
      if (layoutAbortRef.current === controller) layoutAbortRef.current = null;
      setLayoutBusy(false);
    }
  }, [engine, fail, layoutBusy, layoutSettings, state.snapshot.records]);
  useEffect(() => () => layoutAbortRef.current?.abort(), []);

  const runExport = useCallback(
    async (
      format: ExportFormat,
      options?: { scope?: ExportScope; transparent?: boolean; scale?: number },
    ): Promise<boolean> => {
      try {
        const blob = await exportCanvas(engine, {
          format,
          scope:
            options?.scope ??
            (state.selectedIds.length
              ? { kind: "selection" }
              : { kind: "board" }),
          transparent: options?.transparent,
          scale: options?.scale,
          resolveAssetHref: resolveAssetUrl,
        });
        saveBlob(blob, `tahta.${format === "jpeg" ? "jpg" : format}`);
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    },
    [engine, fail, resolveAssetUrl, state.selectedIds.length],
  );

  const performQuickCreate = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const sourceId = engine.getViewState().selectedIds[0];
      if (!sourceId)
        throw new Error("Select a shape before using Quick Create");
      const result = quickCreate(engine, { sourceId, direction });
      setEditingId(result.shapeId);
    },
    [engine],
  );

  useEffect(() => {
    const disposers: (() => void)[] = [];
    const register = (
      id: string,
      label: string,
      execute: () => void | Promise<void>,
      shortcut?: string,
      keywords?: string[],
    ) =>
      disposers.push(
        commandRegistry.register({
          id,
          label,
          execute,
          shortcut,
          keywords,
          enabled: () =>
            !engine.getViewState().readonly ||
            id.startsWith("view.") ||
            id.startsWith("export.") ||
            id === "tool.select" ||
            id === "tool.hand",
        }),
      );
    const tools = [
      ["select", "Select", "V"],
      ["hand", "Hand", "H"],
      ...engine.registry
        .list()
        .filter((definition) => definition.tool)
        .map(
          (definition) =>
            [
              definition.type,
              definition.tool!.label,
              definition.tool!.shortcut ?? "",
            ] as const,
        ),
    ] as const;
    tools.forEach(([tool, label, shortcut]) =>
      register(`tool.${tool}`, label, () => view?.setTool(tool), shortcut, [
        "tool",
        "draw",
      ]),
    );
    register("edit.undo", "Undo", () => engine.undo(), "Mod+Z");
    register("edit.redo", "Redo", () => engine.redo(), "Mod+Shift+Z");
    register(
      "view.layers",
      "Toggle layers and minimap",
      () => setLayersOpen((value) => !value),
      undefined,
      ["navigator", "search"],
    );
    register(
      "view.presentation",
      "Toggle presentation",
      () => setPresentationOpen((value) => !value),
      undefined,
      ["frames", "present"],
    );
    register(
      "view.export",
      "Export board, selection, or frame",
      () => setExportOpen(true),
      undefined,
      ["download", "PNG", "PDF", "SVG"],
    );
    register("canvas.layout", "Auto layout", openLayoutSettings, undefined, [
      "ELK",
      "arrange",
    ]);
    register("canvas.import", "Import DSL or Mermaid", () =>
      setImportOpen(true),
    );
    register("canvas.cluster", "Cluster sticky notes", () => {
      const clusters = previewStickyClusters(engine);
      if (!clusters.length)
        throw new Error("At least two sticky notes are required");
      setClusterPreview(clusters);
    });
    (["left", "right", "up", "down"] as const).forEach((direction) =>
      register(
        `canvas.quick-create.${direction}`,
        `Quick Create ${direction}`,
        () => performQuickCreate(direction),
        undefined,
        ["connected node", direction],
      ),
    );
    register(
      "canvas.group",
      "Group selection",
      () => {
        groupSelection(engine);
      },
      "Mod+G",
    );
    register(
      "canvas.ungroup",
      "Ungroup selection",
      () => {
        ungroupSelection(engine);
      },
      "Mod+Shift+G",
    );
    register("export.png", "Export PNG", () => void runExport("png"));
    register("export.svg", "Export SVG", () => void runExport("svg"));
    register("export.pdf", "Export PDF", () => void runExport("pdf"));
    register("export.json", "Export V2 JSON", () => void runExport("json"));
    return () => disposers.forEach((dispose) => dispose());
  }, [
    commandRegistry,
    engine,
    openLayoutSettings,
    performQuickCreate,
    runExport,
    view,
  ]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches(
        'input,textarea,[contenteditable="true"]',
      );
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (editing || !view?.canvas.matches(":focus")) return;
      const command = commandRegistry.getByShortcut(keyboardShortcut(event));
      if (command) {
        event.preventDefault();
        void commandRegistry.execute(command.id, { engine });
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [commandRegistry, engine, view]);
  useEffect(() => {
    const buttons = [
      ...(toolbarRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? []),
    ];
    buttons.forEach((button, index) => {
      button.tabIndex = index === 0 ? 0 : -1;
    });
  }, [view]);

  const selected =
    state.selectedIds.length === 1
      ? state.snapshot.records.find(({ id }) => id === state.selectedIds[0])
      : undefined;
  const selectedBounds = useMemo(() => {
    if (!selected || !view) return null;
    const map = new Map(
      state.snapshot.records.map((record) => [record.id, record]),
    );
    const transform = getWorldTransform(selected.id, map);
    const world = { ...selected, ...transform };
    const bounds = engine.registry.get(selected.type).geometry.getBounds(world);
    return {
      left: bounds.x * state.viewport.zoom + state.viewport.x,
      top: bounds.y * state.viewport.zoom + state.viewport.y,
      width: bounds.width * state.viewport.zoom,
      height: bounds.height * state.viewport.zoom,
    };
  }, [engine.registry, selected, state.snapshot.records, state.viewport, view]);
  const layoutGhosts = useMemo(() => {
    if (!layoutPreview) return [];
    const records = new Map(
      state.snapshot.records.map((record) => [
        record.id,
        layoutPreview.positions.has(record.id)
          ? { ...record, ...layoutPreview.positions.get(record.id)! }
          : record,
      ]),
    );
    return [...layoutPreview.positions].flatMap(([id]) => {
      const record = records.get(id);
      if (!record) return [];
      const world = { ...record, ...getWorldTransform(id, records) };
      const bounds = engine.registry.get(record.type).geometry.getBounds(world);
      return [
        {
          id,
          left: bounds.x * state.viewport.zoom + state.viewport.x,
          top: bounds.y * state.viewport.zoom + state.viewport.y,
          width: bounds.width * state.viewport.zoom,
          height: bounds.height * state.viewport.zoom,
        },
      ];
    });
  }, [engine.registry, layoutPreview, state.snapshot.records, state.viewport]);

  const treeRows = useMemo(
    () => flattenTree(buildNavigatorTree(state.snapshot)),
    [state.snapshot],
  );
  const searchRows = useMemo(
    () =>
      search
        ? searchIndex.search(search).map((record) => ({ record, depth: 0 }))
        : treeRows,
    [search, searchIndex, treeRows],
  );
  const rowHeight = 34;
  const visibleStart = Math.max(0, Math.floor(layerScroll / rowHeight) - 3);
  const visibleRows = searchRows.slice(visibleStart, visibleStart + 24);
  const minimap = useMemo(() => {
    const map = new Map(
      state.snapshot.records.map((record) => [record.id, record]),
    );
    const bounds = state.snapshot.records
      .filter(({ hidden }) => !hidden)
      .slice(0, 50_000)
      .map((record) => {
        const world = { ...record, ...getWorldTransform(record.id, map) };
        return {
          id: record.id,
          ...engine.registry.get(record.type).geometry.getBounds(world),
        };
      });
    if (!bounds.length)
      return { minX: 0, minY: 0, scale: 1, items: [] as typeof bounds };
    const minX = Math.min(...bounds.map(({ x }) => x));
    const minY = Math.min(...bounds.map(({ y }) => y));
    const maxX = Math.max(...bounds.map(({ x, width }) => x + width));
    const maxY = Math.max(...bounds.map(({ y, height }) => y + height));
    return {
      minX,
      minY,
      scale: Math.min(
        300 / Math.max(1, maxX - minX),
        94 / Math.max(1, maxY - minY),
      ),
      items: bounds,
    };
  }, [engine.registry, state.snapshot]);
  const moveLayer = useCallback(
    (record: ShapeRecord, direction: -1 | 1) => {
      const siblings = state.snapshot.records
        .filter(({ parentId }) => parentId === record.parentId)
        .sort((left, right) => compareFractionalIndex(left.index, right.index));
      const index = siblings.findIndex(({ id }) => id === record.id);
      if (
        index < 0 ||
        index + direction < 0 ||
        index + direction >= siblings.length
      )
        return;
      const beforeId =
        direction < 0 ? siblings[index - 1]!.id : siblings[index + 2]?.id;
      engine.dispatch({ type: "shape.reorder", id: record.id, beforeId });
    },
    [engine, state.snapshot.records],
  );
  const indentLayer = useCallback(
    (record: ShapeRecord) => {
      const siblings = state.snapshot.records
        .filter(({ parentId }) => parentId === record.parentId)
        .sort((left, right) => compareFractionalIndex(left.index, right.index));
      const index = siblings.findIndex(({ id }) => id === record.id);
      const parent = siblings[index - 1];
      if (!parent || (parent.type !== "frame" && parent.type !== "group"))
        throw new Error("The previous layer is not a frame or group");
      engine.dispatch({
        type: "shape.reparent",
        ids: [record.id],
        parentId: parent.id,
      });
    },
    [engine, state.snapshot.records],
  );
  const outdentLayer = useCallback(
    (record: ShapeRecord) => {
      if (record.parentId === ROOT_PARENT_ID) return;
      const parent = state.snapshot.records.find(
        ({ id }) => id === record.parentId,
      );
      if (!parent) throw new Error("Layer parent does not exist");
      const parentSiblings = state.snapshot.records
        .filter(({ parentId }) => parentId === parent.parentId)
        .sort((left, right) => compareFractionalIndex(left.index, right.index));
      const parentIndex = parentSiblings.findIndex(
        ({ id }) => id === parent.id,
      );
      engine.dispatch({
        type: "shape.reparent",
        ids: [record.id],
        parentId: parent.parentId,
        beforeId: parentSiblings[parentIndex + 1]?.id,
      });
    },
    [engine, state.snapshot.records],
  );
  const frames = useMemo(
    () =>
      state.snapshot.document.presentation.frameIds
        .map((id) => state.snapshot.records.find((record) => record.id === id))
        .filter((record): record is ShapeRecord => Boolean(record)),
    [state.snapshot],
  );
  const thumbnailSignatures = useMemo(
    () => frameThumbnailSignatures(state.snapshot),
    [state.snapshot],
  );
  const showFrame = useCallback(
    (index: number | null, announce = true) => {
      setActiveFrameIndex(index);
      const url = new URL(window.location.href);
      if (index === null || !frames[index]) {
        url.searchParams.delete("frame");
        history.replaceState(history.state, "", url);
        if (announce) onPresentationFrameChange?.(null);
        return;
      }
      view?.focusRecord(frames[index]!.id);
      url.searchParams.set("frame", frames[index]!.id);
      history.replaceState(history.state, "", url);
      if (announce) onPresentationFrameChange?.(frames[index]!.id);
    },
    [frames, onPresentationFrameChange, view],
  );
  useEffect(() => {
    const frameId = new URL(window.location.href).searchParams.get("frame");
    const index = frames.findIndex(({ id }) => id === frameId);
    if (index < 0) return;
    const animationFrame = requestAnimationFrame(() => showFrame(index, false));
    return () => cancelAnimationFrame(animationFrame);
  }, [frames, showFrame]);
  useEffect(() => {
    if (!state.followingId) {
      followedFrameRef.current = null;
      return;
    }
    const frameId = state.collaborators.get(
      state.followingId,
    )?.presentationFrameId;
    if (frameId === undefined) return;
    const key = `${state.followingId}:${frameId ?? "none"}`;
    if (followedFrameRef.current === key) return;
    followedFrameRef.current = key;
    const index =
      frameId === null ? -1 : frames.findIndex(({ id }) => id === frameId);
    const animationFrame = requestAnimationFrame(() =>
      showFrame(index < 0 ? null : index, false),
    );
    return () => cancelAnimationFrame(animationFrame);
  }, [frames, showFrame, state.collaborators, state.followingId]);
  useEffect(() => {
    if (activeFrameIndex === null) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") showFrame(null);
      if (event.key === "ArrowRight" || event.key === "PageDown")
        showFrame(Math.min(frames.length - 1, activeFrameIndex + 1));
      if (event.key === "ArrowLeft" || event.key === "PageUp")
        showFrame(Math.max(0, activeFrameIndex - 1));
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [activeFrameIndex, frames.length, showFrame]);

  const buildImportPreview = async () => {
    try {
      const ast =
        importMode === "dsl"
          ? parseDsl(importSource)
          : await parseMermaid(importSource);
      setImportPreview(await astToImportPlan(ast, engine.registry));
    } catch (error) {
      setImportPreview(null);
      fail(error);
    }
  };
  const applyImport = () => {
    if (!importPreview) return;
    try {
      applyImportPlan(engine, importPreview);
      setImportPreview(null);
      setImportOpen(false);
    } catch (error) {
      fail(error);
    }
  };

  const createLink = async () => {
    if (!fetchLinkMetadata) {
      fail(new Error("Link metadata service is not configured"));
      return;
    }
    const url = window.prompt("Paste an HTTP or HTTPS URL");
    if (!url) return;
    try {
      const metadata = await fetchLinkMetadata(url, false);
      const definition = engine.registry.get("link-card");
      const siblings = state.snapshot.records
        .filter(({ parentId }) => parentId === ROOT_PARENT_ID)
        .sort((a, b) => compareFractionalIndex(a.index, b.index));
      const viewport = engine.getViewState().viewport;
      const centerX =
        ((view?.canvas.clientWidth ?? 800) / 2 - viewport.x) / viewport.zoom;
      const centerY =
        ((view?.canvas.clientHeight ?? 600) / 2 - viewport.y) / viewport.zoom;
      const record = engine.registry.validate({
        id: crypto.randomUUID(),
        type: "link-card",
        typeVersion: definition.version,
        parentId: ROOT_PARENT_ID,
        index: generateKeyBetween(siblings.at(-1)?.index ?? null, null),
        x: centerX - 180,
        y: centerY - 110,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        props: {
          width: 360,
          height: 220,
          url: metadata.url,
          title: metadata.title,
          description: metadata.description,
          siteName: metadata.siteName,
          fetchedAt: metadata.fetchedAt,
          imageAssetId: metadata.imageAsset?.assetId ?? null,
          faviconAssetId: metadata.faviconAsset?.assetId ?? null,
        },
      });
      const assets = [metadata.imageAsset, metadata.faviconAsset].filter(
        (asset): asset is AssetRecord => Boolean(asset),
      );
      engine.dispatch({
        type: "batch",
        commands: [
          ...assets.map((asset) => ({ type: "asset.set", asset }) as const),
          { type: "shape.create", record },
        ],
      });
      if (metadata.warnings.length) setMessage(metadata.warnings.join(" "));
    } catch (error) {
      fail(error);
    }
  };
  const refreshLink = async (record: ShapeRecord) => {
    if (!fetchLinkMetadata)
      throw new Error("Link metadata service is not configured");
    try {
      const props = record.props as Record<string, unknown> & { url: string };
      const metadata = await fetchLinkMetadata(props.url, true);
      const assets = [metadata.imageAsset, metadata.faviconAsset].filter(
        (asset): asset is AssetRecord => Boolean(asset),
      );
      engine.dispatch({
        type: "batch",
        commands: [
          ...assets.map((asset) => ({ type: "asset.set", asset }) as const),
          {
            type: "shape.update",
            id: record.id,
            patch: {
              props: {
                ...props,
                url: metadata.url,
                title: metadata.title,
                description: metadata.description,
                siteName: metadata.siteName,
                fetchedAt: metadata.fetchedAt,
                imageAssetId: metadata.imageAsset?.assetId ?? null,
                faviconAssetId: metadata.faviconAsset?.assetId ?? null,
              },
            },
          },
        ],
      });
      if (metadata.warnings.length) setMessage(metadata.warnings.join(" "));
    } catch (error) {
      fail(error);
    }
  };

  const createImage = useCallback(
    async (file: File, screenPoint?: { x: number; y: number }) => {
      if (!uploadAsset) throw new Error("Image upload is not configured");
      if (!file.type.startsWith("image/"))
        throw new Error("Only image files can be added to the canvas");
      const asset = await uploadAsset(file);
      const maximum = 720;
      const scale = Math.min(1, maximum / Math.max(asset.width, asset.height));
      const width = Math.max(1, Math.round(asset.width * scale));
      const height = Math.max(1, Math.round(asset.height * scale));
      const viewport = engine.getViewState().viewport;
      const point = screenPoint ?? {
        x: (view?.canvas.clientWidth ?? 800) / 2,
        y: (view?.canvas.clientHeight ?? 600) / 2,
      };
      const x = (point.x - viewport.x) / viewport.zoom - width / 2;
      const y = (point.y - viewport.y) / viewport.zoom - height / 2;
      const siblings = engine
        .getSnapshot()
        .records.filter(({ parentId }) => parentId === ROOT_PARENT_ID)
        .sort((left, right) => compareFractionalIndex(left.index, right.index));
      const definition = engine.registry.get("image");
      const record = engine.registry.validate({
        id: crypto.randomUUID(),
        type: "image",
        typeVersion: definition.version,
        parentId: ROOT_PARENT_ID,
        index: generateKeyBetween(siblings.at(-1)?.index ?? null, null),
        x,
        y,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        props: {
          width,
          height,
          assetId: asset.assetId,
          alt: file.name.slice(0, 1_000),
        },
      });
      engine.dispatch({
        type: "batch",
        commands: [
          { type: "asset.set", asset },
          { type: "shape.create", record },
        ],
      });
      engine.setViewState({ selectedIds: [record.id] });
    },
    [engine, uploadAsset, view],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (state.readonly) return;
      try {
        const rect = event.currentTarget.getBoundingClientRect();
        const point = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const file = event.dataTransfer.files[0];
        if (file?.type.startsWith("image/")) {
          await createImage(file, point);
          return;
        }
        if (
          file &&
          (file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv"))
        ) {
          if (!selected || selected.type !== "table")
            throw new Error("Select a table before dropping a CSV file");
          setCsvPreview({
            tableId: selected.id,
            rows: parseCsv(await file.text()),
          });
          return;
        }
        const source =
          event.dataTransfer.getData(TAHTA_CLIPBOARD_MIME) ||
          event.dataTransfer.getData("text/plain");
        if (!source.trim()) return;
        if (source.trimStart().startsWith("{")) {
          pasteClipboardPayload(engine, parseClipboardPayload(source), {
            x: 0,
            y: 0,
          });
          return;
        }
        const ast = isMermaidSource(source)
          ? await parseMermaid(source)
          : parseDsl(source);
        applyImportPlan(engine, await astToImportPlan(ast, engine.registry));
      } catch (error) {
        fail(error);
      }
    },
    [createImage, engine, fail, selected, state.readonly],
  );

  return (
    <div
      className={`tahta-workspace ${activeFrameIndex !== null ? "tahta-presenting" : ""} ${className ?? ""}`}
      onDragOver={(event) => {
        if (!state.readonly) event.preventDefault();
      }}
      onDrop={(event) => {
        void handleDrop(event);
      }}
      onCopy={(event) => {
        if (!state.selectedIds.length) return;
        try {
          const source = serializeClipboardPayload(
            createClipboardPayload(engine),
          );
          event.clipboardData.setData(TAHTA_CLIPBOARD_MIME, source);
          event.clipboardData.setData("text/plain", source);
          event.preventDefault();
        } catch (error) {
          fail(error);
        }
      }}
      onPaste={(event) => {
        if (state.readonly) return;
        const source = event.clipboardData.getData(TAHTA_CLIPBOARD_MIME);
        if (!source) return;
        try {
          pasteClipboardPayload(engine, parseClipboardPayload(source));
          event.preventDefault();
        } catch (error) {
          fail(error);
        }
      }}
    >
      <TahtaCanvas
        engine={engine}
        locale={locale}
        resolveAssetUrl={resolveAssetUrl}
        onReady={ready}
        onPointerUpdate={onPointerUpdate}
        toolbar={false}
        onEditRecord={setEditingId}
        onError={fail}
        className="tahta-workspace-canvas"
      />
      <div
        ref={toolbarRef}
        className="tahta-workspace-toolbar"
        role="toolbar"
        aria-label="Canvas tools"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          const buttons = [
            ...toolbarRef.current!.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ];
          const index = Math.max(
            0,
            buttons.indexOf(document.activeElement as HTMLButtonElement),
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          event.preventDefault();
          buttons.forEach((button, position) => {
            button.tabIndex = position === next ? 0 : -1;
          });
          buttons[next]?.focus();
        }}
        onFocus={(event) => {
          const target = event.target;
          if (!(target instanceof HTMLButtonElement)) return;
          toolbarRef.current
            ?.querySelectorAll<HTMLButtonElement>("button")
            .forEach((button) => {
              button.tabIndex = button === target ? 0 : -1;
            });
        }}
      >
        {toolbarTools.map((command) => (
            <button
              key={command.id}
              type="button"
              className="tahta-icon-button"
              aria-label={command.label}
              aria-pressed={state.activeTool === command.tool}
              title={`${command.label}${command.shortcut ? ` (${command.shortcut})` : ""}`}
              disabled={!view || (state.readonly && command.tool !== "select" && command.tool !== "hand")}
              onClick={() =>
                void commandRegistry.execute(command.id, { engine })
              }
            >
              <CanvasIcon name={command.tool as CanvasIconName} />
            </button>
          ))}
        <span className="tahta-toolbar-separator" />
        <button className="tahta-icon-button" type="button" onClick={() => setLayersOpen((value) => !value)} aria-label="Layers" aria-pressed={layersOpen} title="Layers">
          <CanvasIcon name="layers" />
        </button>
        <button
          className="tahta-icon-button"
          type="button"
          onClick={openLayoutSettings}
          disabled={layoutBusy || state.readonly}
          aria-label="Auto layout"
          title="Auto layout"
        >
          <CanvasIcon name="layout" />
        </button>
        <button
          className="tahta-icon-button"
          type="button"
          onClick={() => setPresentationOpen((value) => !value)}
          aria-label="Presentation"
          aria-pressed={presentationOpen}
          title="Presentation"
        >
          <CanvasIcon name="present" />
        </button>
        <button className="tahta-icon-button" type="button" onClick={() => setImportOpen(true)} disabled={state.readonly} aria-label="Import" title="Import DSL or Mermaid">
          <CanvasIcon name="import" />
        </button>
        <button className="tahta-icon-button" type="button" onClick={() => void createLink()} disabled={state.readonly} aria-label="Link card" title="Create link card">
          <CanvasIcon name="link" />
        </button>
        <button className="tahta-icon-button" type="button" onClick={() => setExportOpen(true)} aria-label="Export" title="Export">
          <CanvasIcon name="export" />
        </button>
        <button
          className="tahta-icon-button"
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette"
          title="Command palette (Mod+K)"
        >
          <CanvasIcon name="command" />
        </button>
      </div>

      <div className="tahta-bottom-controls" role="group" aria-label="Canvas view controls">
        {statusContent}
        <button type="button" className="tahta-bottom-button tahta-layers-button" onClick={() => setLayersOpen((value) => !value)} aria-label="Layers" aria-pressed={layersOpen} title="Layers">
          <CanvasIcon name="layers" />
          {state.snapshot.records.length > 0 && <span className="tahta-layers-badge" aria-hidden="true">{state.snapshot.records.length > 99 ? "99+" : state.snapshot.records.length}</span>}
        </button>
        <span className="tahta-bottom-separator" aria-hidden="true" />
        <button type="button" className="tahta-bottom-button" onClick={() => view?.fitToContent()} disabled={!view || state.snapshot.records.length === 0} aria-label="Focus content" title="Focus content">
          <CanvasIcon name="fit" />
        </button>
        <span className="tahta-bottom-separator" aria-hidden="true" />
        <button type="button" className="tahta-bottom-button" onClick={() => setZoom(state.viewport.zoom - 0.1)} disabled={state.viewport.zoom <= 0.1} aria-label="Zoom out" title="Zoom out">
          <CanvasIcon name="minus" />
        </button>
        <button type="button" className="tahta-zoom-value" onClick={() => setZoom(1)} aria-label={`Reset zoom, currently ${Math.round(state.viewport.zoom * 100)}%`} title="Reset zoom">
          {Math.round(state.viewport.zoom * 100)}%
        </button>
        <button type="button" className="tahta-bottom-button" onClick={() => setZoom(state.viewport.zoom + 0.1)} disabled={state.viewport.zoom >= 8} aria-label="Zoom in" title="Zoom in">
          <CanvasIcon name="plus" />
        </button>
      </div>

      {selected &&
        selectedBounds &&
        selected.type !== "arrow" &&
        selected.type !== "line" &&
        !state.readonly &&
        (["left", "right", "up", "down"] as const).map((direction) => (
          <button
            key={direction}
            className={`tahta-quick-create tahta-quick-${direction}`}
            style={
              {
                left: selectedBounds.left + selectedBounds.width / 2,
                top: selectedBounds.top + selectedBounds.height / 2,
                "--shape-w": `${selectedBounds.width}px`,
                "--shape-h": `${selectedBounds.height}px`,
              } as React.CSSProperties
            }
            aria-label={`Create connected shape ${direction}`}
            onClick={() => {
              try {
                performQuickCreate(direction);
              } catch (error) {
                fail(error);
              }
            }}
          >
            +
          </button>
        ))}

      {layoutOpen && (
        <FocusDialog
          label="Auto layout settings"
          onClose={() => {
            layoutAbortRef.current?.abort();
            setLayoutOpen(false);
          }}
        >
          <div className="tahta-export-options">
            <label>
              <span>Scope</span>
              <select
                value={layoutSettings.scope}
                onChange={(event) =>
                  setLayoutSettings((value) => ({
                    ...value,
                    scope: event.target.value as typeof value.scope,
                  }))
                }
              >
                <option
                  value="selection"
                  disabled={state.selectedIds.length < 2}
                >
                  Selection
                </option>
                <option value="frame" disabled={!frames.length}>
                  Frame
                </option>
                <option value="board">Full board</option>
              </select>
            </label>
            {layoutSettings.scope === "frame" && (
              <label>
                <span>Frame</span>
                <select
                  value={layoutSettings.frameId || frames[0]?.id || ""}
                  onChange={(event) =>
                    setLayoutSettings((value) => ({
                      ...value,
                      frameId: event.target.value,
                    }))
                  }
                >
                  {frames.map((frame, index) => (
                    <option key={frame.id} value={frame.id}>
                      {index + 1}.{" "}
                      {plainText(
                        (
                          frame.props as {
                            text: ReturnType<typeof richTextFromString>;
                          }
                        ).text,
                      ) || frame.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>Direction</span>
              <select
                value={layoutSettings.direction}
                onChange={(event) =>
                  setLayoutSettings((value) => ({
                    ...value,
                    direction: event.target.value as LayoutDirection,
                  }))
                }
              >
                <option value="LR">Left to right</option>
                <option value="RL">Right to left</option>
                <option value="TB">Top to bottom</option>
                <option value="BT">Bottom to top</option>
              </select>
            </label>
            <label>
              <span>Alignment</span>
              <select
                value={layoutSettings.alignment}
                onChange={(event) =>
                  setLayoutSettings((value) => ({
                    ...value,
                    alignment: event.target.value as LayoutAlignment,
                  }))
                }
              >
                <option value="automatic">Automatic</option>
                <option value="start">Start</option>
                <option value="center">Center</option>
                <option value="end">End</option>
              </select>
            </label>
            <label>
              <span>Spacing</span>
              <input
                type="number"
                min={20}
                max={500}
                step={10}
                value={layoutSettings.spacing}
                onChange={(event) =>
                  setLayoutSettings((value) => ({
                    ...value,
                    spacing: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          <div className="tahta-dialog-actions">
            <button
              type="button"
              onClick={() => {
                layoutAbortRef.current?.abort();
                setLayoutOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                layoutBusy ||
                (layoutSettings.scope === "selection" &&
                  state.selectedIds.length < 2) ||
                (layoutSettings.scope === "frame" &&
                  !layoutSettings.frameId &&
                  !frames[0]?.id) ||
                !Number.isFinite(layoutSettings.spacing)
              }
              onClick={() => void createLayout()}
            >
              {layoutBusy ? "Building preview…" : "Build preview"}
            </button>
          </div>
        </FocusDialog>
      )}
      {layoutPreview && (
        <div className="tahta-layout-preview" aria-label="Auto layout preview">
          {layoutGhosts.map((ghost) => (
            <div
              key={ghost.id}
              className="tahta-layout-ghost"
              style={{
                left: ghost.left,
                top: ghost.top,
                width: ghost.width,
                height: ghost.height,
              }}
            />
          ))}
          <div className="tahta-preview-actions">
            <button
              type="button"
              onClick={() => {
                applyAutoLayout(engine, layoutPreview);
                setLayoutPreview(null);
              }}
            >
              Apply layout
            </button>
            <button type="button" onClick={() => setLayoutPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {layersOpen && (
        <aside className="tahta-navigator" aria-label="Canvas navigator">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search text, type, tag, URL…"
            aria-label="Search canvas"
          />
          <div
            className="tahta-layer-list"
            onScroll={(event) => setLayerScroll(event.currentTarget.scrollTop)}
          >
            <div
              style={{
                height: searchRows.length * rowHeight,
                position: "relative",
              }}
            >
              {visibleRows.map(({ record, depth }, offset) => (
                <div
                  key={record.id}
                  className="tahta-layer-row"
                  style={{
                    top: (visibleStart + offset) * rowHeight,
                    paddingLeft: 8 + depth * 16,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => view?.focusRecord(record.id)}
                  >
                    {record.type} · {record.id.slice(0, 8)}
                  </button>
                  <button
                    type="button"
                    disabled={state.readonly || record.locked}
                    aria-label="Move layer earlier"
                    onClick={() => moveLayer(record, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={state.readonly || record.locked}
                    aria-label="Move layer later"
                    onClick={() => moveLayer(record, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={state.readonly || record.locked}
                    aria-label="Indent into previous frame or group"
                    onClick={() => {
                      try {
                        indentLayer(record);
                      } catch (error) {
                        fail(error);
                      }
                    }}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    disabled={
                      state.readonly ||
                      record.locked ||
                      record.parentId === ROOT_PARENT_ID
                    }
                    aria-label="Move out of parent"
                    onClick={() => {
                      try {
                        outdentLayer(record);
                      } catch (error) {
                        fail(error);
                      }
                    }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={state.readonly}
                    aria-label={record.hidden ? "Show" : "Hide"}
                    onClick={() =>
                      engine.dispatch({
                        type: "shape.update",
                        id: record.id,
                        patch: { hidden: !record.hidden },
                      })
                    }
                  >
                    {record.hidden ? "○" : "●"}
                  </button>
                  <button
                    type="button"
                    disabled={state.readonly}
                    aria-label={record.locked ? "Unlock" : "Lock"}
                    onClick={() =>
                      engine.dispatch({
                        type: "shape.update",
                        id: record.id,
                        patch: { locked: !record.locked },
                      })
                    }
                  >
                    {record.locked ? "🔒" : "🔓"}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div
            className="tahta-minimap"
            role="application"
            tabIndex={0}
            aria-label="Board minimap. Click, drag, or use arrow keys to move the viewport"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key,
                )
              )
                return;
              const step = event.shiftKey ? 160 : 40;
              event.preventDefault();
              engine.setViewState({
                viewport: {
                  ...state.viewport,
                  x:
                    state.viewport.x +
                    (event.key === "ArrowLeft"
                      ? step
                      : event.key === "ArrowRight"
                        ? -step
                        : 0),
                  y:
                    state.viewport.y +
                    (event.key === "ArrowUp"
                      ? step
                      : event.key === "ArrowDown"
                        ? -step
                        : 0),
                },
              });
            }}
            onPointerDown={(event) => {
              const root = event.currentTarget;
              root.setPointerCapture(event.pointerId);
              const move = (clientX: number, clientY: number) => {
                const rect = root.getBoundingClientRect();
                const worldX =
                  minimap.minX + (clientX - rect.left - 10) / minimap.scale;
                const worldY =
                  minimap.minY + (clientY - rect.top - 8) / minimap.scale;
                const canvasRect = view?.canvas.getBoundingClientRect();
                if (!canvasRect) return;
                engine.setViewState({
                  viewport: {
                    ...state.viewport,
                    x: canvasRect.width / 2 - worldX * state.viewport.zoom,
                    y: canvasRect.height / 2 - worldY * state.viewport.zoom,
                  },
                });
              };
              move(event.clientX, event.clientY);
              const pointerMove = (next: PointerEvent) =>
                move(next.clientX, next.clientY);
              const pointerUp = () => {
                root.removeEventListener("pointermove", pointerMove);
                root.removeEventListener("pointerup", pointerUp);
              };
              root.addEventListener("pointermove", pointerMove);
              root.addEventListener("pointerup", pointerUp);
            }}
          >
            {minimap.items.map((record) => (
              <span
                key={record.id}
                style={{
                  left: 10 + (record.x - minimap.minX) * minimap.scale,
                  top: 8 + (record.y - minimap.minY) * minimap.scale,
                  width: Math.max(2, record.width * minimap.scale),
                  height: Math.max(2, record.height * minimap.scale),
                }}
              />
            ))}
            {view && (
              <i
                className="tahta-minimap-viewport"
                style={{
                  left:
                    10 +
                    (-state.viewport.x / state.viewport.zoom - minimap.minX) *
                      minimap.scale,
                  top:
                    8 +
                    (-state.viewport.y / state.viewport.zoom - minimap.minY) *
                      minimap.scale,
                  width:
                    (view.canvas.clientWidth / state.viewport.zoom) *
                    minimap.scale,
                  height:
                    (view.canvas.clientHeight / state.viewport.zoom) *
                    minimap.scale,
                }}
              />
            )}
          </div>
        </aside>
      )}

      {selected &&
      (engine.registry.get(selected.type).properties?.length ||
        selected.type === "table") ? (
        <aside className="tahta-properties" aria-label="Shape properties">
          <strong>{selected.type}</strong>
          {engine.registry.get(selected.type).properties?.map((property) => {
            const value = (selected.props as Record<string, unknown>)[
              property.key
            ];
            return (
              <label key={property.key}>
                <span>{property.label}</span>
                {property.control === "select" ? (
                  <select
                    disabled={state.readonly}
                    value={String(value)}
                    onChange={(event) =>
                      engine.dispatch({
                        type: "shape.update",
                        id: selected.id,
                        patch: {
                          props: {
                            ...(selected.props as Record<string, unknown>),
                            [property.key]: event.target.value,
                          },
                        },
                      })
                    }
                  >
                    {property.options?.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    disabled={state.readonly}
                    type={property.control}
                    value={
                      typeof value === "number" || typeof value === "string"
                        ? value
                        : ""
                    }
                    onChange={(event) =>
                      engine.dispatch({
                        type: "shape.update",
                        id: selected.id,
                        patch: {
                          props: {
                            ...(selected.props as Record<string, unknown>),
                            [property.key]:
                              property.control === "number"
                                ? Number(event.target.value)
                                : event.target.value,
                          },
                        },
                      })
                    }
                  />
                )}
              </label>
            );
          })}
          {selected.type === "table" && (
            <div className="tahta-table-actions">
              <label>
                <input
                  type="checkbox"
                  disabled={state.readonly}
                  checked={(selected.props as EditableTableProps).header}
                  onChange={(event) =>
                    engine.dispatch({
                      type: "shape.update",
                      id: selected.id,
                      patch: {
                        props: {
                          ...(selected.props as Record<string, unknown>),
                          header: event.target.checked,
                        },
                      },
                    })
                  }
                />
                <span>Header row</span>
              </label>
              <button
                type="button"
                onClick={() => setTableEditorId(selected.id)}
              >
                Edit table
              </button>
              <button
                type="button"
                disabled={state.readonly}
                onClick={() => csvInputRef.current?.click()}
              >
                Import CSV
              </button>
              <button type="button" onClick={() => void runExport("csv")}>
                Export CSV
              </button>
              <input
                ref={csvInputRef}
                hidden
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void file
                    .text()
                    .then((source) =>
                      setCsvPreview({
                        tableId: selected.id,
                        rows: parseCsv(source),
                      }),
                    )
                    .catch(fail);
                  event.currentTarget.value = "";
                }}
              />
            </div>
          )}
          {selected.type === "frame" && (
            <div className="tahta-frame-delete-actions">
              <button
                type="button"
                disabled={state.readonly || selected.locked}
                onClick={() =>
                  engine.dispatch({
                    type: "shape.delete",
                    ids: [selected.id],
                    mode: "only",
                  })
                }
              >
                Delete frame only
              </button>
              <button
                type="button"
                disabled={state.readonly || selected.locked}
                onClick={() =>
                  engine.dispatch({
                    type: "shape.delete",
                    ids: [selected.id],
                    mode: "cascade",
                  })
                }
              >
                Delete with contents
              </button>
            </div>
          )}
        </aside>
      ) : null}
      {selected?.type === "link-card" && (
        <aside className="tahta-properties" aria-label="Link card properties">
          <strong>Link card</strong>
          <a
            href={(selected.props as { url: string }).url}
            target="_blank"
            rel="noreferrer"
          >
            Open original link
          </a>
          <button
            type="button"
            disabled={state.readonly}
            onClick={() => void refreshLink(selected)}
          >
            Refresh metadata
          </button>
        </aside>
      )}

      {presentationOpen && (
        <div className="tahta-filmstrip" aria-label="Presentation frames">
          <button
            type="button"
            disabled={!frames.length}
            onClick={() => showFrame(0)}
          >
            Start presentation
          </button>
          {frames.map((frame, index) => (
            <div className="tahta-frame-item" key={frame.id}>
              <button
                type="button"
                aria-label={`Show frame ${index + 1}`}
                onClick={() => showFrame(index)}
              >
                <FrameThumbnail
                  engine={engine}
                  frameId={frame.id}
                  label={`Frame ${index + 1}`}
                  signature={thumbnailSignatures.get(frame.id) ?? frame.id}
                  resolveAssetHref={resolveAssetUrl}
                  onError={fail}
                />
                <span>{index + 1}</span>
              </button>
              <input
                aria-label={`Frame ${index + 1} title`}
                disabled={state.readonly}
                value={plainText(
                  (
                    frame.props as {
                      text: ReturnType<typeof richTextFromString>;
                    }
                  ).text,
                )}
                onChange={(event) =>
                  engine.dispatch({
                    type: "text.replace",
                    shapeId: frame.id,
                    document: richTextFromString(event.target.value),
                  })
                }
              />
              <button
                type="button"
                disabled={state.readonly || index === 0}
                aria-label="Move frame earlier"
                onClick={() => {
                  engine.dispatch({
                    type: "presentation.reorder",
                    frameId: frame.id,
                    beforeId: frames[index - 1]!.id,
                  });
                }}
              >
                ←
              </button>
              <button
                type="button"
                disabled={state.readonly || index === frames.length - 1}
                aria-label="Move frame later"
                onClick={() => {
                  engine.dispatch({
                    type: "presentation.reorder",
                    frameId: frame.id,
                    beforeId: frames[index + 2]?.id,
                  });
                }}
              >
                →
              </button>
            </div>
          ))}
        </div>
      )}
      {activeFrameIndex !== null && frames[activeFrameIndex] && (
        <div
          className="tahta-present-controls"
          role="toolbar"
          aria-label="Presentation controls"
        >
          <button
            type="button"
            onClick={() => showFrame(Math.max(0, activeFrameIndex - 1))}
            disabled={activeFrameIndex === 0}
          >
            Previous
          </button>
          <span>
            {activeFrameIndex + 1} / {frames.length}
          </span>
          <button
            type="button"
            onClick={() =>
              showFrame(Math.min(frames.length - 1, activeFrameIndex + 1))
            }
            disabled={activeFrameIndex === frames.length - 1}
          >
            Next
          </button>
          <button type="button" onClick={() => showFrame(null)}>
            Exit
          </button>
        </div>
      )}

      {editingId && (
        <FocusDialog label="Edit rich text" onClose={() => setEditingId(null)}>
          <RichTextEditor
            engine={engine}
            shapeId={editingId}
            readonly={state.readonly}
            onClose={() => setEditingId(null)}
          />
        </FocusDialog>
      )}
      {tableEditorId &&
        state.snapshot.records.find(({ id }) => id === tableEditorId) && (
          <FocusDialog
            label="Edit table"
            onClose={() => setTableEditorId(null)}
          >
            <TableEditor
              engine={engine}
              record={
                state.snapshot.records.find(({ id }) => id === tableEditorId)!
              }
              readonly={state.readonly}
              fail={fail}
            />
          </FocusDialog>
        )}
      {paletteOpen && (
        <FocusDialog
          label="Command palette"
          onClose={() => setPaletteOpen(false)}
        >
          <input
            value={paletteQuery}
            onChange={(event) => setPaletteQuery(event.target.value)}
            placeholder="Type a command…"
            aria-label="Command search"
          />
          <div className="tahta-command-results">
            {commandRegistry.search(paletteQuery, { engine }).map((command) => (
              <button
                type="button"
                key={command.id}
                onClick={() => {
                  setPaletteOpen(false);
                  void Promise.resolve(
                    commandRegistry.execute(command.id, { engine }),
                  ).catch(fail);
                }}
              >
                <span>{command.label}</span>
                <kbd>{command.shortcut}</kbd>
              </button>
            ))}
          </div>
        </FocusDialog>
      )}
      {exportOpen && (
        <FocusDialog label="Export canvas" onClose={() => setExportOpen(false)}>
          <div className="tahta-export-options">
            <label>
              <span>Format</span>
              <select
                value={exportSettings.format}
                onChange={(event) =>
                  setExportSettings((value) => ({
                    ...value,
                    format: event.target.value as ExportFormat,
                  }))
                }
              >
                {(
                  ["png", "jpeg", "svg", "pdf", "json", "dsl", "csv"] as const
                ).map((format) => (
                  <option key={format} value={format}>
                    {format.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Scope</span>
              <select
                value={exportSettings.scope}
                onChange={(event) =>
                  setExportSettings((value) => ({
                    ...value,
                    scope: event.target.value as ExportScope["kind"],
                  }))
                }
              >
                <option value="board">Full board</option>
                <option value="selection" disabled={!state.selectedIds.length}>
                  Selection
                </option>
                <option value="frame" disabled={!frames.length}>
                  Frame
                </option>
              </select>
            </label>
            {exportSettings.scope === "frame" && (
              <label>
                <span>Frame</span>
                <select
                  value={exportSettings.frameId || frames[0]?.id || ""}
                  onChange={(event) =>
                    setExportSettings((value) => ({
                      ...value,
                      frameId: event.target.value,
                    }))
                  }
                >
                  {frames.map((frame, index) => (
                    <option key={frame.id} value={frame.id}>
                      {index + 1}. {frame.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {exportSettings.format === "png" ||
            exportSettings.format === "svg" ? (
              <label>
                <span>Background</span>
                <input
                  type="checkbox"
                  checked={!exportSettings.transparent}
                  onChange={(event) =>
                    setExportSettings((value) => ({
                      ...value,
                      transparent: !event.target.checked,
                    }))
                  }
                />
              </label>
            ) : null}
            {exportSettings.format === "png" ||
            exportSettings.format === "jpeg" ? (
              <label>
                <span>Scale</span>
                <input
                  type="number"
                  min={0.25}
                  max={8}
                  step={0.25}
                  value={exportSettings.scale}
                  onChange={(event) =>
                    setExportSettings((value) => ({
                      ...value,
                      scale: Number(event.target.value),
                    }))
                  }
                />
              </label>
            ) : null}
          </div>
          <div className="tahta-dialog-actions">
            <button type="button" onClick={() => setExportOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const scope: ExportScope =
                  exportSettings.scope === "frame"
                    ? {
                        kind: "frame",
                        frameId: exportSettings.frameId || frames[0]?.id,
                      }
                    : { kind: exportSettings.scope };
                void runExport(exportSettings.format, {
                  scope,
                  transparent: exportSettings.transparent,
                  scale: exportSettings.scale,
                }).then((success) => {
                  if (success) setExportOpen(false);
                });
              }}
            >
              Export
            </button>
          </div>
        </FocusDialog>
      )}
      {importOpen && (
        <FocusDialog
          label="Import diagram"
          onClose={() => {
            setImportPreview(null);
            setImportOpen(false);
          }}
        >
          <div className="tahta-dialog-tabs">
            <button
              type="button"
              aria-pressed={importMode === "dsl"}
              onClick={() => {
                setImportMode("dsl");
                setImportPreview(null);
              }}
            >
              DSL
            </button>
            <button
              type="button"
              aria-pressed={importMode === "mermaid"}
              onClick={() => {
                setImportMode("mermaid");
                setImportPreview(null);
              }}
            >
              Mermaid
            </button>
          </div>
          <textarea
            value={importSource}
            onChange={(event) => {
              setImportSource(event.target.value);
              setImportPreview(null);
            }}
            rows={16}
            aria-label="Diagram source"
          />
          {importPreview && (
            <div className="tahta-import-preview" role="status">
              <strong>Validated import plan</strong>
              <span>
                {
                  importPreview.commands.filter(
                    ({ type }) => type === "shape.create",
                  ).length
                }{" "}
                shapes
              </span>
              <span>
                {
                  importPreview.commands.filter(
                    ({ type }) => type === "binding.set",
                  ).length
                }{" "}
                bindings
              </span>
              <span>{importPreview.commands.length} atomic commands</span>
            </div>
          )}
          <div className="tahta-dialog-actions">
            <button
              type="button"
              onClick={() => {
                setImportPreview(null);
                setImportOpen(false);
              }}
            >
              Cancel
            </button>
            {importPreview ? (
              <button type="button" onClick={applyImport}>
                Apply import
              </button>
            ) : (
              <button type="button" onClick={() => void buildImportPreview()}>
                Build preview
              </button>
            )}
          </div>
        </FocusDialog>
      )}
      {clusterPreview && (
        <FocusDialog
          label="Sticky note cluster preview"
          onClose={() => setClusterPreview(null)}
        >
          <p>
            Review cluster titles before applying. Locked notes will stop the
            operation without changing the board.
          </p>
          <div className="tahta-cluster-preview">
            {clusterPreview.map((cluster, index) => (
              <label key={cluster.id}>
                <span>{cluster.stickyIds.length} notes</span>
                <input
                  value={cluster.title}
                  onChange={(event) =>
                    setClusterPreview(
                      (current) =>
                        current?.map((value, position) =>
                          position === index
                            ? {
                                ...value,
                                title: event.target.value.slice(0, 500),
                              }
                            : value,
                        ) ?? null,
                    )
                  }
                />
              </label>
            ))}
          </div>
          <div className="tahta-dialog-actions">
            <button type="button" onClick={() => setClusterPreview(null)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  applyStickyClusters(engine, clusterPreview);
                  setClusterPreview(null);
                } catch (error) {
                  fail(error);
                }
              }}
            >
              Apply clusters
            </button>
          </div>
        </FocusDialog>
      )}
      {csvPreview && (
        <FocusDialog
          label="CSV import preview"
          onClose={() => setCsvPreview(null)}
        >
          <div className="tahta-csv-preview">
            <table>
              <tbody>
                {csvPreview.rows.slice(0, 20).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.slice(0, 12).map((cell, columnIndex) => (
                      <td key={columnIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {csvPreview.rows.length > 20 && (
              <p>Previewing 20 of {csvPreview.rows.length} rows.</p>
            )}
          </div>
          <div className="tahta-dialog-actions">
            <button type="button" onClick={() => setCsvPreview(null)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                applyCsvToTable(engine, csvPreview.tableId, csvPreview.rows);
                setCsvPreview(null);
              }}
            >
              Apply CSV
            </button>
          </div>
        </FocusDialog>
      )}
      {message && (
        <div className="tahta-workspace-message" role="alert">
          {message}
        </div>
      )}
    </div>
  );
}
