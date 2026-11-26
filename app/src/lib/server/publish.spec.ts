import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { publishPlan, readInput } from './publish.ts';
import { gitBlobSha, type PlanSource } from '#lib/shared/planFile.js';
import type { gitHub } from './github.ts';

/** In-memory stand-in for the GitHub client. */
function fakeGitHub(files: Record<string, string>) {
	const commits: { files: { path: string; content: string }[]; message: string }[] = [];
	const gh: ReturnType<typeof gitHub> = {
		async getFile(path) {
			const text = files[path];
			return text === undefined ? null : { path, text, sha: await gitBlobSha(text) };
		},
		async listFolder(folder) {
			return Promise.all(
				Object.keys(files)
					.filter((p) => p.startsWith(folder + '/'))
					.map(async (p) => ({ name: p.slice(folder.length + 1), path: p, sha: await gitBlobSha(files[p]) }))
			);
		},
		async commit(changed, message) {
			commits.push({ files: changed, message });
			for (const f of changed) files[f.path] = f.content;
			return { sha: 'abc123', url: 'https://github.com/x/y/commit/abc123' };
		}
	};
	return { gh, commits, files };
}

const plan2026 = readFileSync('../src/plan/2026-january-december.md', 'utf8');
const source = (over: Partial<PlanSource> = {}): PlanSource => ({
	title: '2027 Bible Reading Plan',
	description: 'Our reading plan for the year 2027.',
	start: '2027-01-04',
	current: false,
	plan: [{ day: 'Genesis 1' }, { day: 'Genesis 2' }],
	extra: {},
	...over
});

describe('publishPlan', () => {
	it('adds a new plan file in the existing layout', async () => {
		const { gh, commits, files } = fakeGitHub({ 'src/plan/2026-january-december.md': plan2026 });
		const r = await publishPlan(gh, { source: source() }, ['2026-bible-reading-plan']);
		expect(r).toMatchObject({ ok: true, id: '2027-bible-reading-plan', path: 'src/plan/2027-bible-reading-plan.md', alsoUpdated: [] });
		expect(commits).toHaveLength(1);
		expect(files['src/plan/2027-bible-reading-plan.md']).toContain('start: 01-04-2027\ncurrent: false\nplan:\n  - day: Genesis 1');
		expect(files['src/plan/2026-january-december.md']).toBe(plan2026);
	});

	it('moves "current" to the new plan in the same commit, changing one line of the old one', async () => {
		const { gh, commits, files } = fakeGitHub({ 'src/plan/2026-january-december.md': plan2026 });
		const r = await publishPlan(gh, { source: source({ current: true }) }, []);
		expect(r).toMatchObject({ ok: true, alsoUpdated: ['src/plan/2026-january-december.md'] });
		expect(commits[0].files).toHaveLength(2);
		const before = plan2026.split('\n');
		const after = files['src/plan/2026-january-december.md'].split('\n');
		const changed = before.filter((line, i) => line !== after[i]);
		expect(changed).toEqual(['current: true']);
		expect(after).toContain('current: false');
	});

	it('refuses an extra plan marked current, and leaves the current plan alone', async () => {
		const { gh, commits, files } = fakeGitHub({ 'src/plan/2026-january-december.md': plan2026 });
		const r = await publishPlan(gh, { source: source({ title: 'Advent', current: true, extra: { supplemental: true } }) }, []);
		expect(r).toMatchObject({ ok: false, status: 422 });
		expect(commits).toHaveLength(0);
		expect(files['src/plan/2026-january-december.md']).toBe(plan2026);
	});

	it('publishes an extra plan without touching the current plan', async () => {
		const { gh, files } = fakeGitHub({ 'src/plan/2026-january-december.md': plan2026 });
		const r = await publishPlan(gh, { source: source({ title: 'Advent 2026', start: '2026-12-01', extra: { supplemental: true } }) }, []);
		expect(r).toMatchObject({ ok: true, alsoUpdated: [] });
		expect(files['src/plan/advent-2026.md']).toContain('current: false\nsupplemental: true\n');
		expect(files['src/plan/2026-january-december.md']).toBe(plan2026);
	});

	it('refuses a title another plan already uses', async () => {
		const { gh, commits } = fakeGitHub({});
		const r = await publishPlan(gh, { source: source({ title: '2026 Bible Reading Plan' }) }, ['2026-bible-reading-plan']);
		expect(r).toMatchObject({ ok: false, status: 409 });
		expect(commits).toHaveLength(0);
	});

	it('refuses when someone else changed the plan after it was opened', async () => {
		const { gh, commits } = fakeGitHub({ 'src/plan/2026-january-december.md': plan2026 + '\n' });
		const r = await publishPlan(gh, { file: '2026-january-december.md', baseSha: await gitBlobSha(plan2026), source: source() }, []);
		expect(r).toMatchObject({ ok: false, status: 409 });
		expect(commits).toHaveLength(0);
	});

	it('updates an existing plan when nobody else changed it', async () => {
		const { gh, files } = fakeGitHub({ 'src/plan/2026-january-december.md': plan2026 });
		const r = await publishPlan(gh, { file: '2026-january-december.md', baseSha: await gitBlobSha(plan2026), source: source({ title: '2026 Bible Reading Plan' }) }, []);
		expect(r).toMatchObject({ ok: true, path: 'src/plan/2026-january-december.md' });
		expect(files['src/plan/2026-january-december.md']).toContain('title: 2026 Bible Reading Plan');
	});

	it('refuses a plan with errors, and says which', async () => {
		const { gh, commits } = fakeGitHub({});
		const r = await publishPlan(gh, { source: source({ plan: [{ day: 'Habakuk 1' }] }) }, []);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.status).toBe(422);
			expect(r.issues?.[0]).toMatchObject({ day: 1, fix: 'Habakkuk 1' });
		}
		expect(commits).toHaveLength(0);
	});
});

describe('readInput', () => {
	it('accepts the editor payload and drops anything unexpected', () => {
		const input = readInput({ file: '2026-january-december.md', source: { ...source(), plan: [{ day: 'John 1', evil: '<script>' }] }, other: 1 });
		expect(input?.source.plan).toEqual([{ day: 'John 1' }]);
		expect(input?.file).toBe('2026-january-december.md');
	});

	it('rejects file names that could point outside the plan folder', () => {
		expect(readInput({ file: '../../package.json', source: source() })).toBeNull();
		expect(readInput({ file: 'a/b.md', source: source() })).toBeNull();
		expect(readInput({ source: { title: 1 } })).toBeNull();
	});
});
