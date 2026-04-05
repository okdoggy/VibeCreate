"use client";

/* eslint-disable @next/next/no-img-element */

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CaretDown,
  Cursor,
  Eye,
  EyeSlash,
  FolderSimplePlus,
  Lasso,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Rows,
  Stack,
} from "@phosphor-icons/react";
import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Tool = "pointer" | "lasso";

type Point = {
  x: number;
  y: number;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type LassoSelection = {
  layerId: string;
  points: Point[];
  closed: boolean;
  bounds: Bounds;
};

type LassoDraft = {
  layerId: string;
  pointerId: number;
  points: Point[];
};

type ImageLayer = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  visible: boolean;
  x: number;
  y: number;
  opacity: number;
};

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type DragState = {
  layerId: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  lastClientX: number;
  lastClientY: number;
  lastTimestamp: number;
  velocityX: number;
  velocityY: number;
};

type ResizeState = {
  layerId: string;
  pointerId: number;
  handle: ResizeHandle;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  lastClientX: number;
  lastClientY: number;
  lastTimestamp: number;
  velocityX: number;
  velocityY: number;
};

type ActiveInteraction =
  | {
      layerId: string;
      mode: "drag";
    }
  | {
      handle: ResizeHandle;
      layerId: string;
      mode: "resize";
    };

type DocumentSnapshot = {
  layers: ImageLayer[];
  selectedLayerId: string | null;
};

type HistoryState = {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_IN_FACTOR = 1.12;
const ZOOM_OUT_FACTOR = 0.88;
const LASSO_POINT_GAP = 6;
const MIN_LASSO_SIZE = 12;
const MIN_LAYER_WIDTH = 72;
const MIN_LAYER_HEIGHT = 72;
const MAX_LAYER_SIZE = 2400;
const MOMENTUM_MULTIPLIER = 26;
const RESIZE_EDGE_THRESHOLD_MIN = 6;
const RESIZE_EDGE_THRESHOLD_MAX = 14;
const HISTORY_LIMIT = 50;
const CANVA_THEME_STYLE: CSSProperties = {
  "--font-ui": '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif',
  "--shell-background":
    "radial-gradient(circle at top, rgba(124, 58, 237, 0.16), transparent 28%), radial-gradient(circle at bottom right, rgba(34, 211, 238, 0.14), transparent 36%), linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)",
  "--text-primary": "#1f2937",
  "--text-secondary": "rgba(31, 41, 55, 0.82)",
  "--text-muted": "rgba(55, 65, 81, 0.66)",
  "--text-faint": "rgba(107, 114, 128, 0.74)",
  "--divider": "rgba(148, 163, 184, 0.34)",
  "--panel-bg": "rgba(255, 255, 255, 0.88)",
  "--panel-border": "rgba(191, 219, 254, 0.95)",
  "--panel-shadow":
    "0 18px 44px rgba(81, 115, 179, 0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
  "--panel-blur": "18px",
  "--panel-saturate": "145%",
  "--panel-radius": "24px",
  "--control-radius": "18px",
  "--row-radius": "20px",
  "--thumb-radius": "16px",
  "--canvas-radius": "36px",
  "--badge-radius": "999px",
  "--control-bg": "rgba(255, 255, 255, 0.86)",
  "--control-bg-hover": "rgba(255, 255, 255, 0.98)",
  "--control-border": "rgba(191, 219, 254, 0.96)",
  "--control-border-hover": "rgba(129, 140, 248, 0.48)",
  "--control-text": "#334155",
  "--control-bg-active":
    "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(34,211,238,0.18))",
  "--control-border-active": "rgba(99, 102, 241, 0.52)",
  "--control-ring": "0 0 0 1px rgba(99,102,241,0.16)",
  "--control-bg-disabled": "rgba(241, 245, 249, 0.9)",
  "--control-text-disabled": "rgba(148, 163, 184, 0.92)",
  "--secondary-bg": "rgba(255,255,255,0.86)",
  "--secondary-bg-hover": "rgba(255,255,255,0.98)",
  "--secondary-border": "rgba(191, 219, 254, 0.96)",
  "--secondary-text": "#334155",
  "--layer-row-bg": "rgba(255,255,255,0.84)",
  "--layer-row-bg-hover": "rgba(255,255,255,0.97)",
  "--layer-row-border": "rgba(203, 213, 225, 0.82)",
  "--layer-row-border-hover": "rgba(148, 163, 184, 0.72)",
  "--layer-row-bg-selected":
    "linear-gradient(135deg, rgba(124,58,237,0.14), rgba(34,211,238,0.14))",
  "--layer-row-border-selected": "rgba(99, 102, 241, 0.46)",
  "--layer-row-shadow-selected": "0 0 0 1px rgba(99,102,241,0.12)",
  "--layer-rail": "rgba(99,102,241,0.9)",
  "--thumbnail-bg": "rgba(248,250,252,0.98)",
  "--thumbnail-border": "rgba(191, 219, 254, 0.8)",
  "--thumbnail-border-selected": "rgba(99,102,241,0.4)",
  "--badge-bg": "rgba(124,58,237,0.12)",
  "--badge-border": "rgba(99,102,241,0.24)",
  "--badge-text": "#5b21b6",
  "--menu-button-color": "rgba(71, 85, 105, 0.84)",
  "--menu-item-hover-bg": "rgba(124,58,237,0.08)",
  "--canvas-overlay":
    "radial-gradient(circle at top, rgba(167, 139, 250, 0.18), transparent 42%), radial-gradient(circle at bottom, rgba(34, 211, 238, 0.14), transparent 34%)",
  "--canvas-pattern-base": "rgba(255,255,255,0.74)",
  "--canvas-pattern-line": "rgba(148,163,184,0.08)",
  "--canvas-boundary": "rgba(191,219,254,0.88)",
  "--canvas-drop-border": "rgba(99,102,241,0.48)",
  "--canvas-drop-bg": "rgba(191,219,254,0.22)",
  "--empty-card-bg": "rgba(255,255,255,0.92)",
  "--empty-primary-bg":
    "linear-gradient(135deg, rgba(124,58,237,0.96), rgba(34,211,238,0.9))",
  "--empty-primary-border": "rgba(255,255,255,0.28)",
  "--empty-primary-text": "#ffffff",
  "--tip-bg": "rgba(248,250,252,0.92)",
  "--tip-border": "rgba(191,219,254,0.9)",
  "--tip-text": "rgba(71,85,105,0.82)",
  "--toast-bg": "rgba(255,255,255,0.92)",
  "--toast-border": "rgba(191,219,254,0.9)",
  "--toast-text": "#334155",
  "--selection-outline": "rgba(79, 70, 229, 0.9)",
  "--selection-shadow":
    "0 0 0 2px rgba(99,102,241,0.14), 0 12px 32px rgba(99,102,241,0.16)",
  "--handle-fill": "rgba(255,255,255,1)",
  "--handle-shadow":
    "0 0 0 1px rgba(99,102,241,0.28), 0 0 18px rgba(99,102,241,0.18)",
  "--selection-mask": "rgba(255,255,255,0.18)",
  "--selection-fill": "rgba(124,58,237,0.08)",
  "--selection-stroke": "rgba(79,70,229,0.88)",
  "--selection-dot": "rgba(79,70,229,0.96)",
  "--slider-track": "rgba(148,163,184,0.2)",
  "--slider-accent": "rgba(79,70,229,0.96)",
} as CSSProperties;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getDisplayLayerName = (name: string) => {
  const compactName = name.replace(/\.[^.]+$/, "");
  return compactName || name;
};

const getHandleCursor = (handle: ResizeHandle) => {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
  }
};

const clampMomentum = (value: number, zoom: number) =>
  clamp((value * MOMENTUM_MULTIPLIER) / zoom, -18, 18);

const cloneLayers = (layers: ImageLayer[]) => layers.map((layer) => ({ ...layer }));

