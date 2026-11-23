<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import UpdateToast from '#lib/components/UpdateToast.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tabs = [
		{ href: '/', label: 'Today' },
		{ href: '/plan/', label: 'Plans' }
	];
	const isActive = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
	// The admin has its own layout.
	const isAdmin = $derived(page.url.pathname.startsWith('/admin'));
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
			<a href={tab.href} aria-current={isActive(tab.href) ? 'page' : undefined}>{tab.label}</a>
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
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		background: var(--surface);
		border-top: 1px solid var(--line);
		padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
	}
	nav a {
		min-height: 52px;
		display: grid;
		place-items: center;
		text-decoration: none;
		color: var(--muted);
		font-size: 14px;
		font-weight: 500;
	}
	nav a[aria-current='page'] {
		color: var(--brand);
		font-weight: 700;
	}
</style>
