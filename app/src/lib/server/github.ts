/**
 * Minimal GitHub client for publishing plans: read a file, list the plan folder, and commit
 * several files at once (so a plan and a `current` flag change land together).
 * Configured with GITHUB_TOKEN (fine-grained, Contents read/write on this repository only),
 * GITHUB_REPO ("owner/name") and GITHUB_BRANCH.
 */
export type GitHubConfig = { token: string; repo: string; branch: string };
export type RepoFile = { path: string; text: string; sha: string };

export class GitHubError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

export function gitHub(config: GitHubConfig, fetchImpl: typeof fetch = fetch) {
	const base = `https://api.github.com/repos/${config.repo}`;

	async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
		const res = await fetchImpl(base + path, {
			...init,
			headers: {
				accept: 'application/vnd.github+json',
				authorization: `Bearer ${config.token}`,
				'x-github-api-version': '2022-11-28',
				'user-agent': 'redeemer-reading-admin',
				...(init.body ? { 'content-type': 'application/json' } : {}),
				...init.headers
			}
		});
		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw new GitHubError(`GitHub ${init.method ?? 'GET'} ${path} failed (${res.status}): ${detail.slice(0, 200)}`, res.status);
		}
		return (await res.json()) as T;
	}

	const ref = encodeURIComponent(config.branch);

	return {
		/** A file on the branch, or null if it doesn't exist. */
		async getFile(path: string): Promise<RepoFile | null> {
			try {
				const f = await call<{ content: string; sha: string; encoding: string }>(`/contents/${path}?ref=${ref}`);
				const bytes = Uint8Array.from(atob(f.content.replace(/\n/g, '')), (c) => c.charCodeAt(0));
				return { path, text: new TextDecoder().decode(bytes), sha: f.sha };
			} catch (e) {
				if (e instanceof GitHubError && e.status === 404) return null;
				throw e;
			}
		},

		/** Files directly inside a folder on the branch. */
		async listFolder(path: string): Promise<{ name: string; path: string; sha: string }[]> {
			const items = await call<{ name: string; path: string; sha: string; type: string }[]>(`/contents/${path}?ref=${ref}`);
			return items.filter((i) => i.type === 'file');
		},

		/** Commits files to the branch in one commit. Retries once if the branch moved meanwhile. */
		async commit(files: { path: string; content: string }[], message: string): Promise<{ sha: string; url: string }> {
			for (let attempt = 0; ; attempt++) {
				const head = await call<{ object: { sha: string } }>(`/git/ref/heads/${config.branch}`);
				const parent = await call<{ tree: { sha: string } }>(`/git/commits/${head.object.sha}`);
				const tree = await call<{ sha: string }>('/git/trees', {
					method: 'POST',
					body: JSON.stringify({
						base_tree: parent.tree.sha,
						tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content }))
					})
				});
				const commit = await call<{ sha: string; html_url: string }>('/git/commits', {
					method: 'POST',
					body: JSON.stringify({ message, tree: tree.sha, parents: [head.object.sha] })
				});
				try {
					await call(`/git/refs/heads/${config.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
					return { sha: commit.sha, url: commit.html_url };
				} catch (e) {
					// 422: someone pushed in between; build the commit again on top of theirs.
					if (attempt === 0 && e instanceof GitHubError && e.status === 422) continue;
					throw e;
				}
			}
		}
	};
}
