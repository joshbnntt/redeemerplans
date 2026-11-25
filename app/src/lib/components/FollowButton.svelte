<script lang="ts">
	import { follow, following, isFollowing, unfollow } from '#lib/reader/following.svelte.ts';
	import type { PlanSummary } from '#lib/today.ts';

	/** Follow / Following toggle for a plan. `church` is the plan the church is reading now. */
	let { plan, church }: { plan: Pick<PlanSummary, 'id' | 'start' | 'title'>; church?: Pick<PlanSummary, 'id'> } = $props();
	const on = $derived(isFollowing(plan, church));
</script>

{#if following.ready}
	<button
		class="follow"
		class:on
		aria-pressed={on}
		aria-label={on ? `Following ${plan.title}. Stop following` : `Follow ${plan.title}`}
		onclick={() => (on ? unfollow(plan) : follow(plan))}
	>
		{#if on}
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
			Following
		{:else}
			Follow this plan
		{/if}
	</button>
{/if}

<style>
	.follow {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		padding: 0 16px;
		border-radius: 999px;
		border: 1.5px solid var(--brand);
		background: var(--brand);
		color: var(--brand-ink);
		font: inherit;
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
	}
	.follow.on {
		background: transparent;
		color: var(--brand);
	}
</style>
