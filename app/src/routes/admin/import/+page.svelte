<script lang="ts">
	import { goto } from '$app/navigation';
	import { saveDraft } from '#lib/admin/drafts.ts';
	import { niceDate } from '#lib/admin/plans.ts';
	import { importSheet } from '#lib/shared/importSheet.js';
	import { checkPlan } from '#lib/shared/planCheck.js';
	import { addDays } from '#lib/today.ts';
	import SheetFormatHelp from '#lib/components/SheetFormatHelp.svelte';

	let text = $state('');
	let title = $state('');
	let description = $state('');
	let start = $state('');
	let saving = $state(false);
	let error = $state('');
	let fillBlanks = $state(true);

	const result = $derived(text.trim() ? importSheet(text) : null);
	// Use the first date from the sheet unless one was chosen.
	const startDate = $derived(start || result?.start || '');
	const blanks = $derived(result?.days.filter((d) => !d.day).length ?? 0);
	const plan = $derived(
		result?.days.map((d) => ({ day: d.day || (fillBlanks ? "Lord's Day" : ''), ...(d.alt ? { alt: d.alt } : {}) })) ?? []
	);
	const check = $derived(checkPlan({ title: title || 'x', start: startDate, plan }));
	const errorsByDay = $derived(new Set(check.issues.filter((i) => i.level === 'error').map((i) => i.day)));
	const changed = $derived(result?.days.filter((d) => d.typed !== d.day).length ?? 0);
	const errorCount = $derived(check.issues.filter((i) => i.level === 'error').length);

	async function readFile(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (f) text = await f.text();
	}

	async function create() {
		if (!result) return;
		saving = true;
		error = '';
		try {
			const d = await saveDraft({
				plan_id: null,
				base_sha: null,
				data: { title: title.trim(), description: description.trim(), start: startDate, current: false, plan, extra: {} }
			});
			goto(`/admin/edit/?draft=${d.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Couldn’t save the draft.';
			saving = false;
		}
	}

	const fmt = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
</script>

<a href="/admin/" class="muted small">← Plans</a>
<h1 class="page">New plan from a spreadsheet</h1>
<p class="muted">Nothing goes live from here. This makes a draft you can check and edit before publishing.</p>

<div class="layout">
	<section class="card col">
		<h2>1 · Paste</h2>
		{#if result}<SheetFormatHelp />{/if}
		<label class="field">Spreadsheet rows <textarea bind:value={text} rows="14" placeholder={'Date\tReading\n1/4/2027\tGen 1-2\n1/5/2027\tGen 3-4, Ps 1'}></textarea></label>
		<label class="field">…or choose a .csv file <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onchange={readFile} /></label>
	</section>

	<section class="card col wide">
		<h2>2 · Check</h2>
		{#if !result}
			<p class="muted">Paste rows to see how they’ll be saved.</p>
			<SheetFormatHelp open />
		{:else}
			<p class="stats">
				<strong>{result.days.length}</strong> days
				{#if startDate}· {niceDate(startDate)} to {niceDate(addDays(startDate, result.days.length - 1))}{/if}
				· {changed} tidied up
				· {#if errorCount}<span class="error">{errorCount} to fix</span>{:else}<span class="ok">no problems</span>{/if}
			</p>
			{#each result.notes.filter((n) => !(fillBlanks && n.includes('no reading'))) as note (note)}<p class="banner small">{note}</p>{/each}
			{#if blanks}
				<label class="fill">
					<input type="checkbox" bind:checked={fillBlanks} />
					Fill the {blanks} blank day{blanks === 1 ? '' : 's'} with “Lord’s Day”
				</label>
			{/if}
			<div class="preview">
				<table>
					<thead><tr><th>Day</th><th>Date</th><th>You typed</th><th>Saved as</th></tr></thead>
					<tbody>
						{#each result.days.slice(0, 200) as d, i (i)}
							<tr class:bad={errorsByDay.has(i + 1)}>
								<td>{i + 1}</td>
								<td>{startDate ? fmt(addDays(startDate, i)) : '—'}</td>
								<td class="typed">{d.typed}{#if d.typedAlt}<br /><span class="muted">alt: {d.typedAlt}</span>{/if}</td>
								<td class="saved">{plan[i].day || '(blank)'}{#if d.alt}<br /><span class="muted">alt: {d.alt}</span>{/if}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if result.days.length > 200}<p class="muted small">…and {result.days.length - 200} more. You’ll see every day in the editor.</p>{/if}
			</div>
			{#if errorCount}<p class="muted small">Rows in red have a book or chapter that doesn’t exist. You can fix them in the editor, which suggests corrections.</p>{/if}
		{/if}
	</section>
</div>

<section class="card save">
	<h2>3 · Save as a draft</h2>
	<div class="fields">
		<label class="field">Title <input bind:value={title} placeholder="2027 Bible Reading Plan" /></label>
		<label class="field">Description <input bind:value={description} placeholder="Our reading plan for the year 2027." /></label>
		<label class="field">Start date <input type="date" value={startDate} oninput={(e) => (start = e.currentTarget.value)} /></label>
	</div>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<button class="btn btn-primary" onclick={create} disabled={!result?.days.length || !title.trim() || saving}>
		{saving ? 'Saving…' : 'Save draft and open the editor'}
	</button>
	{#if result?.days.length && !title.trim()}<p class="muted small">Add a title to continue.</p>{/if}
</section>

<style>
	.small {
		font-size: 14px;
	}
	h1 {
		margin-top: 6px !important;
	}
	h2 {
		font-size: 16px;
		margin: 0 0 10px;
	}
	.layout {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		margin: 20px 0;
		align-items: flex-start;
	}
	.col {
		flex: 1 1 340px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.col.wide {
		flex: 999 1 520px;
	}
	.stats {
		margin: 0;
	}
	.fill {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 14px;
		min-height: 44px;
	}
	.fill input {
		width: 20px;
		height: 20px;
		accent-color: var(--brand);
	}
	.ok {
		color: var(--ok);
	}
	.preview {
		max-height: 520px;
		overflow: auto;
		border: 1px solid var(--line);
		border-radius: 12px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}
	th {
		position: sticky;
		top: 0;
		background: var(--surface-muted);
		text-align: left;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		padding: 8px 10px;
	}
	td {
		padding: 8px 10px;
		border-top: 1px solid var(--line);
		vertical-align: top;
	}
	td.typed {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 13px;
		color: var(--muted);
	}
	td.saved {
		font-family: var(--font-scripture);
		font-size: 15px;
	}
	tr.bad td {
		background: #fef3f2;
	}
	tr.bad td.saved {
		color: #b42318;
	}
	.save {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}
	.fields {
		display: grid;
		grid-template-columns: 2fr 3fr 1fr;
		gap: 12px;
		width: 100%;
	}
	@media (max-width: 760px) {
		.fields {
			grid-template-columns: 1fr;
		}
	}
</style>
