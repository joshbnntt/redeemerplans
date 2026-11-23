import { GITHUB_BRANCH, GITHUB_REPO, GITHUB_TOKEN } from '$app/env/private';
import type { GitHubConfig } from './github.ts';

/** GitHub settings from the environment (see src/env.ts), or null if publishing isn't set up yet. */
export function gitHubConfig(): GitHubConfig | null {
	if (!GITHUB_TOKEN) return null;
	return { token: GITHUB_TOKEN, repo: GITHUB_REPO, branch: GITHUB_BRANCH };
}
