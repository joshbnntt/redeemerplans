import { defineEnvVars } from '@sveltejs/kit/env';

/** Optional text setting: returns undefined when unset or blank. */
const optional = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

/** Settings read when the app runs on Vercel. All server-only. */
export const variables = defineEnvVars({
	GITHUB_TOKEN: {
		schema: optional,
		description:
			'Fine-grained GitHub token with Contents read/write on this repository only. Without it, the admin can edit drafts but not publish.'
	},
	GITHUB_REPO: {
		schema: (value) => optional(value) ?? 'joshbnntt/redeemerplans',
		description: 'Repository that holds the plan files, as owner/name.'
	},
	GITHUB_BRANCH: {
		schema: (value) => optional(value) ?? 'main',
		description: 'Branch that publishing commits to. The live site deploys from main.'
	}
});
