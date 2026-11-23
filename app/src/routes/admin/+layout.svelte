<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { auth, sendSignIn, signOut, startAuth, verifyCode } from '#lib/admin/session.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	let email = $state('');
	let code = $state('');
	let sent = $state(false);
	let busy = $state(false);
	let message = $state('');

	onMount(startAuth);

	async function send(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		message = '';
		const { error } = await sendSignIn(email.trim());
		busy = false;
		if (error) message = error.message;
		else sent = true;
	}

	async function useCode(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		message = '';
		const { error } = await verifyCode(email.trim(), code.trim());
		busy = false;
		if (error) message = 'That code didn’t work. Check it, or send a new link.';
	}

	const nav = [
		{ href: '/admin/', label: 'Plans' },
		{ href: '/admin/editors/', label: 'Editors' },
		{ href: '/admin/history/', label: 'Publishing history' }
	];
	const current = (href: string) =>
		href === '/admin/' ? ['/admin/', '/admin/edit/', '/admin/import/'].includes(page.url.pathname) : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<title>Admin · Redeemer Bible Reading</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="admin">
	{#if auth.status === 'loading'}
		<p class="center muted">Loading…</p>
	{:else if auth.status === 'signed-out'}
		<main class="signin">
			<div class="brand"><span class="mark" aria-hidden="true">R</span> Redeemer Reading · Admin</div>
			<h1>Sign in</h1>
			{#if !sent}
				<p class="muted">We’ll email you a link. No password needed.</p>
				<form onsubmit={send}>
					<label class="field">Email <input type="email" required autocomplete="email" bind:value={email} /></label>
					<button class="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
				</form>
			{:else}
				<p>Check your email at <strong>{email}</strong> and tap the link.</p>
				<details>
					<summary>The link opened somewhere else?</summary>
					<form onsubmit={useCode}>
						<label class="field">6-digit code from the email <input inputmode="numeric" autocomplete="one-time-code" bind:value={code} /></label>
						<button class="btn" disabled={busy}>Sign in with code</button>
					</form>
				</details>
				<button class="btn btn-quiet" onclick={() => (sent = false)}>Use a different email</button>
			{/if}
			{#if message}<p class="error" role="alert">{message}</p>{/if}
		</main>
	{:else if auth.status === 'not-editor'}
		<main class="signin">
			<h1>No editing access</h1>
			<p>You’re signed in as <strong>{auth.email}</strong>, but this account can’t edit reading plans.</p>
			<p class="muted">Ask an existing editor to add you on the Editors page. They’ll need the email address above.</p>
			<button class="btn" onclick={signOut}>Sign out</button>
		</main>
	{:else}
		<header class="bar">
			<a class="brand" href="/admin/"><span class="mark" aria-hidden="true">R</span> Admin</a>
			<nav aria-label="Admin">
				{#each nav as item (item.href)}
					<a href={item.href} aria-current={current(item.href) ? 'page' : undefined}>{item.label}</a>
				{/each}
			</nav>
			<div class="who">
				<a href="/" class="muted">View site</a>
				<span class="muted">{auth.email}</span>
				<button class="btn btn-quiet" onclick={signOut}>Sign out</button>
			</div>
		</header>
		<main class="content">
			{@render children()}
		</main>
	{/if}
</div>

<style>
	.admin {
		min-height: 100dvh;
		background: var(--ground);
	}
	.center {
		text-align: center;
		padding: 80px 16px;
	}
	.signin {
		max-width: 420px;
		margin: 0 auto;
		padding: 64px 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.signin h1 {
		font-family: var(--font-scripture);
		font-size: 32px;
		margin: 16px 0 0;
	}
	.signin form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 8px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
		text-decoration: none;
		color: var(--ink);
		min-height: 44px;
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
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		align-items: center;
		padding: 8px 24px;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}
	.bar nav {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		flex: 1;
	}
	.bar nav a {
		padding: 10px 12px;
		border-radius: 10px;
		text-decoration: none;
		color: var(--muted);
		font-weight: 500;
	}
	.bar nav a[aria-current='page'] {
		background: var(--brand-soft);
		color: var(--brand);
		font-weight: 600;
	}
	.who {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 14px;
		flex-wrap: wrap;
	}
	.content {
		max-width: 1240px;
		margin: 0 auto;
		padding: 28px 24px 80px;
	}
	@media (max-width: 640px) {
		.content {
			padding: 20px 14px 80px;
		}
		.bar {
			padding: 8px 14px;
		}
		/* Menu gets its own scrollable row under the logo and account. */
		.bar nav {
			order: 3;
			flex: 1 0 100%;
			flex-wrap: nowrap;
			overflow-x: auto;
		}
		.bar nav a {
			white-space: nowrap;
		}
		.who {
			margin-left: auto;
		}
		.who span {
			display: none;
		}
	}

	/* Shared admin building blocks */
	.admin :global(h1.page) {
		font-family: var(--font-scripture);
		font-weight: 600;
		font-size: 30px;
		margin: 0;
	}
	.admin :global(.muted) {
		color: var(--muted);
	}
	.admin :global(.error) {
		color: #b42318;
	}
	.admin :global(.btn) {
		min-height: 44px;
		padding: 0 16px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-weight: 600;
		font-size: 15px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		text-decoration: none;
	}
	.admin :global(.btn:disabled) {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.admin :global(.btn-primary) {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--brand-ink);
	}
	.admin :global(.btn-quiet) {
		border-color: transparent;
		background: transparent;
		color: var(--brand);
	}
	.admin :global(.btn-small) {
		min-height: 36px;
		padding: 0 12px;
		font-size: 14px;
		border-radius: 9px;
	}
	.admin :global(.card) {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 18px;
	}
	.admin :global(.field) {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
	}
	.admin :global(.field input),
	.admin :global(.field textarea),
	.admin :global(.field select) {
		min-height: 44px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: 10px;
		font: 500 15px var(--font-ui);
		color: var(--ink);
		background: var(--surface);
	}
	.admin :global(.field textarea) {
		padding: 10px 12px;
		min-height: 160px;
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 13px;
	}
	.admin :global(.pill) {
		display: inline-block;
		font-size: 12px;
		font-weight: 600;
		padding: 3px 10px;
		border-radius: 999px;
		white-space: nowrap;
		background: var(--surface-muted);
		color: var(--muted);
	}
	.admin :global(.pill.live) {
		background: #dcfce7;
		color: #14532d;
	}
	.admin :global(.pill.upcoming),
	.admin :global(.pill.draft) {
		background: var(--brand-soft);
		color: var(--brand);
	}
	.admin :global(.pill.selfpaced) {
		background: #ede9fe;
		color: #4c1d95;
	}
	.admin :global(.pill.bad) {
		background: #fee4e2;
		color: #912018;
	}
	.admin :global(.pill.note) {
		background: #fef3c7;
		color: #78350f;
	}
	.admin :global(.banner) {
		border-radius: 14px;
		padding: 14px 18px;
		background: var(--warn-soft);
		border: 1px solid var(--warn-line);
		color: var(--warn-ink);
	}
	.admin :global(.banner p) {
		margin: 0;
	}
</style>
