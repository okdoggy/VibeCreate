/* eslint-disable @next/next/no-img-element */

import type {
  ActiveInteraction,
  DragState,
  ImageLayer,
  LassoDraft,
  LassoSelection,
  ResizeHandle,
  ResizeState,
  Tool,
} from "@/components/image-editor-types";
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";

type ImageEditorCanvasProps = {
  activeInteraction: ActiveInteraction | null;
  activeTool: Tool;
  dragStateRef: MutableRefObject<DragState | null>;
  hoveredResizeHandle: {
    handle: ResizeHandle;
    layerId: string;
  } | null;
  lassoDraft: LassoDraft | null;
  lassoSelections: Record<string, LassoSelection | undefined>;
  layers: ImageLayer[];
  resizeStateRef: MutableRefObject<ResizeState | null>;
  selectedLayerId: string | null;
  zoom: number;
  onClearHoveredResizeHandle: () => void;
  onHandlePointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    layer: ImageLayer,
    handle: ResizeHandle,
  ) => void;
  onLayerPointerCancel: (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => void;
  onLayerPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => void;
  onLayerPointerMove: (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => void;
  onLayerPointerUp: (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: ImageLayer,
  ) => void;
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

export function ImageEditorCanvas({
  activeInteraction,
  activeTool,
  dragStateRef,
  hoveredResizeHandle,
  lassoDraft,
  lassoSelections,
  layers,
  resizeStateRef,
  selectedLayerId,
  zoom,
  onClearHoveredResizeHandle,
  onHandlePointerDown,
  onLayerPointerCancel,
  onLayerPointerDown,
  onLayerPointerMove,
  onLayerPointerUp,
}: ImageEditorCanvasProps) {
  return (
    <div
      className={[
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        activeTool === "lasso" ? "cursor-crosshair" : "cursor-default",
      ].join(" ")}
    >
      <div
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
              onPointerCancel={(event) => onLayerPointerCancel(event, layer)}
              onPointerLeave={() => {
                if (!dragStateRef.current && !resizeStateRef.current) {
                  onClearHoveredResizeHandle();
                }
              }}
              onPointerDown={(event) => onLayerPointerDown(event, layer)}
              onPointerMove={(event) => onLayerPointerMove(event, layer)}
              onPointerUp={(event) => onLayerPointerUp(event, layer)}
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
                <ResizeHandles layer={layer} onHandlePointerDown={onHandlePointerDown} />
              ) : null}
            </button>
          );
        })}
      </div>
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
  draftPoints?: { x: number; y: number }[] | null;
  height: number;
  layerId: string;
  selection?: LassoSelection;
  width: number;
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
