<script lang="ts">
	import { onMount } from 'svelte';

	/** How often an open app checks for a new version. */
	const CHECK_EVERY_MS = 60 * 60 * 1000;

	let needRefresh = $state(false);
	let offlineReady = $state(false);
	let updating = $state(false);
	let update: () => Promise<void> = async () => {};

	onMount(() => {
		let registration: ServiceWorkerRegistration | undefined;
		let timer: ReturnType<typeof setInterval> | undefined;
		const unsubscribers: (() => void)[] = [];

		// Installed apps can stay open for days, so look for updates whenever the app comes back
		// to the foreground, and hourly while it's open.
		const check = () => {
			if (!registration || registration.installing || !navigator.onLine) return;
			registration.update().catch(() => {});
		};
		const onVisible = () => document.visibilityState === 'visible' && check();

		import('virtual:pwa-register/svelte').then(({ useRegisterSW }) => {
			const sw = useRegisterSW({
				immediate: true,
				onRegisteredSW(_url, r) {
					registration = r;
					timer = setInterval(check, CHECK_EVERY_MS);
				},
				onRegisterError(error) {
					console.warn('Service worker registration failed', error);
				}
			});
			unsubscribers.push(sw.needRefresh.subscribe((v) => (needRefresh = v)));
			unsubscribers.push(sw.offlineReady.subscribe((v) => (offlineReady = v)));
			update = sw.updateServiceWorker;
		});
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			if (timer) clearInterval(timer);
			unsubscribers.forEach((u) => u());
		};
	});

	async function reload() {
		updating = true;
		// Reload as soon as the new version takes over. The plugin does this too, but not when the
		// service worker was first installed during this same visit, so don't rely on it.
		navigator.serviceWorker?.addEventListener('controllerchange', () => location.reload(), { once: true });
		await update();
		// Fallback: if the new version was already in control, just reload.
		setTimeout(() => location.reload(), 3000);
	}

	// "Ready to work offline" only needs a moment on screen.
	$effect(() => {
		if (!offlineReady) return;
		const t = setTimeout(() => (offlineReady = false), 4000);
		return () => clearTimeout(t);
	});
</script>

{#if needRefresh}
	<div class="toast" role="status" aria-live="polite">
		<p>A new version is available.</p>
		<div class="actions">
			<button class="later" onclick={() => (needRefresh = false)}>Later</button>
			<button class="primary" onclick={reload} disabled={updating}>{updating ? 'Updating…' : 'Reload'}</button>
		</div>
	</div>
{:else if offlineReady}
	<div class="toast" role="status" aria-live="polite">
		<p>Ready to use offline.</p>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		left: 16px;
		right: 16px;
		bottom: calc(88px + env(safe-area-inset-bottom));
		margin: 0 auto;
		max-width: 420px;
		z-index: 50;
		display: flex;
		gap: 12px;
		align-items: center;
		justify-content: space-between;
		padding: 12px 12px 12px 16px;
		border-radius: 14px;
		background: var(--ink);
		color: var(--ground);
		box-shadow: 0 8px 28px rgb(0 0 0 / 0.25);
	}
	p {
		margin: 0;
		font-weight: 500;
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
	.later {
		background: transparent;
		color: inherit;
	}
	.primary {
		background: var(--ground);
		color: var(--ink);
	}
</style>