const cloneDocumentSnapshot = (snapshot: DocumentSnapshot): DocumentSnapshot => ({
  layers: cloneLayers(snapshot.layers),
  selectedLayerId: snapshot.selectedLayerId,
});

const serializeDocumentSnapshot = (snapshot: DocumentSnapshot) =>
  JSON.stringify(snapshot);

const getValidSelectedLayerId = (
  candidate: string | null,
  layers: ImageLayer[],
): string | null => {
  if (candidate && layers.some((layer) => layer.id === candidate)) {
    return candidate;
  }

  return layers.at(-1)?.id ?? null;
};

const getResizeHandleFromPointer = (
  event: ReactPointerEvent<HTMLElement>,
): ResizeHandle | null => {
  const rect = event.currentTarget.getBoundingClientRect();
  const threshold = clamp(
    Math.min(rect.width, rect.height) * 0.14,
    RESIZE_EDGE_THRESHOLD_MIN,
    RESIZE_EDGE_THRESHOLD_MAX,
  );
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const nearLeft = x <= threshold;
  const nearRight = rect.width - x <= threshold;
  const nearTop = y <= threshold;
  const nearBottom = rect.height - y <= threshold;

  if (nearTop && nearLeft) return "nw";
  if (nearTop && nearRight) return "ne";
  if (nearBottom && nearLeft) return "sw";
  if (nearBottom && nearRight) return "se";
  if (nearTop) return "n";
  if (nearBottom) return "s";
  if (nearLeft) return "w";
  if (nearRight) return "e";

  return null;
};

const getToolbarButtonClass = ({
  isActive = false,
  isDisabled = false,
}: {
  isActive?: boolean;
  isDisabled?: boolean;
} = {}) =>
  [
    "theme-control-button flex h-11 w-11 items-center justify-center border transition-all duration-150",
    isActive ? "is-active" : "",
    isDisabled ? "is-disabled" : "",
  ].join(" ");

const getSecondaryControlClass = ({
  isDisabled = false,
}: {
  isDisabled?: boolean;
} = {}) =>
  [
    "theme-secondary-button flex h-10 items-center justify-center border px-3 text-[12px] font-medium transition-all duration-150",
    isDisabled ? "is-disabled" : "",
  ].join(" ");

const distanceBetweenPoints = (start: Point, end: Point) =>
  Math.hypot(end.x - start.x, end.y - start.y);

const appendPointIfNeeded = (points: Point[], nextPoint: Point) => {
  const lastPoint = points.at(-1);

  if (!lastPoint || distanceBetweenPoints(lastPoint, nextPoint) >= LASSO_POINT_GAP) {
    return [...points, nextPoint];
  }

  return points;
};

const getBounds = (points: Point[]): Bounds => ({
  minX: Math.min(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)),
  maxX: Math.max(...points.map((point) => point.x)),
  maxY: Math.max(...points.map((point) => point.y)),
});

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  nextItems.splice(toIndex, 0, movedItem);

  return nextItems;
};

const readImageFile = async (file: File): Promise<ImageLayer> => {
  const src = URL.createObjectURL(file);

  const { width, height } = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const image = new window.Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => reject(new Error(`이미지 로드 실패: ${file.name}`));
      image.src = src;
    },
  );

  const baseScale = Math.min(1, 460 / Math.max(width, height));

  return {
    id: crypto.randomUUID(),
    name: file.name,
    src,
    width: Math.max(88, Math.round(width * baseScale)),
    height: Math.max(88, Math.round(height * baseScale)),
    visible: true,
    x: 0,
    y: 0,
    opacity: 1,
  };
};

const isEditableElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

