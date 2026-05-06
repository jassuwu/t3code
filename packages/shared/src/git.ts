import type {
  VcsRef,
  SourceControlProviderInfo,
  VcsStatusLocalResult,
  VcsStatusRemoteResult,
  VcsStatusResult,
  VcsStatusStreamEvent,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Random from "effect/Random";
import { detectSourceControlProviderFromRemoteUrl } from "./sourceControl.ts";

export const WORKTREE_BRANCH_PREFIX = "t3code";
const TEMP_WORKTREE_BRANCH_PATTERN = new RegExp(`^${WORKTREE_BRANCH_PREFIX}\\/[0-9a-f]{8}$`);

/**
 * Conventional-commit-style branch types. The first segment of every
 * generated branch name must be one of these.
 */
export const CONVENTIONAL_BRANCH_TYPES = [
  "feat",
  "fix",
  "hotfix",
  "refactor",
  "chore",
  "docs",
  "test",
  "perf",
  "build",
  "ci",
  "revert",
] as const;
export type ConventionalBranchType = (typeof CONVENTIONAL_BRANCH_TYPES)[number];

const CONVENTIONAL_BRANCH_TYPES_SET: ReadonlySet<string> = new Set(CONVENTIONAL_BRANCH_TYPES);

/**
 * Default type used when an input lacks a recognizable conventional prefix.
 */
export const DEFAULT_CONVENTIONAL_BRANCH_TYPE: ConventionalBranchType = "chore";

export function isConventionalBranchType(value: string): value is ConventionalBranchType {
  return CONVENTIONAL_BRANCH_TYPES_SET.has(value);
}

/**
 * Sanitize an arbitrary string into a valid, lowercase git branch fragment.
 * Strips quotes, collapses separators, limits to 64 chars.
 */
export function sanitizeBranchFragment(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/^[./\s_-]+|[./\s_-]+$/g, "");

  const branchFragment = normalized
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/-+/g, "-")
    .replace(/^[./_-]+|[./_-]+$/g, "")
    .slice(0, 64)
    .replace(/[./_-]+$/g, "");

  return branchFragment.length > 0 ? branchFragment : "update";
}

/**
 * Build a conventional `<type>/<name>` branch name from a type hint and a raw
 * name fragment. Falls back to `chore` when `type` is not a known
 * conventional type.
 */
export function buildConventionalBranchName(type: string, rawName: string): string {
  const normalizedType = type.trim().toLowerCase();
  const resolvedType: ConventionalBranchType = isConventionalBranchType(normalizedType)
    ? normalizedType
    : DEFAULT_CONVENTIONAL_BRANCH_TYPE;
  return `${resolvedType}/${sanitizeBranchFragment(rawName)}`;
}

/**
 * Normalize an already-assembled branch-ish string into a valid
 * `<type>/<name>` form. Supports two leading-type syntaxes:
 *   - `<type>/<rest>` (branch-like input)
 *   - `<type>: <rest>` / `<type>(scope)!: <rest>` (conventional-commit subject)
 * If the input lacks a recognized conventional type prefix, the default type
 * (`chore`) is prepended.
 */
export function sanitizeConventionalBranchName(raw: string): string {
  const trimmed = raw.trim();
  const conventionalCommitMatch = /^([a-z]+)(?:\([^)]*\))?!?:\s*(.+)$/i.exec(trimmed);
  const normalized =
    conventionalCommitMatch && conventionalCommitMatch[1] && conventionalCommitMatch[2]
      ? `${conventionalCommitMatch[1]}/${conventionalCommitMatch[2]}`
      : trimmed;
  const sanitized = sanitizeBranchFragment(normalized);
  const slashIndex = sanitized.indexOf("/");
  if (slashIndex > 0) {
    const maybeType = sanitized.slice(0, slashIndex);
    const rest = sanitized.slice(slashIndex + 1);
    if (isConventionalBranchType(maybeType) && rest.length > 0) {
      return `${maybeType}/${rest}`;
    }
  }
  return `${DEFAULT_CONVENTIONAL_BRANCH_TYPE}/${sanitized}`;
}

const AUTO_CONVENTIONAL_BRANCH_FALLBACK = `${DEFAULT_CONVENTIONAL_BRANCH_TYPE}/update`;

/**
 * Resolve a unique conventional `<type>/<name>` branch name that doesn't
 * collide with any existing branch. Appends a numeric suffix when needed.
 */
export function resolveAutoConventionalBranchName(
  existingBranchNames: readonly string[],
  preferredBranch?: string,
): string {
  const preferred = preferredBranch?.trim();
  const resolvedBase =
    preferred && preferred.length > 0
      ? sanitizeConventionalBranchName(preferred)
      : AUTO_CONVENTIONAL_BRANCH_FALLBACK;
  const existingNames = new Set(existingBranchNames.map((branch) => branch.toLowerCase()));

  if (!existingNames.has(resolvedBase)) {
    return resolvedBase;
  }

  let suffix = 2;
  while (existingNames.has(`${resolvedBase}-${suffix}`)) {
    suffix += 1;
  }

  return `${resolvedBase}-${suffix}`;
}

/**
 * Strip the remote prefix from a remote ref such as `origin/feature/demo`.
 */
export function deriveLocalBranchNameFromRemoteRef(branchName: string): string {
  const firstSeparatorIndex = branchName.indexOf("/");
  if (firstSeparatorIndex <= 0 || firstSeparatorIndex === branchName.length - 1) {
    return branchName;
  }
  return branchName.slice(firstSeparatorIndex + 1);
}

export function buildTemporaryWorktreeBranchName(): string {
  const token = Effect.runSync(Random.nextUUIDv4).replace(/-/g, "").slice(0, 8).toLowerCase();
  return `${WORKTREE_BRANCH_PREFIX}/${token}`;
}

