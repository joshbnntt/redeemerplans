<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import UpdateToast from '#lib/components/UpdateToast.svelte';
	import { startPrefs } from '#lib/reader/prefs.svelte.ts';
	import { startProgress } from '#lib/reader/progress.svelte.ts';
	import { startFollowing } from '#lib/reader/following.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The admin has its own layout.
	const isAdmin = $derived(page.url.pathname.startsWith('/admin'));

	onMount(() => {
		startPrefs();
		if (!page.url.pathname.startsWith('/admin')) {
			startProgress();
			startFollowing();
		}
	});

	const tabs = [
		{ href: '/', label: 'Today', icon: 'M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14zM4 19.5A2.5 2.5 0 006.5 22H20v-5' },
		{ href: '/plan/', label: 'Plan', icon: 'M3 6a2 2 0 012-2h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M8 2v4M16 2v4' },
		{ href: '/progress/', label: 'Progress', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
		{ href: '/settings/', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z' }
	];
	const isActive = (href: string) => {
		const p = page.url.pathname;
		if (href === '/') return p === '/';
		if (href === '/plan/') return p.startsWith('/plan') ;
		return p.startsWith(href);
	};
</script>

<svelte:head>
	<link rel="icon" href="/images/web/favicon.ico" sizes="32x32" />
	<link rel="apple-touch-icon" href="/images/web/apple-touch-icon.png" />
	<meta name="theme-color" content="#0c4a6e" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap"
	/>
</svelte:head>

{#if isAdmin}
	{@render children()}
{:else}
	<div class="shell">
		<header>
			<a class="brand" href="/">
				<span class="mark" aria-hidden="true">R</span>
				<span>Redeemer Reading</span>
			</a>
		</header>

		<main>
			{@render children()}
		</main>

		<nav aria-label="Main">
			{#each tabs as tab (tab.href)}
				<a href={tab.href} aria-current={isActive(tab.href) ? 'page' : undefined}>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={tab.icon} /></svg>
					{tab.label}
				</a>
			{/each}
		</nav>
	</div>
{/if}

<UpdateToast />

<style>
	.shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	header {
		padding: 16px 20px 8px;
		max-width: 720px;
		width: 100%;
		margin: 0 auto;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		text-decoration: none;
		color: var(--ink);
		font-weight: 600;
	}
	.mark {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--brand);
		color: var(--brand-ink);
		display: grid;
		place-items: center;
		font-family: var(--font-scripture);
		font-size: 18px;
	}
	main {
		flex: 1;
		width: 100%;
		max-width: 720px;
		margin: 0 auto;
		padding: 4px 16px 112px;
	}
	nav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		background: var(--surface);
		border-top: 1px solid var(--line);
		padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
	}
	nav a {
		min-height: 52px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		text-decoration: none;
		color: var(--muted);
		font-size: 11px;
		font-weight: 500;
	}
	nav a[aria-current='page'] {
		color: var(--brand);
		font-weight: 700;
	}
	@media (min-width: 900px) {
		nav {
			max-width: 720px;
			margin: 0 auto;
			border: 1px solid var(--line);
			border-bottom: 0;
			border-radius: 16px 16px 0 0;
		}
	}
</style>
