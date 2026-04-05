import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_REPO_OWNER = "okdoggy";
const DEFAULT_REPO_NAME = "VibeCreate";
const LOCAL_CONFIG_FILENAME = "github-feedback.config.local.json";

type LocalGitHubFeedbackConfig = {
  owner?: unknown;
  repo?: unknown;
  token?: unknown;
};

const asCleanString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const readLocalConfig = () => {
  try {
    const filePath = path.join(process.cwd(), LOCAL_CONFIG_FILENAME);
    const fileContent = readFileSync(filePath, "utf8");
    return JSON.parse(fileContent) as LocalGitHubFeedbackConfig;
  } catch {
    return null;
  }
};

const resolveGitHubTokenFromCredential = () => {
  try {
    const credentials = execFileSync("git", ["credential", "fill"], {
      cwd: process.cwd(),
      encoding: "utf8",
      input: "protocol=https\nhost=github.com\n\n",
      stdio: ["pipe", "pipe", "ignore"],
    });

    const token = credentials
      .split("\n")
      .find((line) => line.startsWith("password="))
      ?.replace("password=", "")
      .trim();

    return token || null;
  } catch {
    return null;
  }
};

export const GITHUB_FEEDBACK_CONFIG_GUIDE = {
  file: LOCAL_CONFIG_FILENAME,
  shape: {
    owner: "okdoggy",
    repo: "VibeCreate",
    token: "ghp_xxx",
  },
} as const;

export const resolveGitHubFeedbackConfig = () => {
  const localConfig = readLocalConfig();

  const owner =
    asCleanString(localConfig?.owner) ||
    process.env.GITHUB_FEEDBACK_OWNER ||
    DEFAULT_REPO_OWNER;

  const repo =
    asCleanString(localConfig?.repo) ||
    process.env.GITHUB_FEEDBACK_REPO ||
    DEFAULT_REPO_NAME;

  const token =
    asCleanString(localConfig?.token) ||
    process.env.GITHUB_FEEDBACK_TOKEN ||
    resolveGitHubTokenFromCredential();

  return {
    owner,
    repo,
    token,
  };
};