export function ImageEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layersButtonRef = useRef<HTMLButtonElement>(null);
  const layersPopoverRef = useRef<HTMLDivElement>(null);
  const stageViewportRef = useRef<HTMLDivElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const layersRef = useRef<ImageLayer[]>([]);
  const selectedLayerIdRef = useRef<string | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const lassoDraftRef = useRef<LassoDraft | null>(null);
  const interactionTargetRef = useRef<HTMLElement | null>(null);
  const transientLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayerPatchesRef = useRef<Record<string, Partial<ImageLayer>>>({});
  const animationFrameRef = useRef<number | null>(null);
  const interactionStartSnapshotRef = useRef<DocumentSnapshot | null>(null);
  const opacitySnapshotRef = useRef<DocumentSnapshot | null>(null);

  const [layers, setLayers] = useState<ImageLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>("pointer");
  const [zoom, setZoom] = useState(1);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isCanvasDropTarget, setIsCanvasDropTarget] = useState(false);
  const [lassoDraft, setLassoDraft] = useState<LassoDraft | null>(null);
  const [lassoSelections, setLassoSelections] = useState<
    Record<string, LassoSelection | undefined>
  >({});
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [transientLabel, setTransientLabel] = useState<string | null>(null);
  const [hoveredResizeHandle, setHoveredResizeHandle] = useState<{
    handle: ResizeHandle;
    layerId: string;
  } | null>(null);
  const [openLayerMenuId, setOpenLayerMenuId] = useState<string | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<ActiveInteraction | null>(
    null,
  );
  const [historyState, setHistoryState] = useState<HistoryState>({
    past: [],
    future: [],
  });

  const historyRef = useRef<HistoryState>(historyState);

  const displayLayers = useMemo(() => [...layers].reverse(), [layers]);

  const currentDocumentSerialized = useMemo(
    () => serializeDocumentSnapshot({ layers, selectedLayerId }),
    [layers, selectedLayerId],
  );

  const canUndo = useMemo(
    () =>
      historyState.past.some(
        (snapshot) => serializeDocumentSnapshot(snapshot) !== currentDocumentSerialized,
      ),
    [currentDocumentSerialized, historyState.past],
  );

  const canRedo = useMemo(
    () =>
      historyState.future.some(
        (snapshot) => serializeDocumentSnapshot(snapshot) !== currentDocumentSerialized,
      ),
    [currentDocumentSerialized, historyState.future],
  );

  const syncDragState = (nextDragState: DragState | null) => {
    dragStateRef.current = nextDragState;
  };

  const syncLassoDraft = (nextDraft: LassoDraft | null) => {
    lassoDraftRef.current = nextDraft;
    setLassoDraft(nextDraft);
  };

  const showTransientLabel = useCallback((message: string) => {
    if (transientLabelTimerRef.current) {
      clearTimeout(transientLabelTimerRef.current);
    }

    setTransientLabel(message);
    transientLabelTimerRef.current = setTimeout(() => {
      setTransientLabel(null);
    }, 900);
  }, []);

  const getCurrentDocumentSnapshot = useCallback(
    () =>
      cloneDocumentSnapshot({
        layers: layersRef.current,
        selectedLayerId: selectedLayerIdRef.current,
      }),
    [],
  );

  const checkpointDocument = useCallback(
    (snapshot: DocumentSnapshot) => {
      const serializedSnapshot = serializeDocumentSnapshot(snapshot);
      const trimmedPast = historyRef.current.past.slice(-(HISTORY_LIMIT - 1));
      const lastSnapshot = trimmedPast.at(-1);
      const nextPast =
        lastSnapshot &&
        serializeDocumentSnapshot(lastSnapshot) === serializedSnapshot
          ? trimmedPast
          : [...trimmedPast, cloneDocumentSnapshot(snapshot)];

      const nextHistory = {
        past: nextPast,
        future: [],
      };
      historyRef.current = nextHistory;
      setHistoryState(nextHistory);
    },
    [],
  );

  const revokeAllObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((src) => URL.revokeObjectURL(src));
    objectUrlsRef.current = [];
  }, []);

  const releaseInteractionPointerCapture = useCallback(() => {
    const interactionTarget = interactionTargetRef.current;
    const pointerId =
      dragStateRef.current?.pointerId ??
      resizeStateRef.current?.pointerId ??
      lassoDraftRef.current?.pointerId;

    if (
      interactionTarget &&
      pointerId !== undefined &&
      interactionTarget.hasPointerCapture?.(pointerId)
    ) {
      interactionTarget.releasePointerCapture(pointerId);
    }

    interactionTargetRef.current = null;
  }, []);

  const discardPendingLayerPatches = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    pendingLayerPatchesRef.current = {};
  }, []);

  const clearInteractionState = useCallback(() => {
    syncDragState(null);
    resizeStateRef.current = null;
    syncLassoDraft(null);
    setHoveredResizeHandle(null);
    setActiveInteraction(null);
    interactionStartSnapshotRef.current = null;
    interactionTargetRef.current = null;
  }, []);

  const restoreDocumentSnapshot = useCallback((snapshot: DocumentSnapshot) => {
    const restoredLayers = cloneLayers(snapshot.layers);
    setLayers(restoredLayers);
    setSelectedLayerId(getValidSelectedLayerId(snapshot.selectedLayerId, restoredLayers));
    setExpandedLayerId(null);
    setOpenLayerMenuId(null);
  }, []);

  const cancelActiveInteractions = useCallback(
    (options?: { restoreDocument?: boolean }) => {
      const shouldRestore = options?.restoreDocument ?? false;
      const interactionStartSnapshot = interactionStartSnapshotRef.current;

      releaseInteractionPointerCapture();
      discardPendingLayerPatches();

      if (shouldRestore && interactionStartSnapshot) {
        restoreDocumentSnapshot(interactionStartSnapshot);
      }

      clearInteractionState();
    },
    [clearInteractionState, discardPendingLayerPatches, releaseInteractionPointerCapture, restoreDocumentSnapshot],
  );

  const findDistinctSnapshotIndex = (
    snapshots: DocumentSnapshot[],
    serializedCurrentSnapshot: string,
  ) => {
    for (let index = snapshots.length - 1; index >= 0; index -= 1) {
      if (serializeDocumentSnapshot(snapshots[index]) !== serializedCurrentSnapshot) {
        return index;
      }
    }

    return -1;
  };

  const finalizeOpacityHistory = useCallback(() => {
    const startingSnapshot = opacitySnapshotRef.current;
    opacitySnapshotRef.current = null;

    if (!startingSnapshot) {
      return;
    }

    const currentSnapshot = getCurrentDocumentSnapshot();

    if (
      serializeDocumentSnapshot(startingSnapshot) !==
      serializeDocumentSnapshot(currentSnapshot)
    ) {
      checkpointDocument(startingSnapshot);
      showTransientLabel("Opacity updated");
    }
  }, [checkpointDocument, getCurrentDocumentSnapshot, showTransientLabel]);

  const handleUndo = useCallback(() => {
    finalizeOpacityHistory();
    cancelActiveInteractions();

    const currentSnapshot = getCurrentDocumentSnapshot();
    const currentSerializedSnapshot = serializeDocumentSnapshot(currentSnapshot);
    const snapshotIndex = findDistinctSnapshotIndex(
      historyRef.current.past,
      currentSerializedSnapshot,
    );

    if (snapshotIndex === -1) {
      return;
    }

    const nextSnapshot = historyRef.current.past[snapshotIndex];
    const nextHistory = {
      past: historyRef.current.past.slice(0, snapshotIndex),
      future: [...historyRef.current.future, currentSnapshot],
    };

    restoreDocumentSnapshot(nextSnapshot);
    historyRef.current = nextHistory;
    setHistoryState(nextHistory);
    showTransientLabel("Undo");
  }, [
    cancelActiveInteractions,
    finalizeOpacityHistory,
    getCurrentDocumentSnapshot,
    restoreDocumentSnapshot,
    showTransientLabel,
  ]);

  const handleRedo = useCallback(() => {
    finalizeOpacityHistory();
    cancelActiveInteractions();

    const currentSnapshot = getCurrentDocumentSnapshot();
    const currentSerializedSnapshot = serializeDocumentSnapshot(currentSnapshot);
    const snapshotIndex = findDistinctSnapshotIndex(
      historyRef.current.future,
      currentSerializedSnapshot,
    );

    if (snapshotIndex === -1) {
      return;
    }

    const nextSnapshot = historyRef.current.future[snapshotIndex];
    const nextHistory = {
      past: [...historyRef.current.past, currentSnapshot],
      future: historyRef.current.future.slice(0, snapshotIndex),
    };

    restoreDocumentSnapshot(nextSnapshot);
    historyRef.current = nextHistory;
    setHistoryState(nextHistory);
    showTransientLabel("Redo");
  }, [
    cancelActiveInteractions,
    finalizeOpacityHistory,
    getCurrentDocumentSnapshot,
    restoreDocumentSnapshot,
    showTransientLabel,
  ]);

  const applyZoom = useCallback(
    (nextZoom: number, labelPrefix = "Zoom") => {
      const clampedZoom = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
      setZoom(clampedZoom);
      showTransientLabel(`${labelPrefix} ${Math.round(clampedZoom * 100)}%`);
    },
    [showTransientLabel],
  );

  const zoomIn = useCallback(() => {
    if (layersRef.current.length === 0) {
      return;
    }

    applyZoom(zoom * ZOOM_IN_FACTOR);
  }, [applyZoom, zoom]);

  const zoomOut = useCallback(() => {
    if (layersRef.current.length === 0) {
      return;
    }

    applyZoom(zoom * ZOOM_OUT_FACTOR);
  }, [applyZoom, zoom]);

  const resetZoom = useCallback(() => {
    applyZoom(1, "Reset");
  }, [applyZoom]);

  const flushQueuedLayerPatches = useCallback(() => {
    animationFrameRef.current = null;

    const queuedPatches = pendingLayerPatchesRef.current;
    const patchedLayerIds = Object.keys(queuedPatches);

    if (patchedLayerIds.length === 0) {
      return;
    }

    pendingLayerPatchesRef.current = {};

    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        queuedPatches[layer.id] ? { ...layer, ...queuedPatches[layer.id] } : layer,
      ),
    );
  }, []);

  const queueLayerPatch = useCallback(
    (layerId: string, patch: Partial<ImageLayer>) => {
      pendingLayerPatchesRef.current[layerId] = {
        ...pendingLayerPatchesRef.current[layerId],
        ...patch,
      };

      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(flushQueuedLayerPatches);
      }
    },
    [flushQueuedLayerPatches],
  );

  const getLayerSnapshot = useCallback((layerId: string) => {
    const currentLayer = layersRef.current.find((layer) => layer.id === layerId);

    if (!currentLayer) {
      return null;
    }

    const queuedPatch = pendingLayerPatchesRef.current[layerId];
    return queuedPatch ? { ...currentLayer, ...queuedPatch } : currentLayer;
  }, []);

  useEffect(() => {
    layersRef.current = layers;
    selectedLayerIdRef.current = selectedLayerId;
  }, [layers, selectedLayerId]);

  useEffect(() => {
    historyRef.current = historyState;
  }, [historyState]);

  useEffect(() => revokeAllObjectUrls, [revokeAllObjectUrls]);

  useEffect(() => {
    return () => {
      if (transientLabelTimerRef.current) {
        clearTimeout(transientLabelTimerRef.current);
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLayersOpen) {
      return;
    }

    const handlePointerDown = (event: globalThis.PointerEvent | MouseEvent) => {
      const target = event.target as Node;

      if (
        layersPopoverRef.current?.contains(target) ||
        layersButtonRef.current?.contains(target)
      ) {
        return;
      }

      setIsLayersOpen(false);
      setOpenLayerMenuId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isLayersOpen]);

  useEffect(() => {
    if (!openLayerMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest("[data-layer-menu='true']") ||
        target?.closest("[data-layer-menu-trigger='true']")
      ) {
        return;
      }

      setOpenLayerMenuId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openLayerMenuId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const usesModifier = event.metaKey || event.ctrlKey;

      if (usesModifier && !isEditableElement(event.target)) {
        const normalizedKey = event.key.toLowerCase();

        if (normalizedKey === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }

        if (normalizedKey === "y") {
          event.preventDefault();
          handleRedo();
          return;
        }

        if (normalizedKey === "=" || event.key === "+") {
          event.preventDefault();
          zoomIn();
          return;
        }

        if (normalizedKey === "-") {
          event.preventDefault();
          zoomOut();
          return;
        }

        if (normalizedKey === "0") {
          event.preventDefault();
          resetZoom();
          return;
        }
      }

      if (event.key !== "Escape") {
        return;
      }

      if (openLayerMenuId) {
        setOpenLayerMenuId(null);
        return;
      }

      if (isLayersOpen) {
        setIsLayersOpen(false);
        return;
      }

      const drafting = lassoDraftRef.current;

      if (drafting) {
        syncLassoDraft(null);
        return;
      }

      if (!selectedLayerIdRef.current) {
        return;
      }

      setLassoSelections((currentSelections) => {
        if (!currentSelections[selectedLayerIdRef.current ?? ""]) {
          return currentSelections;
        }

        const nextSelections = { ...currentSelections };
        delete nextSelections[selectedLayerIdRef.current ?? ""];
        return nextSelections;
      });
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handleRedo,
    handleUndo,
    isLayersOpen,
    openLayerMenuId,
    resetZoom,
    zoomIn,
    zoomOut,
  ]);

  const getLocalPoint = (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = rect.width === 0 ? 0 : (event.clientX - rect.left) / rect.width;
    const yRatio = rect.height === 0 ? 0 : (event.clientY - rect.top) / rect.height;

    return {
      x: clamp(xRatio * layer.width, 0, layer.width),
      y: clamp(yRatio * layer.height, 0, layer.height),
    };
  };

  const clearLayerSelection = useCallback((layerId: string) => {
    setLassoSelections((currentSelections) => {
      if (!currentSelections[layerId]) {
        return currentSelections;
      }

      const nextSelections = { ...currentSelections };
      delete nextSelections[layerId];
      return nextSelections;
    });
  }, []);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFilesReady = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      if (imageFiles.length === 0) {
        showTransientLabel(files.length > 0 ? "이미지 파일만 추가할 수 있어요" : "No files");
        return;
      }

      const nextLayers = await Promise.all(imageFiles.map((file) => readImageFile(file)));
      const startingIndex = layersRef.current.length;
      const positionedLayers = nextLayers.map((layer, index) => ({
        ...layer,
        x: (startingIndex + index) * 24,
        y: (startingIndex + index) * 18,
      }));

      positionedLayers.forEach((layer) => {
        objectUrlsRef.current.push(layer.src);
      });

      checkpointDocument(getCurrentDocumentSnapshot());
      setLayers((currentLayers) => [...currentLayers, ...positionedLayers]);
      setSelectedLayerId(positionedLayers.at(-1)?.id ?? null);
      setExpandedLayerId(null);
      setOpenLayerMenuId(null);
      setIsCanvasDropTarget(false);
      setZoom((currentZoom) => (layersRef.current.length === 0 ? 1 : currentZoom));
      showTransientLabel(
        positionedLayers.length > 1
          ? `${positionedLayers.length} layers added`
          : `${getDisplayLayerName(positionedLayers[0].name)} added`,
      );
    },
    [checkpointDocument, getCurrentDocumentSnapshot, showTransientLabel],
  );

  const handleToolSelect = (nextTool: Tool) => {
    if (nextTool === "pointer") {
      syncLassoDraft(null);
      setLassoSelections({});
    }

    setActiveTool(nextTool);
    setOpenLayerMenuId(null);
    showTransientLabel(nextTool === "lasso" ? "Lasso active" : "Pointer active");
  };

  const toggleLayerOpacityPanel = (layerId: string) => {
    const layerName = getDisplayLayerName(
      layers.find((layer) => layer.id === layerId)?.name ?? "Layer",
    );
    const nextLayerId = expandedLayerId === layerId ? null : layerId;

    setSelectedLayerId(layerId);
    setExpandedLayerId(nextLayerId);
    setOpenLayerMenuId(null);
    showTransientLabel(nextLayerId ? `${layerName} opacity` : "Opacity hidden");
  };

  const handleFilesAdded = async (event: ChangeEvent<HTMLInputElement>) => {
    await handleFilesReady(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleWheelZoom = (event: WheelEvent<HTMLElement>) => {
    if (layers.length === 0) {
      return;
    }

    event.preventDefault();

    const delta = event.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
    applyZoom(zoom * delta);
  };

  const setLayerVisibility = (layerId: string, visible: boolean) => {
    checkpointDocument(getCurrentDocumentSnapshot());

    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, visible } : layer,
      ),
    );

    if (!visible && expandedLayerId === layerId) {
      setExpandedLayerId(null);
    }

    setOpenLayerMenuId(null);
    showTransientLabel(visible ? "Layer visible" : "Layer hidden");
  };

  const setLayerOpacity = (layerId: string, opacity: number) => {
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, opacity } : layer,
      ),
    );
  };

  const reorderLayers = useCallback(
    (sourceLayerId: string, targetLayerId: string) => {
      if (sourceLayerId === targetLayerId) {
        return;
      }

      checkpointDocument(getCurrentDocumentSnapshot());
      setLayers((currentLayers) => {
        const reversedLayers = [...currentLayers].reverse();
        const sourceIndex = reversedLayers.findIndex((layer) => layer.id === sourceLayerId);
        const targetIndex = reversedLayers.findIndex((layer) => layer.id === targetLayerId);

        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
          return currentLayers;
        }

        return moveItem(reversedLayers, sourceIndex, targetIndex).reverse();
      });
      showTransientLabel("Layer order updated");
    },
    [checkpointDocument, getCurrentDocumentSnapshot, showTransientLabel],
  );

  const getResizedLayerMetrics = (
    resizeState: ResizeState,
    deltaX: number,
    deltaY: number,
  ) => {
    let width = resizeState.originWidth;
    let height = resizeState.originHeight;
    let x = resizeState.originX;
    let y = resizeState.originY;

    if (resizeState.handle.includes("e")) {
      width = clamp(
        resizeState.originWidth + deltaX,
        MIN_LAYER_WIDTH,
        MAX_LAYER_SIZE,
      );
      x = resizeState.originX + (width - resizeState.originWidth) / 2;
    }

    if (resizeState.handle.includes("w")) {
      width = clamp(
        resizeState.originWidth - deltaX,
        MIN_LAYER_WIDTH,
        MAX_LAYER_SIZE,
      );
      x = resizeState.originX - (width - resizeState.originWidth) / 2;
    }

    if (resizeState.handle.includes("s")) {
      height = clamp(
        resizeState.originHeight + deltaY,
        MIN_LAYER_HEIGHT,
        MAX_LAYER_SIZE,
      );
      y = resizeState.originY + (height - resizeState.originHeight) / 2;
    }

    if (resizeState.handle.includes("n")) {
      height = clamp(
        resizeState.originHeight - deltaY,
        MIN_LAYER_HEIGHT,
        MAX_LAYER_SIZE,
      );
      y = resizeState.originY - (height - resizeState.originHeight) / 2;
    }

    return { height, width, x, y };
  };

  const beginLassoSelection = (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => {
    const startingPoint = getLocalPoint(event, layer);

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionTargetRef.current = event.currentTarget;

    clearLayerSelection(layer.id);
    syncLassoDraft({
      layerId: layer.id,
      pointerId: event.pointerId,
      points: [startingPoint],
    });
  };

  const updateLassoSelection = (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => {
    const currentDraft = lassoDraftRef.current;

    if (
      !currentDraft ||
      currentDraft.layerId !== layer.id ||
      currentDraft.pointerId !== event.pointerId
    ) {
      return;
    }

    const nextPoint = getLocalPoint(event, layer);
    const nextPoints = appendPointIfNeeded(currentDraft.points, nextPoint);

    if (nextPoints === currentDraft.points) {
      return;
    }

    syncLassoDraft({ ...currentDraft, points: nextPoints });
  };

  const finishLassoSelection = (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => {
    const currentDraft = lassoDraftRef.current;

    if (
      !currentDraft ||
      currentDraft.layerId !== layer.id ||
      currentDraft.pointerId !== event.pointerId
    ) {
      return;
    }

    const finalPoint = getLocalPoint(event, layer);
    const finalizedPoints = appendPointIfNeeded(currentDraft.points, finalPoint);

    releaseInteractionPointerCapture();
    syncLassoDraft(null);

    if (finalizedPoints.length < 3) {
      clearLayerSelection(layer.id);
      return;
    }

    const bounds = getBounds(finalizedPoints);

    if (
      bounds.maxX - bounds.minX < MIN_LASSO_SIZE ||
      bounds.maxY - bounds.minY < MIN_LASSO_SIZE
    ) {
      clearLayerSelection(layer.id);
      return;
    }

    setLassoSelections((currentSelections) => ({
      ...currentSelections,
      [layer.id]: {
        layerId: layer.id,
        points: finalizedPoints,
        closed: true,
        bounds,
      },
    }));
    showTransientLabel("Selection updated");
  };

  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    layer: ImageLayer,
    handle: ResizeHandle,
  ) => {
    if (activeTool !== "pointer") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const wrapper = event.currentTarget.closest(
      '[data-layer-wrapper="true"]',
    ) as HTMLButtonElement | null;

    if (!wrapper) {
      return;
    }

    interactionStartSnapshotRef.current = getCurrentDocumentSnapshot();
    setSelectedLayerId(layer.id);
    setOpenLayerMenuId(null);
    setHoveredResizeHandle({
      handle,
      layerId: layer.id,
    });
    wrapper.setPointerCapture(event.pointerId);
    interactionTargetRef.current = wrapper;
    resizeStateRef.current = {
      handle,
      layerId: layer.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originHeight: layer.height,
      originWidth: layer.width,
      originX: layer.x,
      originY: layer.y,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTimestamp: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
    };
    setActiveInteraction({
      handle,
      layerId: layer.id,
      mode: "resize",
    });
  };

  const handleLayerPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => {
    setSelectedLayerId(layer.id);
    setOpenLayerMenuId(null);

    if (activeTool === "lasso") {
      beginLassoSelection(event, layer);
      return;
    }

    if (layer.id === selectedLayerId) {
      const resizeHandle = getResizeHandleFromPointer(event);

      if (resizeHandle) {
        handleResizePointerDown(event, layer, resizeHandle);
        return;
      }
    }

    interactionStartSnapshotRef.current = getCurrentDocumentSnapshot();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionTargetRef.current = event.currentTarget;
    syncDragState({
      layerId: layer.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: layer.x,
      originY: layer.y,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTimestamp: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
    });
    setActiveInteraction({
      layerId: layer.id,
      mode: "drag",
    });
  };

  const handleLayerPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => {
    if (
      activeTool === "pointer" &&
      !dragStateRef.current &&
      !resizeStateRef.current &&
      layer.id === selectedLayerId
    ) {
      const hoverHandle = getResizeHandleFromPointer(event);

      setHoveredResizeHandle(
        hoverHandle
          ? {
              handle: hoverHandle,
              layerId: layer.id,
            }
          : null,
      );
    }

    if (activeTool === "lasso") {
      updateLassoSelection(event, layer);
      return;
    }

    const currentResizeState = resizeStateRef.current;

    if (
      currentResizeState &&
      currentResizeState.layerId === layer.id &&
      currentResizeState.pointerId === event.pointerId
    ) {
      const elapsed = Math.max(event.timeStamp - currentResizeState.lastTimestamp, 1);
      const deltaX = (event.clientX - currentResizeState.startX) / zoom;
      const deltaY = (event.clientY - currentResizeState.startY) / zoom;

      queueLayerPatch(
        layer.id,
        getResizedLayerMetrics(currentResizeState, deltaX, deltaY),
      );

      resizeStateRef.current = {
        ...currentResizeState,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        lastTimestamp: event.timeStamp,
        velocityX: (event.clientX - currentResizeState.lastClientX) / elapsed,
        velocityY: (event.clientY - currentResizeState.lastClientY) / elapsed,
      };

      return;
    }

    const currentDragState = dragStateRef.current;

    if (
      !currentDragState ||
      currentDragState.layerId !== layer.id ||
      currentDragState.pointerId !== event.pointerId
    ) {
      return;
    }

    const deltaX = (event.clientX - currentDragState.startX) / zoom;
    const deltaY = (event.clientY - currentDragState.startY) / zoom;

    queueLayerPatch(layer.id, {
      x: currentDragState.originX + deltaX,
      y: currentDragState.originY + deltaY,
    });

    const elapsed = Math.max(event.timeStamp - currentDragState.lastTimestamp, 1);
    syncDragState({
      ...currentDragState,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTimestamp: event.timeStamp,
      velocityX: (event.clientX - currentDragState.lastClientX) / elapsed,
      velocityY: (event.clientY - currentDragState.lastClientY) / elapsed,
    });
  };

  const handleLayerPointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => {
    if (activeTool === "lasso") {
      finishLassoSelection(event, layer);
      return;
    }

    const interactionStartSnapshot = interactionStartSnapshotRef.current;
    const currentResizeState = resizeStateRef.current;

    if (
      currentResizeState &&
      currentResizeState.layerId === layer.id &&
      currentResizeState.pointerId === event.pointerId
    ) {
      const currentLayer = getLayerSnapshot(layer.id);

      releaseInteractionPointerCapture();
      resizeStateRef.current = null;
      setActiveInteraction(null);
      setHoveredResizeHandle(null);
      interactionStartSnapshotRef.current = null;

      if (currentLayer) {
        delete pendingLayerPatchesRef.current[layer.id];

        const momentumX = clampMomentum(currentResizeState.velocityX, zoom);
        const momentumY = clampMomentum(currentResizeState.velocityY, zoom);
        let width = currentLayer.width;
        let height = currentLayer.height;
        let x = currentLayer.x;
        let y = currentLayer.y;

        if (currentResizeState.handle.includes("e")) {
          width = clamp(width + momentumX, MIN_LAYER_WIDTH, MAX_LAYER_SIZE);
          x = currentLayer.x + (width - currentLayer.width) / 2;
        }

        if (currentResizeState.handle.includes("w")) {
          width = clamp(width - momentumX, MIN_LAYER_WIDTH, MAX_LAYER_SIZE);
          x = currentLayer.x - (width - currentLayer.width) / 2;
        }

        if (currentResizeState.handle.includes("s")) {
          height = clamp(height + momentumY, MIN_LAYER_HEIGHT, MAX_LAYER_SIZE);
          y = currentLayer.y + (height - currentLayer.height) / 2;
        }

        if (currentResizeState.handle.includes("n")) {
          height = clamp(height - momentumY, MIN_LAYER_HEIGHT, MAX_LAYER_SIZE);
          y = currentLayer.y - (height - currentLayer.height) / 2;
        }

        const finalizedLayer = {
          ...currentLayer,
          height,
          width,
          x,
          y,
        };

        const finalSnapshot = {
          layers: layersRef.current.map((currentLayerState) =>
            currentLayerState.id === layer.id ? finalizedLayer : { ...currentLayerState },
          ),
          selectedLayerId: selectedLayerIdRef.current,
        };

        if (
          interactionStartSnapshot &&
          serializeDocumentSnapshot(interactionStartSnapshot) !==
            serializeDocumentSnapshot(finalSnapshot)
        ) {
          checkpointDocument(interactionStartSnapshot);
        }

        setLayers((currentLayers) =>
          currentLayers.map((currentLayerState) =>
            currentLayerState.id === layer.id ? finalizedLayer : currentLayerState,
          ),
        );
      }

      return;
    }

    const currentDragState = dragStateRef.current;
    const currentLayer = getLayerSnapshot(layer.id);
    const momentumX = currentDragState ? clampMomentum(currentDragState.velocityX, zoom) : 0;
    const momentumY = currentDragState ? clampMomentum(currentDragState.velocityY, zoom) : 0;

    releaseInteractionPointerCapture();
    syncDragState(null);
    setActiveInteraction(null);
    setHoveredResizeHandle(null);
    interactionStartSnapshotRef.current = null;

    if (currentLayer) {
      delete pendingLayerPatchesRef.current[layer.id];

      const finalizedLayer = {
        ...currentLayer,
        x: currentLayer.x + momentumX,
        y: currentLayer.y + momentumY,
      };

      const finalSnapshot = {
        layers: layersRef.current.map((currentLayerState) =>
          currentLayerState.id === layer.id ? finalizedLayer : { ...currentLayerState },
        ),
        selectedLayerId: selectedLayerIdRef.current,
      };

      if (
        interactionStartSnapshot &&
        serializeDocumentSnapshot(interactionStartSnapshot) !==
          serializeDocumentSnapshot(finalSnapshot)
      ) {
        checkpointDocument(interactionStartSnapshot);
      }

      setLayers((currentLayers) =>
        currentLayers.map((currentLayerState) =>
          currentLayerState.id === layer.id ? finalizedLayer : currentLayerState,
        ),
      );
    }
  };

  const handleLayerPointerCancel = (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => {
    if (activeTool === "lasso") {
      const currentDraft = lassoDraftRef.current;

      if (
        currentDraft &&
        currentDraft.layerId === layer.id &&
        currentDraft.pointerId === event.pointerId
      ) {
        releaseInteractionPointerCapture();
      }

      syncLassoDraft(null);
      return;
    }

    const currentResizeState = resizeStateRef.current;
    const currentDragState = dragStateRef.current;

    if (
      (currentResizeState &&
        currentResizeState.layerId === layer.id &&
        currentResizeState.pointerId === event.pointerId) ||
      (currentDragState &&
        currentDragState.layerId === layer.id &&
        currentDragState.pointerId === event.pointerId)
    ) {
      cancelActiveInteractions({ restoreDocument: true });
    }
  };

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const canZoomOut = layers.length > 0 && zoom > ZOOM_MIN + 0.001;
  const canZoomIn = layers.length > 0 && zoom < ZOOM_MAX - 0.001;

  return (
    <div
      className="editor-shell relative flex min-h-screen flex-col overflow-hidden"
      style={CANVA_THEME_STYLE}
    >
      <input
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        multiple
        type="file"
        onChange={handleFilesAdded}
      />

      <header className="fixed inset-x-0 top-3 z-30 px-4">
        <div className="mx-auto flex w-full max-w-[1240px] items-start justify-between gap-3">
          <div className="soft-panel flex items-center gap-1 rounded-2xl px-2 py-2">
            <button
              aria-label="이미지 불러오기"
              className={getToolbarButtonClass()}
              title="이미지 불러오기"
              type="button"
              onClick={openFilePicker}
            >
              <FolderSimplePlus size={19} weight="duotone" />
            </button>

            <div className="mx-1 h-7 w-px bg-[color:var(--divider)]" />

            <button
              aria-label="포인터 선택 도구"
              className={getToolbarButtonClass({ isActive: activeTool === "pointer" })}
              title="포인터"
              type="button"
              onClick={() => handleToolSelect("pointer")}
            >
              <Cursor
                size={19}
                weight={activeTool === "pointer" ? "duotone" : "regular"}
              />
            </button>
            <button
              aria-label="올가미 선택 도구"
              className={getToolbarButtonClass({ isActive: activeTool === "lasso" })}
              title="올가미"
              type="button"
              onClick={() => handleToolSelect("lasso")}
            >
              <Lasso size={19} weight={activeTool === "lasso" ? "duotone" : "regular"} />
            </button>

            <div className="mx-1 h-7 w-px bg-[color:var(--divider)]" />

            <button
              aria-label="되돌리기"
              className={getToolbarButtonClass({ isDisabled: !canUndo })}
              disabled={!canUndo}
              title="Undo (⌘/Ctrl+Z)"
              type="button"
              onClick={handleUndo}
            >
              <ArrowCounterClockwise size={19} weight="bold" />
            </button>
            <button
              aria-label="다시 실행"
              className={getToolbarButtonClass({ isDisabled: !canRedo })}
              disabled={!canRedo}
              title="Redo (⇧⌘/Ctrl+Z)"
              type="button"
              onClick={handleRedo}
            >
              <ArrowClockwise size={19} weight="bold" />
            </button>
          </div>

          <div className="soft-panel flex items-center gap-1 rounded-2xl px-2 py-2">
            <button
              aria-label="축소"
              className={getToolbarButtonClass({ isDisabled: !canZoomOut })}
              disabled={!canZoomOut}
              title="축소"
              type="button"
              onClick={zoomOut}
            >
              <MagnifyingGlassMinus size={19} weight="bold" />
            </button>
            <button
              aria-label="확대"
              className={getToolbarButtonClass({ isDisabled: !canZoomIn })}
              disabled={!canZoomIn}
              title="확대"
              type="button"
              onClick={zoomIn}
            >
              <MagnifyingGlassPlus size={19} weight="bold" />
            </button>
            <button
              aria-label="100%로 재설정"
              className={getSecondaryControlClass({ isDisabled: layers.length === 0 })}
              disabled={layers.length === 0}
              title="100%"
              type="button"
              onClick={resetZoom}
            >
              {zoomLabel}
            </button>
          </div>

          <div className="pointer-events-auto relative">
            <button
              ref={layersButtonRef}
              aria-expanded={isLayersOpen}
              aria-haspopup="dialog"
              aria-label="레이어 패널 열기"
              className={getToolbarButtonClass({ isActive: isLayersOpen })}
              title="레이어"
              type="button"
              onClick={() => {
                setOpenLayerMenuId(null);
                setIsLayersOpen((currentState) => !currentState);
              }}
            >
              <Stack size={19} weight={isLayersOpen ? "duotone" : "regular"} />
            </button>

            {isLayersOpen ? (
              <div
                ref={layersPopoverRef}
                className="soft-panel absolute right-0 top-[calc(100%+10px)] z-40 w-[344px] overflow-visible rounded-[18px] p-2"
                role="dialog"
                aria-label="레이어 패널"
              >
                  <div className="mb-2 flex items-center justify-between px-2 pt-1">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.22em] text-[color:var(--text-faint)] uppercase">
                        Layers
                      </p>
                      <h2 className="mt-1 text-[15px] font-semibold text-[color:var(--text-primary)]">
                        {layers.length === 0
                          ? "레이어 없음"
                          : `${layers.length} ${layers.length === 1 ? "layer" : "layers"}`}
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {displayLayers.length === 0 ? (
                      <div className="theme-empty-layer-state rounded-2xl border border-dashed px-4 py-8 text-center text-[13px] leading-6">
                        아직 레이어가 없어요. 중앙 캔버스에서 이미지를 올리면 여기서 바로 관리할 수 있어요.
                      </div>
                    ) : (
                      displayLayers.map((layer) => {
                        const displayLayerName = getDisplayLayerName(layer.name);
                        const isSelected = layer.id === selectedLayerId;
                        const isExpanded = layer.id === expandedLayerId;
                        const isDragTarget =
                          dragOverLayerId === layer.id && draggedLayerId !== layer.id;
                        const opacityPercent = Math.round(layer.opacity * 100);

                        return (
                          <div
                            key={layer.id}
                            className="relative space-y-1"
                            onDragEnter={() => setDragOverLayerId(layer.id)}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setDragOverLayerId(layer.id);
                            }}
                            onDrop={(event) => {
                              event.preventDefault();

                              const sourceLayerId =
                                draggedLayerId ?? event.dataTransfer.getData("text/plain");

                              if (sourceLayerId) {
                                reorderLayers(sourceLayerId, layer.id);
                              }

                              setDraggedLayerId(null);
                              setDragOverLayerId(null);
                            }}
                          >
                            <div
                              draggable
                              className={[
                                "theme-layer-row group relative flex items-center gap-2 border px-2 py-2 transition-all duration-150",
                                isSelected ? "is-selected" : "",
                                isDragTarget ? "is-drag-target" : "",
                                draggedLayerId === layer.id ? "opacity-45" : "",
                              ].join(" ")}
                              onDragEnd={() => {
                                setDraggedLayerId(null);
                                setDragOverLayerId(null);
                              }}
                              onDragStart={(event: ReactDragEvent<HTMLDivElement>) => {
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", layer.id);
                                setDraggedLayerId(layer.id);
                                setSelectedLayerId(layer.id);
                                setOpenLayerMenuId(null);
                              }}
                            >
                              <span
                                className={`theme-layer-rail absolute bottom-2 left-0.5 top-2 w-1 rounded-full transition ${
                                  isSelected ? "is-visible" : ""
                                }`}
                              />

                              <div className="relative shrink-0">
                                <button
                                  aria-expanded={openLayerMenuId === layer.id}
                                  aria-haspopup="menu"
                                  aria-label={`${displayLayerName} 레이어 메뉴`}
                                  className="theme-layer-menu-button flex h-10 w-10 items-center justify-center border transition"
                                  data-layer-menu-trigger="true"
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setSelectedLayerId(layer.id);
                                    setOpenLayerMenuId((currentLayerId) =>
                                      currentLayerId === layer.id ? null : layer.id,
                                    );
                                  }}
                                >
                                  <Rows size={15} weight="bold" />
                                </button>

                                {openLayerMenuId === layer.id ? (
                                  <div
                                    className="soft-panel absolute right-[calc(100%+0.45rem)] top-1/2 z-30 min-w-[136px] -translate-y-1/2 rounded-[14px] p-1.5"
                                    data-layer-menu="true"
                                    role="menu"
                                  >
                                    {["배경 제거", "배경 추출"].map((label) => (
                                      <button
                                        key={label}
                                        className="theme-layer-menu-item flex h-9 w-full items-center rounded-[10px] px-3 text-left text-[12px] font-medium transition"
                                        role="menuitem"
                                        type="button"
                                        onClick={() => {
                                          setOpenLayerMenuId(null);
                                          showTransientLabel(`${label} 준비중`);
                                        }}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>

                              <button
                                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
                                title={layer.name}
                                type="button"
                                onClick={() => {
                                  setSelectedLayerId(layer.id);
                                  setOpenLayerMenuId(null);
                                }}
                              >
                                <div
                                  className={`theme-layer-thumbnail relative flex h-11 w-11 items-center justify-center overflow-hidden border ${
                                    isSelected ? "is-selected" : ""
                                  }`}
                                >
                                  <img
                                    alt={layer.name}
                                    className="max-h-full max-w-full object-contain"
                                    src={layer.src}
                                    style={{ opacity: layer.opacity * 0.96 }}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p
                                      className={`truncate text-[13px] font-semibold ${
                                        isSelected
                                          ? "text-[color:var(--text-primary)]"
                                          : "text-[color:var(--text-secondary)]"
                                      }`}
                                    >
                                      {displayLayerName}
                                    </p>
                                    {isSelected ? (
                                      <span className="theme-selected-badge rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase">
                                        Selected
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 truncate text-[11px] text-[color:var(--text-muted)]">
                                    Opacity {opacityPercent}%
                                  </p>
                                </div>
                              </button>

                              <div className="flex items-center gap-1.5">
                                <button
                                  aria-label={isExpanded ? "투명도 패널 닫기" : "투명도 패널 열기"}
                                  className="theme-secondary-button flex h-9 min-w-[58px] items-center justify-center gap-1 border px-2 text-[11px] font-semibold transition"
                                  type="button"
                                  onClick={() => toggleLayerOpacityPanel(layer.id)}
                                >
                                  <span>{opacityPercent}%</span>
                                  <CaretDown
                                    size={11}
                                    className={`transition-transform duration-150 ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                    weight="bold"
                                  />
                                </button>

                                <button
                                  aria-label={layer.visible ? "레이어 숨기기" : "레이어 보이기"}
                                  className="theme-secondary-button flex h-10 w-10 items-center justify-center border transition"
                                  type="button"
                                  onClick={() => setLayerVisibility(layer.id, !layer.visible)}
                                >
                                  {layer.visible ? (
                                    <Eye size={15} weight="regular" />
                                  ) : (
                                    <EyeSlash size={15} weight="regular" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {isExpanded ? (
                              <div className="theme-range-panel ml-8 rounded-2xl border px-4 py-3">
                                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-faint)]">
                                  <span>Opacity</span>
                                  <span className="text-[color:var(--text-secondary)]">{opacityPercent}%</span>
                                </div>
                                <input
                                  aria-label={`${layer.name} 투명도 조절`}
                                  className="layer-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--slider-track)]"
                                  max={100}
                                  min={0}
                                  step={1}
                                  type="range"
                                  value={opacityPercent}
                                  onBlur={finalizeOpacityHistory}
                                  onChange={(event) =>
                                    setLayerOpacity(layer.id, Number(event.target.value) / 100)
                                  }
                                  onFocus={() => {
                                    if (!opacitySnapshotRef.current) {
                                      opacitySnapshotRef.current = getCurrentDocumentSnapshot();
                                    }
                                  }}
                                  onPointerDown={() => {
                                    if (!opacitySnapshotRef.current) {
                                      opacitySnapshotRef.current = getCurrentDocumentSnapshot();
                                    }
                                  }}
                                  onPointerUp={finalizeOpacityHistory}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
          </div>
        </div>
      </header>

      {transientLabel ? (
        <div className="pointer-events-none fixed top-20 left-1/2 z-20 -translate-x-1/2">
          <div className="theme-toast rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-[0.12em] uppercase backdrop-blur-md">
            {transientLabel}
          </div>
        </div>
      ) : null}

      <main className="relative flex flex-1 overflow-hidden pt-20">
        <section
          className="editor-grid relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4"
          onDragEnter={(event) => {
            if (event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              setIsCanvasDropTarget(true);
            }
          }}
          onDragLeave={(event) => {
            const nextTarget = event.relatedTarget as Node | null;
            if (nextTarget && event.currentTarget.contains(nextTarget)) {
              return;
            }
            setIsCanvasDropTarget(false);
          }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              setIsCanvasDropTarget(true);
            }
          }}
          onDrop={async (event) => {
            event.preventDefault();
            setIsCanvasDropTarget(false);
            await handleFilesReady(Array.from(event.dataTransfer.files ?? []));
          }}
          onWheel={handleWheelZoom}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "var(--canvas-overlay)" }}
          />

          {layers.length === 0 ? (
            <div className="pointer-events-auto relative z-10 w-full max-w-[520px]">
              <div
                className={`soft-panel theme-empty-card rounded-[28px] px-8 py-10 text-center transition-all duration-200 ${
                  isCanvasDropTarget ? "is-drop-target" : ""
                }`}
              >
                <div className="theme-empty-icon mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border">
                  <FolderSimplePlus size={24} weight="duotone" />
                </div>
                <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                  이미지를 불러와 시작하세요
                </h1>
                <p className="mx-auto mt-3 max-w-[360px] text-[15px] leading-7 text-[color:var(--text-muted)]">
                  드래그 앤 드롭 또는 파일 선택으로 레이어를 추가하고, 바로 이동·선택·리사이즈를 시작할 수 있어요.
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    className="theme-empty-primary-button flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-2xl border px-5 text-[14px] font-semibold transition"
                    type="button"
                    onClick={openFilePicker}
                  >
                    <FolderSimplePlus size={18} weight="duotone" />
                    이미지 불러오기
                  </button>
                </div>
                <div className="theme-tip mt-6 rounded-2xl border px-4 py-3 text-[12px] leading-6">
                  팁: 이미지를 올린 뒤엔 <span className="text-[color:var(--text-secondary)]">Undo / Redo</span>, <span className="text-[color:var(--text-secondary)]">줌 - / +</span>, <span className="text-[color:var(--text-secondary)]">100%</span>으로 바로 작업 흐름을 제어할 수 있어요.
                </div>
              </div>
            </div>
          ) : (
            <div
              className={[
                "pointer-events-none absolute inset-0 flex items-center justify-center",
                activeTool === "lasso" ? "cursor-crosshair" : "cursor-default",
              ].join(" ")}
            >
              <div
                ref={stageViewportRef}
                className="relative h-[min(78vh,920px)] w-[min(88vw,1320px)]"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                {layers.map((layer, index) => {
                  const isSelected = layer.id === selectedLayerId;
                  const isDragging =
                    activeInteraction?.mode === "drag" &&
                    activeInteraction.layerId === layer.id;
                  const isResizing =
                    activeInteraction?.mode === "resize" &&
                    activeInteraction.layerId === layer.id;
                  const isManipulating = isDragging || isResizing;
                  const draftForLayer =
                    lassoDraft?.layerId === layer.id ? lassoDraft.points : null;
                  const selectionForLayer = lassoSelections[layer.id];

                  if (!layer.visible) {
                    return null;
                  }

                  return (
                    <button
                      key={layer.id}
                      data-layer-wrapper="true"
                      aria-label={`${layer.name} 레이어 선택`}
                      className={[
                        "image-layer pointer-events-auto absolute left-1/2 top-1/2 border-0 bg-transparent p-0",
                        isManipulating
                          ? "transition-none"
                          : "transition-[transform,width,height,box-shadow,border-color] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                        activeTool === "pointer"
                          ? "cursor-grab active:cursor-grabbing"
                          : "cursor-crosshair",
                      ].join(" ")}
                      style={{
                        cursor:
                          activeTool === "lasso"
                            ? "crosshair"
                            : activeInteraction?.mode === "resize" &&
                                activeInteraction.layerId === layer.id
                              ? getHandleCursor(activeInteraction.handle)
                              : hoveredResizeHandle?.layerId === layer.id
                                ? getHandleCursor(hoveredResizeHandle.handle)
                                : isDragging
                                  ? "grabbing"
                                  : "grab",
                        height: `${layer.height}px`,
                        transform: `translate3d(-50%, -50%, 0) translate3d(${layer.x}px, ${layer.y}px, 0)`,
                        width: `${layer.width}px`,
                        willChange: isManipulating ? "transform, width, height" : "auto",
                        zIndex: isSelected ? layers.length + 8 : index + 1,
                      }}
                      type="button"
                      onPointerCancel={(event) => handleLayerPointerCancel(event, layer)}
                      onPointerLeave={() => {
                        if (!dragStateRef.current && !resizeStateRef.current) {
                          setHoveredResizeHandle(null);
                        }
                      }}
                      onPointerDown={(event) => handleLayerPointerDown(event, layer)}
                      onPointerMove={(event) => handleLayerPointerMove(event, layer)}
                      onPointerUp={(event) => handleLayerPointerUp(event, layer)}
                    >
                      <span
                        className={[
                          "theme-selected-outline pointer-events-none absolute inset-0 border transition duration-150",
                          isSelected ? "is-selected" : "",
                        ].join(" ")}
                      />

                      <div className="relative h-full w-full overflow-hidden">
                        <img
                          alt={layer.name}
                          className="block h-full w-full select-none object-fill"
                          draggable={false}
                          src={layer.src}
                          style={{ opacity: layer.opacity }}
                        />

                        {(draftForLayer || selectionForLayer) && (
                          <LayerSelectionOverlay
                            draftPoints={draftForLayer}
                            height={layer.height}
                            layerId={layer.id}
                            selection={selectionForLayer}
                            width={layer.width}
                          />
                        )}
                      </div>

                      {activeTool === "pointer" && isSelected ? (
                        <ResizeHandles
                          layer={layer}
                          onHandlePointerDown={handleResizePointerDown}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

type ResizeHandlesProps = {
  layer: ImageLayer;
  onHandlePointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    layer: ImageLayer,
    handle: ResizeHandle,
  ) => void;
};

function ResizeHandles({ layer, onHandlePointerDown }: ResizeHandlesProps) {
  const handles: Array<{
    className: string;
    handle: ResizeHandle;
    indicatorClassName: string;
  }> = [
    {
      className: "left-5 right-5 -top-4 h-8",
      handle: "n",
      indicatorClassName:
        "left-1/2 top-1/2 h-px w-10 -translate-x-1/2 -translate-y-1/2 rounded-full",
    },
    {
      className: "left-5 right-5 -bottom-4 h-8",
      handle: "s",
      indicatorClassName:
        "left-1/2 top-1/2 h-px w-10 -translate-x-1/2 -translate-y-1/2 rounded-full",
    },
    {
      className: "top-5 bottom-5 -left-4 w-8",
      handle: "w",
      indicatorClassName:
        "left-1/2 top-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 rounded-full",
    },
    {
      className: "top-5 bottom-5 -right-4 w-8",
      handle: "e",
      indicatorClassName:
        "left-1/2 top-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 rounded-full",
    },
    {
      className: "-left-4 -top-4 h-8 w-8",
      handle: "nw",
      indicatorClassName:
        "left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
    },
    {
      className: "-right-4 -top-4 h-8 w-8",
      handle: "ne",
      indicatorClassName:
        "left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
    },
    {
      className: "-left-4 -bottom-4 h-8 w-8",
      handle: "sw",
      indicatorClassName:
        "left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
    },
    {
      className: "-right-4 -bottom-4 h-8 w-8",
      handle: "se",
      indicatorClassName:
        "left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
    },
  ];

  return (
    <>
      {handles.map(({ className, handle, indicatorClassName }) => (
        <span
          key={`${layer.id}-${handle}`}
          className={`absolute ${className} z-20 pointer-events-auto`}
          data-resize-handle={handle}
          style={{ cursor: getHandleCursor(handle) }}
          onPointerDown={(event) => onHandlePointerDown(event, layer, handle)}
        >
          <span
            className={`absolute ${indicatorClassName} transition-opacity duration-150`}
            style={{
              background: "var(--handle-fill)",
              boxShadow: "var(--handle-shadow)",
            }}
          />
        </span>
      ))}
    </>
  );
}

type LayerSelectionOverlayProps = {
  layerId: string;
  width: number;
  height: number;
  selection?: LassoSelection;
  draftPoints?: Point[] | null;
};

function LayerSelectionOverlay({
  draftPoints,
  height,
  layerId,
  selection,
  width,
}: LayerSelectionOverlayProps) {
  const activePoints = draftPoints ?? selection?.points ?? [];

  if (activePoints.length === 0) {
    return null;
  }

  const polygonPoints = activePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const maskId = `lasso-mask-${layerId}`;
  const hasClosedSelection = !draftPoints && Boolean(selection?.closed);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <mask id={maskId}>
          <rect fill="white" height={height} width={width} x={0} y={0} />
          {hasClosedSelection ? <polygon fill="black" points={polygonPoints} /> : null}
        </mask>
      </defs>

      {hasClosedSelection ? (
        <rect
          fill="var(--selection-mask)"
          height={height}
          mask={`url(#${maskId})`}
          width={width}
          x={0}
          y={0}
        />
      ) : null}

      {hasClosedSelection ? (
        <polygon
          fill="var(--selection-fill)"
          points={polygonPoints}
          stroke="var(--selection-stroke)"
          strokeDasharray="8 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          className="lasso-outline"
        />
      ) : (
        <polyline
          fill="var(--selection-fill)"
          points={polygonPoints}
          stroke="var(--selection-stroke)"
          strokeDasharray="8 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          className="lasso-outline"
        />
      )}

      <circle
        cx={activePoints[0]?.x}
        cy={activePoints[0]?.y}
        fill="var(--selection-dot)"
        r={2.5}
      />
    </svg>
  );
}
