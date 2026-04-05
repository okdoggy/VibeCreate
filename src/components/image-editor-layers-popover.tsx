/* eslint-disable @next/next/no-img-element */

import { CaretDown, Eye, EyeSlash, Rows } from "@phosphor-icons/react";
import type {
  DocumentSnapshot,
  ImageLayer,
} from "@/components/image-editor-types";
import type {
  DragEvent as ReactDragEvent,
  MutableRefObject,
  RefObject,
} from "react";

type ImageEditorLayersPopoverProps = {
  displayLayers: ImageLayer[];
  draggedLayerId: string | null;
  dragOverLayerId: string | null;
  expandedLayerId: string | null;
  getCurrentDocumentSnapshot: () => DocumentSnapshot;
  getDisplayLayerName: (name: string) => string;
  layers: ImageLayer[];
  layersPopoverRef: RefObject<HTMLDivElement | null>;
  openLayerMenuId: string | null;
  opacitySnapshotRef: MutableRefObject<DocumentSnapshot | null>;
  selectedLayerId: string | null;
  onFinalizeOpacityHistory: () => void;
  onReorderLayers: (sourceLayerId: string, targetLayerId: string) => void;
  onSetDragOverLayerId: (layerId: string | null) => void;
  onSetDraggedLayerId: (layerId: string | null) => void;
  onSetLayerOpacity: (layerId: string, opacity: number) => void;
  onSetLayerVisibility: (layerId: string, visible: boolean) => void;
  onSetOpenLayerMenuId: (layerId: string | null) => void;
  onSetSelectedLayerId: (layerId: string) => void;
  onShowTransientLabel: (message: string) => void;
  onToggleLayerOpacityPanel: (layerId: string) => void;
};

export function ImageEditorLayersPopover({
  displayLayers,
  draggedLayerId,
  dragOverLayerId,
  expandedLayerId,
  getCurrentDocumentSnapshot,
  getDisplayLayerName,
  layers,
  layersPopoverRef,
  openLayerMenuId,
  opacitySnapshotRef,
  selectedLayerId,
  onFinalizeOpacityHistory,
  onReorderLayers,
  onSetDragOverLayerId,
  onSetDraggedLayerId,
  onSetLayerOpacity,
  onSetLayerVisibility,
  onSetOpenLayerMenuId,
  onSetSelectedLayerId,
  onShowTransientLabel,
  onToggleLayerOpacityPanel,
}: ImageEditorLayersPopoverProps) {
  return (
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
                onDragEnter={() => onSetDragOverLayerId(layer.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  onSetDragOverLayerId(layer.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  const sourceLayerId =
                    draggedLayerId ?? event.dataTransfer.getData("text/plain");

                  if (sourceLayerId) {
                    onReorderLayers(sourceLayerId, layer.id);
                  }

                  onSetDraggedLayerId(null);
                  onSetDragOverLayerId(null);
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
                    onSetDraggedLayerId(null);
                    onSetDragOverLayerId(null);
                  }}
                  onDragStart={(event: ReactDragEvent<HTMLDivElement>) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", layer.id);
                    onSetDraggedLayerId(layer.id);
                    onSetSelectedLayerId(layer.id);
                    onSetOpenLayerMenuId(null);
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
                        onSetSelectedLayerId(layer.id);
                        onSetOpenLayerMenuId(
                          openLayerMenuId === layer.id ? null : layer.id,
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
                              onSetOpenLayerMenuId(null);
                              onShowTransientLabel(`${label} 준비중`);
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
                      onSetSelectedLayerId(layer.id);
                      onSetOpenLayerMenuId(null);
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
                      onClick={() => onToggleLayerOpacityPanel(layer.id)}
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
                      onClick={() => onSetLayerVisibility(layer.id, !layer.visible)}
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
                      <span className="text-[color:var(--text-secondary)]">
                        {opacityPercent}%
                      </span>
                    </div>
                    <input
                      aria-label={`${layer.name} 투명도 조절`}
                      className="layer-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--slider-track)]"
                      max={100}
                      min={0}
                      step={1}
                      type="range"
                      value={opacityPercent}
                      onBlur={onFinalizeOpacityHistory}
                      onChange={(event) =>
                        onSetLayerOpacity(layer.id, Number(event.target.value) / 100)
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
                      onPointerUp={onFinalizeOpacityHistory}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
