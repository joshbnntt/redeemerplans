import { plans } from '#lib/server/plans.ts';
import { summary } from '#lib/server/v2.ts';
import { checkPlan } from '#lib/shared/planCheck.js';

export const prerender = true;

/** Admin plan list with check results, worked out at build time. */
export function GET() {
	const list = plans.map((p) => {
		const { issues } = checkPlan(p);
		return {
			...summary(p),
			current: p.current,
			errors: issues.filter((i) => i.level === 'error').length,
			notes: issues.filter((i) => i.level === 'warning').length
		};
	});
	return new Response(JSON.stringify({ plans: list, builtAt: new Date().toISOString() }), {
		headers: { 'content-type': 'application/json' }
	});
}
