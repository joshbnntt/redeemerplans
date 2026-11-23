<script lang="ts">
	import { onMount } from 'svelte';

	type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

	let deferred = $state<InstallEvent | null>(null);
	let showIosHint = $state(false);
	let dismissed = $state(true);

	// localStorage can be unavailable (private mode); the prompt then just doesn't remember.
	const read = (k: string) => {
		try {
			return localStorage.getItem(k);
		} catch {
			return null;
		}
	};
	const write = (k: string, v: string) => {
		try {
			localStorage.setItem(k, v);
		} catch {
			/* ignore */
		}
	};

	onMount(() => {
		const standalone =
			matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
		if (standalone) return;

		// Only offer to install from the second visit on, so first-time readers aren't nagged.
		const visits = Number(read('visits') ?? '0') + 1;
		write('visits', String(visits));
		dismissed = read('install-dismissed') === '1' || visits < 2;

		const onPrompt = (e: Event) => {
			e.preventDefault();
			deferred = e as InstallEvent;
		};
		window.addEventListener('beforeinstallprompt', onPrompt);

		// iOS Safari has no install prompt; show a one-time hint instead.
		const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
		showIosHint = ios;

		return () => window.removeEventListener('beforeinstallprompt', onPrompt);
	});

	function dismiss() {
		dismissed = true;
		write('install-dismissed', '1');
	}

	async function install() {
		if (!deferred) return;
		await deferred.prompt();
		await deferred.userChoice;
		deferred = null;
		dismiss();
	}
</script>

{#if !dismissed && (deferred || showIosHint)}
	<aside class="install" aria-label="Install the app">
		<div>
			<p class="title">Add Bible Reading to your home screen</p>
			{#if deferred}
				<p>Open today’s reading in one tap, even offline.</p>
			{:else}
				<p>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p>
			{/if}
		</div>
		<div class="actions">
			{#if deferred}<button class="primary" onclick={install}>Install</button>{/if}
			<button class="close" onclick={dismiss} aria-label="Not now">Not now</button>
		</div>
	</aside>
{/if}

<style>
	.install {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-radius: var(--radius);
		background: var(--brand-soft);
		color: var(--ink);
	}
	p {
		margin: 0;
		font-size: 14px;
		color: var(--muted);
	}
	.title {
		font-weight: 600;
		color: var(--ink);
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	button {
		min-height: 44px;
		padding: 0 14px;
		border-radius: 10px;
		border: 0;
		font-weight: 600;
		cursor: pointer;
	}
	.primary {
		background: var(--brand);
		color: var(--brand-ink);
	}
	.close {
		background: transparent;
		color: var(--brand);
	}
</style>
