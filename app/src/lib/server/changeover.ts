/**
 * Daily plan changeover: when a church plan starts, make it the "current" plan (and un-mark the
 * old one) with one commit, the same way Publish does. Nothing happens on any other day.
 */
import { decideChangeover, setCurrentFlag, type ChangeoverPlan } from '#lib/shared/changeover.js';
import { parsePlanFile } from '#lib/shared/planFile.js';
import { isSupplemental } from '#lib/shared/planCheck.js';
import { PLAN_DIR } from '#lib/config.ts';
import type { gitHub } from './github.ts';

type GitHub = ReturnType<typeof gitHub>;

export type ChangeoverResult =
	| { changed: false; today: string; reason: string }
	| { changed: boolean; today: string; to: string; from: string[]; commit?: string; url?: string; dryRun: boolean };

export async function runChangeover(github: GitHub, today: string, { dryRun = false } = {}): Promise<ChangeoverResult> {
	const files = (await github.listFolder(PLAN_DIR)).filter((f) => f.name.endsWith('.md'));
	const loaded = await Promise.all(files.map((f) => github.getFile(f.path)));
	const texts = new Map<string, string>();
	const plans: ChangeoverPlan[] = [];
	for (const f of loaded) {
		if (!f) continue;
		texts.set(f.path, f.text);
		const p = parsePlanFile(f.text);
		plans.push({ file: f.path, title: p.title, start: p.start, current: p.current, days: p.plan.length, supplemental: isSupplemental(p) });
	}

	const decision = decideChangeover(plans, today);
	if (decision.action === 'none') return { changed: false, today, reason: decision.reason };

	const changes = [
		{ path: decision.to.file, content: setCurrentFlag(texts.get(decision.to.file)!, true) },
		...decision.from.map((p) => ({ path: p.file, content: setCurrentFlag(texts.get(p.file)!, false) }))
	];
	const summary = { today, to: decision.to.title, from: decision.from.map((p) => p.title) };
	if (dryRun) return { changed: false, dryRun: true, ...summary };

	const commit = await github.commit(
		changes,
		`Plan changeover: “${decision.to.title}” is now current\n\nMade by the daily changeover check on ${today}.`
	);
	return { changed: true, dryRun: false, commit: commit.sha, url: commit.url, ...summary };
}
