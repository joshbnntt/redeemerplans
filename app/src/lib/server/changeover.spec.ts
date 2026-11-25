import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { runChangeover } from './changeover.ts';
import { decideChangeover, setCurrentFlag, dateInZone } from '#lib/shared/changeover.js';
import { gitBlobSha, serializePlanFile } from '#lib/shared/planFile.js';
import type { gitHub } from './github.ts';

/** The repository's real plan files plus a 2027 plan starting Monday, Jan 4. */
function realPlans(extra: Record<string, string> = {}) {
	const files: Record<string, string> = {};
	for (const f of readdirSync('../src/plan').filter((f) => f.endsWith('.md'))) {
		files[`src/plan/${f}`] = readFileSync(`../src/plan/${f}`, 'utf8');
	}
	files['src/plan/2027-bible-reading-plan.md'] = serializePlanFile({
		title: '2027 Bible Reading Plan',
		description: '',
		start: '2027-01-04',
		current: false,
		plan: Array.from({ length: 364 }, () => ({ day: 'John 1' })),
		extra: {}
	});
	return { ...files, ...extra };
}

function fakeGitHub(files: Record<string, string>) {
	const commits: { files: { path: string; content: string }[]; message: string }[] = [];
	const gh: ReturnType<typeof gitHub> = {
		async getFile(path) {
			return files[path] === undefined ? null : { path, text: files[path], sha: await gitBlobSha(files[path]) };
		},
		async listFolder(folder) {
			return Object.keys(files)
				.filter((p) => p.startsWith(folder + '/'))
				.map((p) => ({ name: p.slice(folder.length + 1), path: p, sha: '' }));
		},
		async commit(changed, message) {
			commits.push({ files: changed, message });
			for (const f of changed) files[f.path] = f.content;
			return { sha: 'abc', url: 'https://github.com/x/y/commit/abc' };
		}
	};
	return { gh, commits, files };
}

describe('plan changeover (real plan files + a 2027 plan)', () => {
	it('does nothing before the new plan starts', async () => {
		const { gh, commits } = fakeGitHub(realPlans());
		const r = await runChangeover(gh, '2027-01-03');
		expect(r).toMatchObject({ changed: false, reason: '“2026 Bible Reading Plan” is already current.' });
		expect(commits).toHaveLength(0);
	});

	it('moves "current" on the start date, changing exactly one line in each file', async () => {
		const before = realPlans();
		const { gh, commits, files } = fakeGitHub({ ...before });
		const r = await runChangeover(gh, '2027-01-04');
		expect(r).toMatchObject({ changed: true, to: '2027 Bible Reading Plan', from: ['2026 Bible Reading Plan'] });
		expect(commits).toHaveLength(1);
		expect(commits[0].files.map((f) => f.path).sort()).toEqual(['src/plan/2026-january-december.md', 'src/plan/2027-bible-reading-plan.md']);
		for (const path of ['src/plan/2026-january-december.md', 'src/plan/2027-bible-reading-plan.md']) {
			const a = before[path].split('\n');
			const b = files[path].split('\n');
			expect(b.filter((line, i) => line !== a[i])).toHaveLength(1);
		}
		expect(files['src/plan/2027-bible-reading-plan.md']).toContain('current: true');
		expect(files['src/plan/2026-january-december.md']).toContain('current: false');
		// Running again the same day is a no-op.
		expect(await runChangeover(gh, '2027-01-04')).toMatchObject({ changed: false });
	});

	it('catches up if a daily run was missed, but not after a few days', async () => {
		expect(await runChangeover(fakeGitHub(realPlans()).gh, '2027-01-06')).toMatchObject({ changed: true });
		const late = await runChangeover(fakeGitHub(realPlans()).gh, '2027-01-12');
		expect(late).toMatchObject({ changed: false });
		if (!late.changed && 'reason' in late) expect(late.reason).toMatch(/leaving that choice alone/);
	});

	it('dry run reports without committing', async () => {
		const { gh, commits } = fakeGitHub(realPlans());
		expect(await runChangeover(gh, '2027-01-04', { dryRun: true })).toMatchObject({ changed: false, dryRun: true, to: '2027 Bible Reading Plan' });
		expect(commits).toHaveLength(0);
	});

	it('never makes an extra plan (e.g. Advent) current', async () => {
		const advent = '---\ntitle: Advent 2026\nstart: 11-29-2026\ncurrent: false\nsupplemental: true\nplan:\n' + '  - day: Luke 1\n'.repeat(26) + '---\n';
		const { gh, commits } = fakeGitHub(realPlans({ 'src/plan/advent-2026.md': advent }));
		expect(await runChangeover(gh, '2026-11-29')).toMatchObject({ changed: false, reason: '“2026 Bible Reading Plan” is already current.' });
		expect(commits).toHaveLength(0);
	});

	it('does nothing when no church plan covers today', async () => {
		const { gh, commits } = fakeGitHub(realPlans({ 'src/plan/2027-bible-reading-plan.md': '---\ntitle: Later\nstart: 03-01-2027\nplan:\n  - day: John 1\n---\n' }));
		expect(await runChangeover(gh, '2027-01-10')).toMatchObject({ changed: false, reason: 'No church plan covers today.' });
		expect(commits).toHaveLength(0);
	});
});

