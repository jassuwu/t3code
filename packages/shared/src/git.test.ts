import type { VcsStatusRemoteResult, VcsStatusResult } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  applyGitStatusStreamEvent,
  buildConventionalBranchName,
  buildTemporaryWorktreeBranchName,
  isTemporaryWorktreeBranch,
  normalizeGitRemoteUrl,
  parseGitHubRepositoryNameWithOwnerFromRemoteUrl,
  resolveAutoConventionalBranchName,
  sanitizeConventionalBranchName,
  WORKTREE_BRANCH_PREFIX,
} from "./git.ts";

describe("normalizeGitRemoteUrl", () => {
  it("canonicalizes equivalent GitHub remotes across protocol variants", () => {
    expect(normalizeGitRemoteUrl("git@github.com:T3Tools/T3Code.git")).toBe(
      "github.com/t3tools/t3code",
    );
    expect(normalizeGitRemoteUrl("https://github.com/T3Tools/T3Code.git")).toBe(
      "github.com/t3tools/t3code",
    );
    expect(normalizeGitRemoteUrl("ssh://git@github.com/T3Tools/T3Code")).toBe(
      "github.com/t3tools/t3code",
    );
  });

  it("preserves nested group paths for providers like GitLab", () => {
    expect(normalizeGitRemoteUrl("git@gitlab.com:T3Tools/platform/T3Code.git")).toBe(
      "gitlab.com/t3tools/platform/t3code",
    );
    expect(normalizeGitRemoteUrl("https://gitlab.com/T3Tools/platform/T3Code.git")).toBe(
      "gitlab.com/t3tools/platform/t3code",
    );
  });

  it("drops explicit ports from URL-shaped remotes", () => {
    expect(normalizeGitRemoteUrl("https://gitlab.company.com:8443/team/project.git")).toBe(
      "gitlab.company.com/team/project",
    );
    expect(normalizeGitRemoteUrl("ssh://git@gitlab.company.com:2222/team/project.git")).toBe(
      "gitlab.company.com/team/project",
    );
  });
});

describe("parseGitHubRepositoryNameWithOwnerFromRemoteUrl", () => {
  it("extracts the owner and repository from common GitHub remote shapes", () => {
    expect(
      parseGitHubRepositoryNameWithOwnerFromRemoteUrl("git@github.com:T3Tools/T3Code.git"),
    ).toBe("T3Tools/T3Code");
    expect(
      parseGitHubRepositoryNameWithOwnerFromRemoteUrl("https://github.com/T3Tools/T3Code.git"),
    ).toBe("T3Tools/T3Code");
  });
});

describe("isTemporaryWorktreeBranch", () => {
  it("matches the generated temporary worktree refName format", () => {
    expect(isTemporaryWorktreeBranch(buildTemporaryWorktreeBranchName())).toBe(true);
  });

  it("matches generated temporary worktree refs", () => {
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/deadbeef`)).toBe(true);
    expect(isTemporaryWorktreeBranch(` ${WORKTREE_BRANCH_PREFIX}/deadbeef `)).toBe(true);
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/DEADBEEF`)).toBe(true);
  });

  it("rejects non-temporary refName names", () => {
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/feature/demo`)).toBe(false);
    expect(isTemporaryWorktreeBranch("main")).toBe(false);
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/deadbeef-extra`)).toBe(false);
  });
});

describe("buildConventionalBranchName", () => {
  it("assembles <type>/<name> with a valid conventional type", () => {
    expect(buildConventionalBranchName("feat", "Add login page")).toBe("feat/add-login-page");
    expect(buildConventionalBranchName("FIX", "  Broken reconnect  ")).toBe("fix/broken-reconnect");
    expect(buildConventionalBranchName("hotfix", "patch cve")).toBe("hotfix/patch-cve");
  });

  it("falls back to chore/ when the type is not recognized", () => {
    expect(buildConventionalBranchName("feature", "update")).toBe("chore/update");
    expect(buildConventionalBranchName("", "something")).toBe("chore/something");
    expect(buildConventionalBranchName("nonsense", "thing")).toBe("chore/thing");
  });
});

describe("sanitizeConventionalBranchName", () => {
  it("preserves a valid <type>/<name> input", () => {
    expect(sanitizeConventionalBranchName("feat/add-login")).toBe("feat/add-login");
    expect(sanitizeConventionalBranchName("  Fix/Broken Reconnect  ")).toBe("fix/broken-reconnect");
  });

  it("extracts the conventional type from a conventional-commit subject", () => {
    expect(sanitizeConventionalBranchName("feat: custom summary line")).toBe(
      "feat/custom-summary-line",
    );
    expect(sanitizeConventionalBranchName("fix(auth)!: refresh token flow")).toBe(
      "fix/refresh-token-flow",
    );
  });

  it("prepends chore/ when no recognized type is present", () => {
    expect(sanitizeConventionalBranchName("feature/update-workflow")).toBe(
      "chore/feature/update-workflow",
    );
    expect(sanitizeConventionalBranchName("just a description")).toBe("chore/just-a-description");
  });
});

describe("resolveAutoConventionalBranchName", () => {
  it("returns the sanitized preferred branch when it does not collide", () => {
    expect(resolveAutoConventionalBranchName([], "feat/add-login")).toBe("feat/add-login");
    expect(resolveAutoConventionalBranchName(["main"], "fix/foo")).toBe("fix/foo");
  });

  it("falls back to chore/update when no preferred branch is supplied", () => {
    expect(resolveAutoConventionalBranchName([])).toBe("chore/update");
  });

  it("appends a numeric suffix on collision", () => {
    expect(resolveAutoConventionalBranchName(["feat/add-login"], "feat/add-login")).toBe(
      "feat/add-login-2",
    );
    expect(
      resolveAutoConventionalBranchName(["feat/add-login", "feat/add-login-2"], "feat/add-login"),
    ).toBe("feat/add-login-3");
  });
});

describe("applyGitStatusStreamEvent", () => {
  it("treats a remote-only update as a repository when local state is missing", () => {
    const remote: VcsStatusRemoteResult = {
      hasUpstream: true,
      aheadCount: 2,
      behindCount: 1,
      pr: null,
    };

    expect(applyGitStatusStreamEvent(null, { _tag: "remoteUpdated", remote })).toEqual({
      isRepo: true,
      hasPrimaryRemote: false,
      isDefaultRef: false,
      refName: null,
      hasWorkingTreeChanges: false,
      workingTree: { files: [], insertions: 0, deletions: 0 },
      hasUpstream: true,
      aheadCount: 2,
      behindCount: 1,
      pr: null,
    });
  });

  it("preserves local-only fields when applying a remote update", () => {
    const current: VcsStatusResult = {
      isRepo: true,
      sourceControlProvider: {
        kind: "github",
        name: "GitHub",
        baseUrl: "https://github.com",
      },
      hasPrimaryRemote: true,
      isDefaultRef: false,
      refName: "feature/demo",
      hasWorkingTreeChanges: true,
      workingTree: {
        files: [{ path: "src/demo.ts", insertions: 1, deletions: 0 }],
        insertions: 1,
        deletions: 0,
      },
      hasUpstream: false,
      aheadCount: 0,
      behindCount: 0,
      pr: null,
    };

    const remote: VcsStatusRemoteResult = {
      hasUpstream: true,
      aheadCount: 2,
      behindCount: 1,
      pr: null,
    };

    expect(applyGitStatusStreamEvent(current, { _tag: "remoteUpdated", remote })).toEqual({
      ...current,
      hasUpstream: true,
      aheadCount: 2,
      behindCount: 1,
      pr: null,
    });
  });
});
