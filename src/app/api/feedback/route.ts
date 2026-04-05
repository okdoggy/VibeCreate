import { NextResponse } from "next/server";
import { resolveGitHubFeedbackConfig } from "@/lib/github-feedback-config";
import { buildFeedbackIssueTemplate } from "@/lib/feedback-issue-template";

const GITHUB_API_BASE = "https://api.github.com";

export const runtime = "nodejs";

type FeedbackPayload = {
  action?: unknown;
  category?: unknown;
  details?: unknown;
};

const asCleanString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export async function POST(request: Request) {
  const { owner, repo, token } = resolveGitHubFeedbackConfig();

  if (!token) {
    return NextResponse.json(
      { error: "피드백 연동이 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => null)) as FeedbackPayload | null;

  if (!payload) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const action = asCleanString(payload.action);
  const category = asCleanString(payload.category);
  const details = asCleanString(payload.details);

  if (!action || !category || !details) {
    return NextResponse.json(
      { error: "카테고리와 문제 내용을 모두 입력해주세요." },
      { status: 400 },
    );
  }

  const { body: issueBody, title: issueTitle } = buildFeedbackIssueTemplate({
    action,
    category,
    details,
  });

  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: issueTitle,
      body: issueBody,
    }),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    return NextResponse.json(
      {
        error:
          errorPayload?.message ||
          "GitHub issue 등록 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
      },
      { status: 502 },
    );
  }

  const createdIssue = (await response.json()) as {
    html_url?: string;
    number?: number;
    state?: string;
  };

  if (createdIssue.state && createdIssue.state !== "open") {
    return NextResponse.json(
      { error: "GitHub issue가 open 상태로 생성되지 않았어요." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    issueNumber: createdIssue.number,
    issueUrl: createdIssue.html_url,
    ok: true,
  });
}
