import { FolderSimplePlus } from "@phosphor-icons/react";

type ImageEditorEmptyStateProps = {
  isCanvasDropTarget: boolean;
  onOpenFilePicker: () => void;
};

export function ImageEditorEmptyState({
  isCanvasDropTarget,
  onOpenFilePicker,
}: ImageEditorEmptyStateProps) {
  return (
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
            onClick={onOpenFilePicker}
          >
            <FolderSimplePlus size={18} weight="duotone" />
            이미지 불러오기
          </button>
        </div>
        <div className="theme-tip mt-6 rounded-2xl border px-4 py-3 text-[12px] leading-6">
          팁: 이미지를 올린 뒤엔{" "}
          <span className="text-[color:var(--text-secondary)]">Undo / Redo</span>,{" "}
          <span className="text-[color:var(--text-secondary)]">줌 - / +</span>,{" "}
          <span className="text-[color:var(--text-secondary)]">100%</span>으로 바로 작업
          흐름을 제어할 수 있어요.
        </div>
      </div>
    </div>
  );
}