export function isTemporaryWorktreeBranch(refName: string): boolean {
  return TEMP_WORKTREE_BRANCH_PATTERN.test(refName.trim().toLowerCase());
}

/**
 * Normalize a git remote URL into a stable comparison key.
 */
export function normalizeGitRemoteUrl(value: string): string {
  const normalized = value
    .trim()
    .replace(/\/+$/g, "")
    .replace(/\.git$/i, "")
    .toLowerCase();

  if (/^(?:ssh|https?|git):\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      const repositoryPath = url.pathname
        .split("/")
        .filter((segment) => segment.length > 0)
        .join("/");
      if (url.hostname && repositoryPath.includes("/")) {
        return `${url.hostname}/${repositoryPath}`;
      }
    } catch {
      return normalized;
    }
  }

  const scpStyleHostAndPath = /^git@([^:/\s]+)[:/]([^/\s]+(?:\/[^/\s]+)+)$/i.exec(normalized);
  if (scpStyleHostAndPath?.[1] && scpStyleHostAndPath[2]) {
    return `${scpStyleHostAndPath[1]}/${scpStyleHostAndPath[2]}`;
  }

  return normalized;
}

/**
 * Best-effort parse of a GitHub `owner/repo` identifier from common remote URL shapes.
 */
export function parseGitHubRepositoryNameWithOwnerFromRemoteUrl(url: string | null): string | null {
  const trimmed = url?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }

  const match =
    /^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https:\/\/github\.com\/|git:\/\/github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i.exec(
      trimmed,
    );
  const repositoryNameWithOwner = match?.[1]?.trim() ?? "";
  return repositoryNameWithOwner.length > 0 ? repositoryNameWithOwner : null;
}

function deriveLocalBranchNameCandidatesFromRemoteRef(
  branchName: string,
  remoteName?: string,
): ReadonlyArray<string> {
  const candidates = new Set<string>();
  const firstSlashCandidate = deriveLocalBranchNameFromRemoteRef(branchName);
  if (firstSlashCandidate.length > 0) {
    candidates.add(firstSlashCandidate);
  }

  if (remoteName) {
    const remotePrefix = `${remoteName}/`;
    if (branchName.startsWith(remotePrefix) && branchName.length > remotePrefix.length) {
      candidates.add(branchName.slice(remotePrefix.length));
    }
  }

  return [...candidates];
}

/**
 * Hide `origin/*` remote refs when a matching local refName already exists.
 */
export function dedupeRemoteBranchesWithLocalMatches(
  refs: ReadonlyArray<VcsRef>,
): ReadonlyArray<VcsRef> {
  const localBranchNames = new Set(
    refs.filter((refName) => !refName.isRemote).map((refName) => refName.name),
  );

  return refs.filter((refName) => {
    if (!refName.isRemote) {
      return true;
    }

    if (refName.remoteName !== "origin") {
      return true;
    }

    const localBranchCandidates = deriveLocalBranchNameCandidatesFromRemoteRef(
      refName.name,
      refName.remoteName,
    );
    return !localBranchCandidates.some((candidate) => localBranchNames.has(candidate));
  });
}

export function detectSourceControlProviderFromGitRemoteUrl(
  remoteUrl: string,
): SourceControlProviderInfo | null {
  return detectSourceControlProviderFromRemoteUrl(remoteUrl);
}

const EMPTY_GIT_STATUS_REMOTE: VcsStatusRemoteResult = {
  hasUpstream: false,
  aheadCount: 0,
  behindCount: 0,
  aheadOfDefaultCount: 0,
  pr: null,
};

export function mergeGitStatusParts(
  local: VcsStatusLocalResult,
  remote: VcsStatusRemoteResult | null,
): VcsStatusResult {
  return {
    ...local,
    ...(remote ?? EMPTY_GIT_STATUS_REMOTE),
  };
}

function toRemoteStatusPart(status: VcsStatusResult): VcsStatusRemoteResult {
  return {
    hasUpstream: status.hasUpstream,
    aheadCount: status.aheadCount,
    behindCount: status.behindCount,
    ...(status.aheadOfDefaultCount === undefined
      ? {}
      : { aheadOfDefaultCount: status.aheadOfDefaultCount }),
    pr: status.pr,
  };
}

function toLocalStatusPart(status: VcsStatusResult): VcsStatusLocalResult {
  return {
    isRepo: status.isRepo,
    ...(status.sourceControlProvider
      ? { sourceControlProvider: status.sourceControlProvider }
      : {}),
    hasPrimaryRemote: status.hasPrimaryRemote,
    isDefaultRef: status.isDefaultRef,
    refName: status.refName,
    hasWorkingTreeChanges: status.hasWorkingTreeChanges,
    workingTree: status.workingTree,
  };
}

export function applyGitStatusStreamEvent(
  current: VcsStatusResult | null,
  event: VcsStatusStreamEvent,
): VcsStatusResult {
  switch (event._tag) {
    case "snapshot":
      return mergeGitStatusParts(event.local, event.remote);
    case "localUpdated":
      return mergeGitStatusParts(event.local, current ? toRemoteStatusPart(current) : null);
    case "remoteUpdated":
      if (current === null) {
        return mergeGitStatusParts(
          {
            isRepo: true,
            hasPrimaryRemote: false,
            isDefaultRef: false,
            refName: null,
            hasWorkingTreeChanges: false,
            workingTree: { files: [], insertions: 0, deletions: 0 },
          },
          event.remote,
        );
      }
      return mergeGitStatusParts(toLocalStatusPart(current), event.remote);
  }
}