describe('changeover helpers', () => {
	it('picks the newer plan while two overlap', () => {
		const d = decideChangeover(
			[
				{ file: 'a', title: 'A', start: '2025-07-07', days: 181, current: true },
				{ file: 'b', title: 'B', start: '2026-01-01', days: 368, current: false }
			],
			'2026-01-02'
		);
		expect(d).toMatchObject({ action: 'switch', to: { file: 'b' } });
	});

	it('never moves the flag between two plans that start the same day, whichever file name sorts first', () => {
		for (const [a, b] of [
			[true, false],
			[false, true]
		]) {
			const d = decideChangeover(
				[
					{ file: 'a', title: 'A', start: '2027-01-04', days: 364, current: a },
					{ file: 'b', title: 'B', start: '2027-01-04', days: 364, current: b }
				],
				'2027-01-04'
			);
			expect(d.action).toBe('none');
		}
	});

	it('leaves a current plan alone when the other plan started earlier', () => {
		const d = decideChangeover(
			[
				{ file: 'a', title: 'A', start: '2027-01-01', days: 364, current: false },
				{ file: 'b', title: 'B', start: '2027-01-04', days: 364, current: true }
			],
			'2027-01-05'
		);
		expect(d).toMatchObject({ action: 'none' });
	});

	it('leaves a manually chosen upcoming plan alone', () => {
		const d = decideChangeover(
			[
				{ file: 'a', title: 'A', start: '2027-01-01', days: 364, current: false },
				{ file: 'b', title: 'B', start: '2027-02-01', days: 364, current: true }
			],
			'2027-01-01'
		);
		expect(d).toMatchObject({ action: 'none' });
	});

	it('ignores extra plans', () => {
		const d = decideChangeover(
			[
				{ file: 'a', title: 'A', start: '2026-01-01', days: 368, current: true },
				{ file: 'advent', title: 'Advent', start: '2026-12-01', days: 24, current: false, supplemental: true }
			],
			'2026-12-01'
		);
		expect(d).toMatchObject({ action: 'none', reason: '“A” is already current.' });
	});

	it('adds a current line when a file has none', () => {
		expect(setCurrentFlag('---\ntitle: X\nstart: 01-04-2027\nplan: []\n---\n', true)).toBe('---\ntitle: X\nstart: 01-04-2027\ncurrent: true\nplan: []\n---\n');
	});

	it('uses the church’s date, not UTC', () => {
		// 05:30 UTC on Jan 4 is still 11:30pm on Jan 3 in Florida's panhandle (Central time).
		expect(dateInZone(new Date('2027-01-04T05:30:00Z'), 'America/Chicago')).toBe('2027-01-03');
		expect(dateInZone(new Date('2027-01-04T06:10:00Z'), 'America/Chicago')).toBe('2027-01-04');
	});
});
