import packageJson from "../../package.json";

type FeedbackIssueInput = {
  action: string;
  category: string;
  details: string;
};

const WEB_VERSION = `v${packageJson.version.replace(/\.0$/, "")}`;

export const FEEDBACK_ISSUE_TEMPLATE_GUIDE = {
  bodyOrder: ["카테고리", "액션", "사용중인 웹의 버전", "**문제내용**"],
  titlePattern: "[FB][카테고리][액션]",
  webVersion: WEB_VERSION,
} as const;

export const buildFeedbackIssueTemplate = ({
  action,
  category,
  details,
}: FeedbackIssueInput) => ({
  body: [
    `카테고리: ${category}`,
    `액션: ${action}`,
    `사용중인 웹의 버전: ${WEB_VERSION}`,
    "",
    "**문제내용**",
    details,
  ].join("\n"),
  title: `[FB][${category}][${action}]`,
});
