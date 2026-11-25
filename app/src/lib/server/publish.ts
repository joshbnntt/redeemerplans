/**
 * Publishing a plan = committing its file to GitHub. Vercel then rebuilds both sites (~1 min).
 */
import { checkPlan, isSupplemental, type Issue } from '#lib/shared/planCheck.js';
import { parsePlanFile, serializePlanFile, type PlanSource } from '#lib/shared/planFile.js';
import { PLAN_DIR } from '#lib/config.ts';
import { legacySlug } from './plans.ts';
import type { gitHub } from './github.ts';

type GitHub = ReturnType<typeof gitHub>;

export type PublishInput = {
	/** File name of the plan being edited (e.g. "2026-january-december.md"); omit for a new plan. */
	file?: string;
	/** GitHub's sha of that file when editing started; publishing fails if it changed since. */
	baseSha?: string;
	source: PlanSource;
};

export type PublishResult =
	| { ok: true; id: string; file: string; path: string; commit: string; url: string; alsoUpdated: string[] }
	| { ok: false; status: 400 | 409 | 422; message: string; issues?: Issue[] };

export const FILE_NAME = /^[a-z0-9][a-z0-9._-]*\.md$/i;

/** Accepts only the shape the editor sends, so nothing unexpected ends up in a plan file. */
export function readInput(body: unknown): PublishInput | null {
	if (!body || typeof body !== 'object') return null;
	const b = body as Record<string, unknown>;
	const s = b.source as Record<string, unknown> | undefined;
	if (!s || typeof s.title !== 'string' || !Array.isArray(s.plan)) return null;
	if (b.file !== undefined && (typeof b.file !== 'string' || !FILE_NAME.test(b.file))) return null;
	const plan = (s.plan as unknown[]).map((d) => {
		const day = (d ?? {}) as Record<string, unknown>;
		return { day: String(day.day ?? ''), ...(day.alt ? { alt: String(day.alt) } : {}) };
	});
	const extra = s.extra && typeof s.extra === 'object' && !Array.isArray(s.extra) ? (s.extra as Record<string, unknown>) : {};
	return {
		...(b.file ? { file: b.file as string } : {}),
		...(typeof b.baseSha === 'string' ? { baseSha: b.baseSha } : {}),
		source: {
			title: s.title,
			description: typeof s.description === 'string' ? s.description : '',
			start: typeof s.start === 'string' ? s.start : '',
			current: s.current === true,
			plan,
			extra
		}
	};
}

export async function publishPlan(github: GitHub, input: PublishInput, knownIds: string[]): Promise<PublishResult> {
	const { source } = input;
	const title = source.title.trim();
	if (!title) return { ok: false, status: 400, message: 'The plan needs a title.' };

	if (source.current && isSupplemental(source)) {
		return { ok: false, status: 422, message: 'An extra plan can’t be the current church plan. Untick one of the two.' };
	}

	const errors = checkPlan(source).issues.filter((i) => i.level === 'error');
	if (errors.length) {
		return { ok: false, status: 422, message: 'Fix the problems marked in red before publishing.', issues: errors };
	}

	const id = legacySlug(title);
	let file = input.file;
	if (file) {
		const existing = await github.getFile(`${PLAN_DIR}/${file}`);
		if (existing && input.baseSha && existing.sha !== input.baseSha) {
			return {
				ok: false,
				status: 409,
				message: 'This plan was changed by someone else after you opened it. Reload it to see their changes, then make yours again.'
			};
		}
	} else {
		file = `${id}.md`;
		if (knownIds.includes(id) || (await github.getFile(`${PLAN_DIR}/${file}`))) {
			return { ok: false, status: 409, message: `There’s already a plan called “${title}”. Choose a different title.` };
		}
	}

	const path = `${PLAN_DIR}/${file}`;
	const files = [{ path, content: serializePlanFile({ ...source, title }) }];

	// Only one plan can be current: the old site fails to build if two are.
	const alsoUpdated: string[] = [];
	if (source.current) {
		for (const other of await github.listFolder(PLAN_DIR)) {
			if (other.path === path || !other.name.endsWith('.md')) continue;
			const f = await github.getFile(other.path);
			if (!f || !parsePlanFile(f.text).current) continue;
			// Change just that one line, so the rest of their file stays exactly as it was.
			files.push({ path: f.path, content: f.text.replace(/^current:\s*true\s*$/m, 'current: false') });
			alsoUpdated.push(f.path);
		}
	}

	const commit = await github.commit(files, `Publish reading plan “${title}”\n\nPublished from the admin page.`);
	return { ok: true, id, file, path, commit: commit.sha, url: commit.url, alsoUpdated };
}
