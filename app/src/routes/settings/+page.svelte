<script lang="ts">
	import { onMount } from 'svelte';
	import InstallPrompt from '#lib/components/InstallPrompt.svelte';
	import { prefs, type Theme } from '#lib/reader/prefs.svelte.ts';
	import { progress, signInReader, signOutReader, verifyReaderCode } from '#lib/reader/progress.svelte.ts';
	import { feedLinks } from '#lib/reader/calendar.ts';
	import { YOUVERSION_IDS, type ReadingApp, type Translation } from '#lib/shared/links.js';

	let host = $state('');
	const cal = $derived(host ? feedLinks(host, navigator.userAgent) : null);
	let email = $state('');
	let code = $state('');
	let sent = $state(false);
	let busy = $state(false);
	let message = $state('');

	onMount(() => {
		host = location.host;
	});

	const translations = Object.keys(YOUVERSION_IDS) as Translation[];
	const apps: { value: ReadingApp; label: string }[] = [
		{ value: 'youversion', label: 'YouVersion (Bible app)' },
		{ value: 'esv', label: 'ESV.org' },
		{ value: 'lsb', label: 'LSB (read.lsbible.org)' },
		{ value: 'biblegateway', label: 'Bible Gateway' }
	];
	const themes: { value: Theme; label: string }[] = [
		{ value: 'system', label: 'Match this device' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	async function send(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		message = '';
		const { error } = await signInReader(email.trim());
		busy = false;
		if (error) message = error.message;
		else sent = true;
	}
	async function useCode(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		const { error } = await verifyReaderCode(email.trim(), code.trim());
		busy = false;
		message = error ? 'That code didn’t work. Check it, or send a new link.' : '';
	}
</script>

<svelte:head>
	<title>Settings · Redeemer Bible Reading</title>
</svelte:head>

<h1>Settings</h1>

<section>
	<h2>Reading</h2>
	<div class="group">
		<label class="row">
			<span>Open passages in</span>
			<select bind:value={prefs.app}>
				{#each apps as a (a.value)}<option value={a.value}>{a.label}</option>{/each}
			</select>
		</label>
		{#if prefs.app !== 'esv' && prefs.app !== 'lsb'}
			<label class="row">
				<span>Translation</span>
				<select bind:value={prefs.translation}>
					{#each translations as t (t)}<option value={t}>{t}</option>{/each}
				</select>
			</label>
		{/if}
		<label class="row">
			<span>Appearance</span>
			<select bind:value={prefs.theme}>
				{#each themes as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
			</select>
		</label>
	</div>
</section>

<section>
	<h2>Reminders &amp; app</h2>
	<div class="group">
		{#if cal}
			<a class="row link" href={cal.primary} target={cal.android ? '_blank' : undefined} rel="noopener">
				<span>Add readings to my calendar<br /><span class="muted small">Each day’s reading from every church plan appears in your calendar app, including future plans</span></span>
				<span class="action">Subscribe</span>
			</a>
		{/if}
		<div class="row block"><InstallPrompt always /></div>
	</div>
	{#if cal && !cal.android}<p class="muted small hint">Use Google Calendar? <a href={cal.google} target="_blank" rel="noopener">Add it to Google Calendar</a> instead.</p>{/if}
	<p class="muted small hint">If installing isn’t offered, open this site in Safari (iPhone) or Chrome (Android) and use “Add to Home Screen”.</p>
</section>

<section id="account">
	<h2>Account</h2>
	<div class="group pad">
		{#if !progress.ready}
			<p class="muted">Loading…</p>
		{:else if progress.session}
			<p>Signed in as <strong>{progress.session.user.email}</strong>. Your progress syncs across your devices.</p>
			{#if progress.syncError}<p class="error small">Not synced yet: {progress.syncError}. It will try again when you’re back online.</p>{/if}
			<button class="btn" onclick={signOutReader}>Sign out</button>
		{:else if !sent}
			<p>Sign in to keep your progress on all your devices. We’ll email you a link; no password.</p>
			<form onsubmit={send}>
				<label class="field">Email <input type="email" required autocomplete="email" bind:value={email} /></label>
				<button class="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
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
			<button class="btn quiet" onclick={() => (sent = false)}>Use a different email</button>
		{/if}
		{#if message}<p class="error small" role="alert">{message}</p>{/if}
	</div>
</section>

<p class="footer"><a href="/plans/">All reading plans</a></p>

<style>
	h1 {
		font-family: var(--font-scripture);
		font-weight: 600;
		font-size: 28px;
		margin: 8px 4px 14px;
	}
	h2 {
		margin: 18px 4px 8px;
		font-size: 12px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.muted {
		color: var(--muted);
	}
	.small {
		font-size: 13px;
	}
	.error {
		color: var(--danger);
	}
	.group {
		background: var(--surface);
		border-radius: 16px;
		overflow: hidden;
	}
	.group.pad {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}
	.group.pad p {
		margin: 0;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 8px 16px;
		border-top: 1px solid var(--line);
		color: var(--ink);
	}
	.row:first-child {
		border-top: 0;
	}
	.row.block {
		display: block;
		padding: 12px 16px;
	}
	.link {
		text-decoration: none;
	}
	.action {
		color: var(--brand);
		font-weight: 600;
		white-space: nowrap;
	}
	select {
		border: 0;
		background: transparent;
		font: 600 15px var(--font-ui);
		color: var(--brand);
		text-align: right;
		max-width: 60%;
		min-height: 44px;
	}
	.hint {
		margin: 8px 4px 0;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
	}
	.field input {
		min-height: 44px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: 10px;
		font: 500 16px var(--font-ui);
		color: var(--ink);
		background: var(--surface);
	}
	.btn {
		min-height: 44px;
		padding: 0 16px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-weight: 600;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--brand-ink);
	}
	.btn.quiet {
		border-color: transparent;
		background: transparent;
		color: var(--brand);
	}
	.footer {
		text-align: center;
		margin-top: 24px;
	}
</style>
