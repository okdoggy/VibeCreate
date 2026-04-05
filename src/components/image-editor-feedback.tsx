import {
  ChatCircleText,
  ThumbsDown,
  ThumbsUp,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

type FeedbackCategory = {
  label: string;
  value: string;
};

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  { value: "result-quality", label: "결과 품질이 아쉬워요" },
  { value: "recognition-failure", label: "객체/배경 인식이 잘 안 돼요" },
  { value: "unexpected-result", label: "기대한 동작과 결과가 달라요" },
  { value: "performance", label: "속도나 성능이 느려요" },
  { value: "ui-usability", label: "UI/사용성이 불편해요" },
  { value: "feature-request", label: "기능 개선이 필요해요" },
  { value: "other", label: "기타" },
];

type ImageEditorFeedbackProps = {
  details: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  modalActionLabel: string | null;
  promptActionLabel: string | null;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  onCloseModal: () => void;
  onDetailsChange: (value: string) => void;
  onDislike: () => void;
  onDismissPrompt: () => void;
  onLike: () => void;
  onSubmit: () => void;
};

export function ImageEditorFeedback({
  details,
  errorMessage,
  isSubmitting,
  modalActionLabel,
  promptActionLabel,
  selectedCategory,
  onCategoryChange,
  onCloseModal,
  onDetailsChange,
  onDislike,
  onDismissPrompt,
  onLike,
  onSubmit,
}: ImageEditorFeedbackProps) {
  return (
    <>
      {promptActionLabel ? (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="soft-panel flex min-w-[280px] items-start gap-3 rounded-[22px] px-4 py-4 shadow-[0_18px_44px_rgba(81,115,179,0.18)]">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--secondary-border)] bg-[color:var(--secondary-bg)] text-[color:var(--text-secondary)]">
              <ChatCircleText size={18} weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[color:var(--text-primary)]">
                {promptActionLabel} 방향이 마음에 드셨나요?
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[color:var(--text-muted)]">
                좋아요나 싫어요를 눌러서 빠르게 피드백을 남겨주세요.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="theme-secondary-button flex h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-[12px] font-semibold"
                  type="button"
                  onClick={onLike}
                >
                  <ThumbsUp size={16} weight="duotone" />
                  좋아요
                </button>
                <button
                  className="theme-secondary-button flex h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-[12px] font-semibold"
                  type="button"
                  onClick={onDislike}
                >
                  <ThumbsDown size={16} weight="duotone" />
                  싫어요
                </button>
              </div>
            </div>
            <button
              aria-label="피드백 닫기"
              className="theme-layer-menu-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
              type="button"
              onClick={onDismissPrompt}
            >
              <XCircle size={16} weight="bold" />
            </button>
          </div>
        </div>
      ) : null}

      {modalActionLabel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 px-4 backdrop-blur-sm">
          <div
            className="soft-panel w-full max-w-[520px] rounded-[28px] px-6 py-6 shadow-[0_26px_70px_rgba(31,41,55,0.22)]"
            role="dialog"
            aria-label="피드백 보내기"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.22em] text-[color:var(--text-faint)] uppercase">
                  Feedback
                </p>
                <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                  어떤 점이 아쉬웠나요?
                </h2>
                <p className="mt-2 text-[14px] leading-6 text-[color:var(--text-muted)]">
                  <span className="font-semibold text-[color:var(--text-secondary)]">
                    {modalActionLabel}
                  </span>{" "}
                  흐름에 대한 의견을 GitHub Issue로 자동 등록할게요.
                </p>
              </div>
              <button
                aria-label="피드백 모달 닫기"
                className="theme-layer-menu-button flex h-10 w-10 items-center justify-center rounded-2xl border"
                type="button"
                onClick={onCloseModal}
              >
                <XCircle size={18} weight="bold" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-[12px] font-semibold tracking-[0.16em] text-[color:var(--text-faint)] uppercase">
                  이슈 카테고리
                </span>
                <select
                  className="theme-secondary-button h-12 w-full rounded-2xl border px-4 text-[14px] font-medium outline-none"
                  value={selectedCategory}
                  onChange={(event) => onCategoryChange(event.target.value)}
                >
                  <option value="">카테고리를 선택해주세요</option>
                  {FEEDBACK_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[12px] font-semibold tracking-[0.16em] text-[color:var(--text-faint)] uppercase">
                  문제 내용
                </span>
                <textarea
                  className="min-h-[150px] w-full rounded-[22px] border border-[color:var(--secondary-border)] bg-[color:var(--secondary-bg)] px-4 py-3 text-[14px] leading-6 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--control-border-active)] focus:bg-[color:var(--secondary-bg-hover)]"
                  placeholder="어떤 점이 문제였는지, 기대한 동작은 무엇인지 적어주세요."
                  value={details}
                  onChange={(event) => onDetailsChange(event.target.value)}
                />
              </label>

              {errorMessage ? (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-200/70 bg-rose-50/90 px-4 py-3 text-[13px] leading-5 text-rose-700">
                  <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  className="theme-secondary-button flex h-11 items-center justify-center rounded-2xl border px-4 text-[13px] font-semibold"
                  type="button"
                  onClick={onCloseModal}
                >
                  닫기
                </button>
                <button
                  className="theme-empty-primary-button flex h-11 items-center justify-center rounded-2xl border px-5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                  disabled={isSubmitting || !selectedCategory || !details.trim()}
                  type="button"
                  onClick={onSubmit}
                >
                  {isSubmitting ? "등록 중..." : "GitHub Issue 등록"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
