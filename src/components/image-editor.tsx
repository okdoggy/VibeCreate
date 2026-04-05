"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  Cursor,
  FolderSimplePlus,
  Lasso,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Stack,
} from "@phosphor-icons/react";
import { CANVA_THEME_STYLE } from "@/components/image-editor-theme";
import { ImageEditorCanvas } from "@/components/image-editor-canvas";
import { ImageEditorEmptyState } from "@/components/image-editor-empty-state";
import { ImageEditorLayersPopover } from "@/components/image-editor-layers-popover";
import type {
  ActiveInteraction,
  Bounds,
  DocumentSnapshot,
  DragState,
  HistoryState,
  ImageLayer,
  LassoDraft,
  LassoSelection,
  Point,
  ResizeHandle,
  ResizeState,
  Tool,
} from "@/components/image-editor-types";
import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getDisplayLayerName = (name: string) => {
  const compactName = name.replace(/\.[^.]+$/, "");
  return compactName || name;
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
              <ImageEditorLayersPopover
                displayLayers={displayLayers}
                draggedLayerId={draggedLayerId}
                dragOverLayerId={dragOverLayerId}
                expandedLayerId={expandedLayerId}
                getCurrentDocumentSnapshot={getCurrentDocumentSnapshot}
                getDisplayLayerName={getDisplayLayerName}
                layers={layers}
                layersPopoverRef={layersPopoverRef}
                openLayerMenuId={openLayerMenuId}
                opacitySnapshotRef={opacitySnapshotRef}
                selectedLayerId={selectedLayerId}
                onFinalizeOpacityHistory={finalizeOpacityHistory}
                onReorderLayers={reorderLayers}
                onSetDragOverLayerId={setDragOverLayerId}
                onSetDraggedLayerId={setDraggedLayerId}
                onSetLayerOpacity={setLayerOpacity}
                onSetLayerVisibility={setLayerVisibility}
                onSetOpenLayerMenuId={setOpenLayerMenuId}
                onSetSelectedLayerId={setSelectedLayerId}
                onShowTransientLabel={showTransientLabel}
                onToggleLayerOpacityPanel={toggleLayerOpacityPanel}
              />
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
            <ImageEditorEmptyState
              isCanvasDropTarget={isCanvasDropTarget}
              onOpenFilePicker={openFilePicker}
            />
          ) : (
            <ImageEditorCanvas
              activeInteraction={activeInteraction}
              activeTool={activeTool}
              dragStateRef={dragStateRef}
              hoveredResizeHandle={hoveredResizeHandle}
              lassoDraft={lassoDraft}
              lassoSelections={lassoSelections}
              layers={layers}
              resizeStateRef={resizeStateRef}
              selectedLayerId={selectedLayerId}
              zoom={zoom}
              onClearHoveredResizeHandle={() => setHoveredResizeHandle(null)}
              onHandlePointerDown={handleResizePointerDown}
              onLayerPointerCancel={handleLayerPointerCancel}
              onLayerPointerDown={handleLayerPointerDown}
              onLayerPointerMove={handleLayerPointerMove}
              onLayerPointerUp={handleLayerPointerUp}
            />
          )}
        </section>
      </main>
    </div>
  );
}
