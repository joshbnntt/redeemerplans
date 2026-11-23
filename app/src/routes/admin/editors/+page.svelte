<script lang="ts">
	import { onMount } from 'svelte';
	import { auth, supabase } from '#lib/admin/session.svelte.ts';

	type Editor = { user_id: string; email: string; last_sign_in_at: string | null };
	let editors = $state<Editor[]>([]);
	let email = $state('');
	let busy = $state(false);
	let message = $state('');
	let failed = $state('');

	async function load() {
		const { data, error } = await supabase.rpc('list_plan_editors');
		if (error) failed = error.message;
		else editors = data as Editor[];
	}
	onMount(load);

	async function add(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		message = '';
		failed = '';
		const { error } = await supabase.rpc('grant_plan_editor', { editor_email: email.trim() });
		busy = false;
		if (error) failed = error.message;
		else {
			message = `${email.trim()} can now edit reading plans.`;
			email = '';
			load();
		}
	}

	async function remove(ed: Editor) {
		if (!confirm(`Remove ${ed.email}? They won’t be able to edit plans any more.`)) return;
		const { error } = await supabase.rpc('revoke_plan_editor', { editor_id: ed.user_id });
		if (error) failed = error.message;
		else load();
	}

	const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'never');
</script>

<h1 class="page">Editors</h1>
<p class="muted">People who can create, edit and publish reading plans.</p>

<ul class="list card">
	{#each editors as ed (ed.user_id)}
		<li>
			<span><strong>{ed.email}</strong>{#if ed.email === auth.email} <span class="muted">(you)</span>{/if}<br /><span class="muted small">Last signed in {when(ed.last_sign_in_at)}</span></span>
			{#if ed.email !== auth.email}<button class="btn btn-small" onclick={() => remove(ed)}>Remove</button>{/if}
		</li>
	{/each}
</ul>

<section class="card add">
	<h2>Add an editor</h2>
	<p class="muted small">
		They need to sign in once first. Send them to <strong>/admin</strong> on this site to request a sign-in link, then add the
		email they used here.
	</p>
	<form onsubmit={add}>
		<label class="field">Email <input type="email" required bind:value={email} /></label>
		<button class="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add editor'}</button>
	</form>
	{#if message}<p class="ok" role="status">{message}</p>{/if}
	{#if failed}<p class="error" role="alert">{failed}</p>{/if}
</section>

<style>
	.small {
		font-size: 14px;
	}
	.list {
		list-style: none;
		margin: 20px 0;
		padding: 0 !important;
		overflow: hidden;
	}
	.list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		border-top: 1px solid var(--line);
	}
	.list li:first-child {
		border-top: 0;
	}
	.add {
		max-width: 560px;
	}
	.add h2 {
		margin: 0 0 6px;
		font-size: 18px;
	}
	form {
		display: flex;
		gap: 10px;
		align-items: flex-end;
		flex-wrap: wrap;
		margin-top: 12px;
	}
	form .field {
		flex: 1 1 260px;
	}
	.ok {
		color: var(--ok);
	}
</style>
