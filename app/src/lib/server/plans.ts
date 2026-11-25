/**
 * Loads the reading plans at build time from the repository's existing plan files
 * (`src/plan/*.md`), exactly as the 11ty site reads them. The files are bundled by Vite,
 * so this also works inside serverless functions, and edits reload in `npm run dev`.
 */
import yaml from 'js-yaml';
import slug from 'slugify';
import { isSupplemental, planStatus } from '#lib/shared/planCheck.js';
import { parsePlanDate } from '#lib/shared/planDate.js';

export type PlanEntry = { day?: string; alt?: string; [key: string]: unknown };

export type Plan = {
	/** v1 API id and page slug (11ty's `slug` filter) */
	id: string;
	/** file name without extension (11ty's `fileSlug`) */
	fileSlug: string;
	title: string;
	description?: string;
	/** as written in the file: "MM-DD-YYYY", ISO, or "" */
	start: string;
	current: boolean;
	plan: PlanEntry[];
	/** any other front-matter keys, e.g. intentional_repeats */
	extra: Record<string, unknown>;
};

const planFiles = import.meta.glob('../../../../src/plan/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const dataFiles = import.meta.glob('../../../../src/data/{masterplan,calendar}.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** 11ty's `slug` filter (the `slugify` package), used for v1 API ids and page URLs. */
export const legacySlug = (s: string) => slug('' + s, { replacement: '-', lower: true });

/** Front matter, tolerating a missing closing `---` the way 11ty does. */
export function frontMatter(text: string): Record<string, unknown> {
	const match = text.match(/^---\r?\n([\s\S]*?)(?:\r?\n---[ \t]*(?:\r?\n|$)|$)/);
	return match ? ((yaml.load(match[1]) as Record<string, unknown>) ?? {}) : {};
}

function toPlan(file: string, data: Record<string, unknown>): Plan {
	const { title, description, start, current, plan, ...extra } = data;
	// The defaults match src/plan/plan.11tydata.js.
	return {
		id: legacySlug(String(title)),
		fileSlug: file.split('/').pop()!.replace(/\.md$/, ''),
		title: String(title),
		description: description as string | undefined,
		start: (start as string | undefined) ?? '',
		current: (current as boolean | undefined) ?? false,
		plan: (plan as PlanEntry[] | undefined) ?? [],
		extra
	};
}

/** All plans, sorted by file name so every build produces the same order. */
export const plans: Plan[] = Object.entries(planFiles)
	.sort(([a], [b]) => (a < b ? -1 : 1))
	.map(([file, text]) => toPlan(file, frontMatter(text)));

export function getPlan(id: string): Plan | undefined {
	return plans.find((p) => p.id === id);
}

/**
 * The plan marked `current: true`: what the v1 API and the church app (Subsplash) call "current".
 * Only the flag decides this, never dates. The build's plan checks fail if more than one plan is
 * flagged or an extra plan is, so this is never ambiguous.
 */
export const flaggedCurrentPlan = plans.find((p) => p.current);

/** The church plan readers see on a date: the current plan while it runs, else the newest church plan running. */
export function currentPlan(today = new Date()): Plan | undefined {
	const live = plans
		.filter((p) => p.start && !isSupplemental(p) && planStatus(p, today).status === 'live')
		.sort((a, b) => +parsePlanDate(b.start)! - +parsePlanDate(a.start)!);
	return live.find((p) => p.current) ?? live[0] ?? flaggedCurrentPlan;
}

const dataFile = (name: string) => {
	const entry = Object.entries(dataFiles).find(([file]) => file.endsWith(`/${name}.yaml`));
	if (!entry) throw new Error(`src/data/${name}.yaml not found`);
	return yaml.load(entry[1]) as Record<string, unknown>;
};

/** src/data/masterplan.yaml (served as /api/masterplan.json by the v1 site). */
export const masterplan = dataFile('masterplan') as { title: string; description?: string; start: string; plan: PlanEntry[] };

/** src/data/calendar.yaml (calendar feed settings). */
export const calendar = dataFile('calendar') as { title: string; description: string; organization: string; url: string };
