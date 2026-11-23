<script lang="ts">
	import { onMount } from 'svelte';
	import { auth, supabase } from '#lib/admin/session.svelte.ts';

	type Editor = { user_id: string; email: string; last_sign_in_at: string | null };
	type Invite = { email: string; created_at: string };
	let editors = $state<Editor[]>([]);
	let invites = $state<Invite[]>([]);
	let email = $state('');
	let busy = $state(false);
	let message = $state('');
	let failed = $state('');
	let adminLink = $state('');

	async function load() {
		const [eds, inv] = await Promise.all([
			supabase.rpc('list_plan_editors'),
			supabase.from('plan_editor_invites').select('email, created_at').order('created_at')
		]);
		if (eds.error) failed = eds.error.message;
		else editors = eds.data as Editor[];
		invites = (inv.data ?? []) as Invite[];
	}
	onMount(() => {
		adminLink = `${location.origin}/admin/`;
		load();
	});

	async function add(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		message = '';
		failed = '';
		const address = email.trim();
		const { data, error } = await supabase.rpc('grant_plan_editor', { editor_email: address });
		busy = false;
		if (error) failed = error.message;
		else {
			message =
				data === 'invited'
					? `${address} is invited. Send them ${adminLink}. When they sign in there with this address, they can edit plans.`
					: `${address} can now edit reading plans.`;
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

	async function cancel(inv: Invite) {
		if (!confirm(`Cancel the invite for ${inv.email}?`)) return;
		const { error } = await supabase.from('plan_editor_invites').delete().eq('email', inv.email);
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
	{#each invites as inv (inv.email)}
		<li>
			<span><strong>{inv.email}</strong> <span class="pill draft">Invited</span><br /><span class="muted small">Invited {when(inv.created_at)} · hasn’t signed in yet</span></span>
			<button class="btn btn-small" onclick={() => cancel(inv)}>Cancel invite</button>
		</li>
	{/each}
</ul>

<section class="card add">
	<h2>Add an editor</h2>
	<p class="muted small">
		Enter their email. If they already have an account they can edit right away; otherwise they’re invited, and editing
		switches on the first time they sign in at <strong>{adminLink || '/admin/'}</strong> with that address.
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
		max-width: 620px;
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
