<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { adminApi } from '#lib/admin/session.svelte.ts';
	import { deleteDraft, draftForFile, getDraft, saveDraft } from '#lib/admin/drafts.ts';
	import { loadAdminPlans, niceDate, scheduleNotes, type AdminPlan } from '#lib/admin/plans.ts';
	import { checkPlan, type Issue } from '#lib/shared/planCheck.js';
	import { normalizeReading } from '#lib/shared/normalize.js';
	import { importSheet } from '#lib/shared/importSheet.js';
	import { parsePlanDate, formatISO } from '#lib/shared/planDate.js';
	import { serializePlanFile, type PlanSource } from '#lib/shared/planFile.js';
	import { splitReferences } from '#lib/shared/scripture.js';
	import { addDays, weekday } from '#lib/today.ts';
	import SheetFormatHelp from '#lib/components/SheetFormatHelp.svelte';

	type Status = { email?: string; publishing: { repo: string; branch: string } | null };
	type PublishOk = { ok: true; id: string; path: string; url: string; alsoUpdated: string[] };

	// What's being edited
	let source = $state<PlanSource>({ title: '', description: '', start: '', current: false, plan: [{ day: '' }], extra: {} });
	let file = $state<string | undefined>(undefined); // published file this edits
	let baseSha = $state<string | null>(null);
	let draftId = $state<string | undefined>(undefined);
	let loadedFromDraft = $state(false);

	let others = $state<AdminPlan[]>([]);
	let status = $state<Status | null>(null);
	let ready = $state(false);
	let loadError = $state('');

	// Saving
	let saveState = $state<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
	let lastSaved = '';
	let timer: ReturnType<typeof setTimeout> | undefined;

	// Publishing
	let dialog = $state<HTMLDialogElement>();
	let publishing = $state(false);
	let publishError = $state('');
	let published = $state<PublishOk | null>(null);

	// Paste dialog
	let pasteDialog = $state<HTMLDialogElement>();
	let pasteText = $state('');

	const selfPaced = $derived(!source.start);
	const check = $derived(checkPlan(source));
	const errors = $derived(check.issues.filter((i) => i.level === 'error'));
	const warnings = $derived(check.issues.filter((i) => i.level === 'warning'));
	const byDay = $derived.by(() => {
		const m = new Map<number, Issue[]>();
		for (const i of check.issues) if (i.day) m.set(i.day, [...(m.get(i.day) ?? []), i]);
		return m;
	});
	const endDate = $derived(source.start && source.plan.length ? addDays(source.start, source.plan.length - 1) : '');
	const schedule = $derived.by(() => {
		if (!source.start) return [];
		const mine = { title: source.title || 'This plan', start: source.start, end: endDate };
		const rest = others.filter((p) => p.file !== file);
		return scheduleNotes([...rest, mine]).filter((n) => n.includes(mine.title));
	});
	const currentElsewhere = $derived(others.find((p) => p.current && p.file !== file));
	const blankDays = $derived(source.plan.filter((row) => !row.day.trim()).length);

	onMount(async () => {
		const q = page.url.searchParams;
		try {
			const [index, st] = await Promise.all([
				loadAdminPlans().catch(() => ({ plans: [] as AdminPlan[] })),
				adminApi<Status>('/api/admin/status').catch(() => null)
			]);
			others = index.plans;
			status = st;

			if (q.get('draft')) {
				const d = await getDraft(q.get('draft')!);
				if (!d) throw new Error('That draft no longer exists. It may have been published or discarded.');
				useDraft(d);
			} else if (q.get('file')) {
				file = q.get('file')!;
				const d = await draftForFile(file);
				if (d) useDraft(d);
				else await loadPublished(file, q.get('plan'));
			}
			lastSaved = JSON.stringify(source);
			ready = true;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Couldn’t open this plan.';
		}
	});

	function useDraft(d: Awaited<ReturnType<typeof getDraft>> & object) {
		draftId = d.id;
		file = d.plan_id ?? undefined;
		baseSha = d.base_sha;
		source = { ...d.data, start: isoStart(d.data.start) };
		loadedFromDraft = true;
	}

	async function loadPublished(f: string, planId: string | null) {
		try {
			// The latest version, straight from GitHub.
			const r = await adminApi<{ sha: string; source: PlanSource }>(`/api/admin/source/?file=${encodeURIComponent(f)}`);
			baseSha = r.sha;
			source = { ...r.source, start: isoStart(r.source.start) };
		} catch {
			// Publishing not set up (no GitHub token): fall back to the version this site was built from.
			if (!planId) throw new Error('Couldn’t load this plan.');
			const res = await fetch(`/api/plan/${planId}.json`);
			const v1 = await res.json();
			source = {
				title: v1.title,
				description: v1.description ?? '',
				start: isoStart(v1.start),
				current: !!v1.current,
				plan: v1.plan.map((d: { day: string; alt?: string }) => ({ day: d.day, ...(d.alt ? { alt: d.alt } : {}) })),
				extra: {}
			};
		}
	}

	const isoStart = (s: string) => {
		const d = parsePlanDate(s);
		return d ? formatISO(d) : '';
	};

	// Autosave a draft a moment after each change.
	$effect(() => {
		const snapshot = JSON.stringify(source);
		if (!ready || snapshot === lastSaved) return;
		saveState = 'unsaved';
		clearTimeout(timer);
		timer = setTimeout(save, 1200);
	});

	async function save() {
		const snapshot = JSON.stringify(source);
		saveState = 'saving';
		try {
			const d = await saveDraft({ id: draftId, plan_id: file ?? null, data: $state.snapshot(source), base_sha: baseSha });
			if (!draftId) {
				draftId = d.id;
				// Keep the URL pointing at the draft so a refresh reopens it.
				history.replaceState(history.state, '', `/admin/edit/?draft=${d.id}`);
			}
			lastSaved = snapshot;
			saveState = JSON.stringify(source) === snapshot ? 'saved' : 'unsaved';
		} catch {
			saveState = 'error';
		}
	}

	function beforeUnload(e: BeforeUnloadEvent) {
		if (saveState !== 'saved') e.preventDefault();
	}

	// Editing helpers
	const tidy = (i: number, field: 'day' | 'alt') => {
		const row = source.plan[i];
		const value = normalizeReading(row[field] ?? '');
		if (field === 'alt' && !value) delete row.alt;
		else row[field] = value;
	};
	const insertAt = (i: number) => source.plan.splice(i, 0, { day: '' });
	const removeAt = (i: number) => source.plan.splice(i, 1);
	const addDay = async () => {
		source.plan.push({ day: '' });
		await tick();
		document.getElementById(`day-${source.plan.length}`)?.focus();
	};
	function fillBlankDays() {
		for (const row of source.plan) if (!row.day.trim()) row.day = "Lord's Day";
	}
	function applyFix(issue: Issue) {
		if (!issue.day || !issue.field || issue.text === undefined || !issue.fix) return;
		const row = source.plan[issue.day - 1];
		if (issue.text === '') {
			row[issue.field] = issue.fix; // a blank day
			return;
		}
		const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
		const parts = splitReferences(row[issue.field] ?? '').map((p) => (clean(p) === issue.text ? issue.fix! : p));
		row[issue.field] = parts.join(', ');
	}
	async function goToDay(n: number) {
		const el = document.getElementById(`day-${n}`);
		el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		el?.focus({ preventScroll: true });
	}
	function setSupplemental(on: boolean) {
		if (on) {
			source.extra.supplemental = true;
			source.current = false;
		} else delete source.extra.supplemental;
	}
	function setSelfPaced(on: boolean) {
		if (on) {
			source.start = '';
			source.current = false;
		}
	}

	function replaceFromPaste() {
		const r = importSheet(pasteText);
		if (!r.days.length) return;
		source.plan = r.days.map((d) => ({ day: d.day, ...(d.alt ? { alt: d.alt } : {}) }));
		if (r.start) source.start = r.start;
		pasteDialog?.close();
		pasteText = '';
	}

	function download() {
		const blob = new Blob([serializePlanFile($state.snapshot(source))], { type: 'text/markdown' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = file ?? `${(source.title || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	async function discardDraft() {
		if (!draftId || !confirm('Discard this draft? Your unpublished changes will be lost.')) return;
		await deleteDraft(draftId);
		goto('/admin/');
	}

	async function publish() {
		publishing = true;
		publishError = '';
		clearTimeout(timer);
		try {
			const r = await adminApi<PublishOk>('/api/admin/publish', {
				method: 'POST',
				body: JSON.stringify({ file, baseSha: baseSha ?? undefined, source: $state.snapshot(source) })
			});
			published = r;
			if (draftId) await deleteDraft(draftId).catch(() => {});
			draftId = undefined;
			lastSaved = JSON.stringify(source);
			saveState = 'saved';
		} catch (e) {
			publishError = e instanceof Error ? e.message : 'Publishing failed.';
		} finally {
			publishing = false;
		}
	}

	const dayLabel = (i: number) => (source.start ? addDays(source.start, i) : '');
	const fmtDay = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
	const fieldErrors = (n: number, field: 'day' | 'alt') => (byDay.get(n) ?? []).filter((i) => i.level === 'error' && i.field === field);
	const saveText = $derived(
		{ saved: draftId ? 'Draft saved' : 'No changes', saving: 'Saving…', unsaved: 'Unsaved changes', error: 'Couldn’t save. Check your connection.' }[saveState]
	);
</script>

<svelte:window onbeforeunload={beforeUnload} />

{#if loadError}
	<p class="error" role="alert">{loadError}</p>
	<a class="btn" href="/admin/">Back to plans</a>
{:else if !ready}
	<p class="muted">Loading…</p>
{:else}
	<div class="top">
		<div>
			<a href="/admin/" class="muted small">← Plans</a>
			<h1 class="page">{source.title || 'New plan'}</h1>
			<p class="muted small" aria-live="polite">
				{saveText}{#if loadedFromDraft && file} · you’re editing a draft with unpublished changes{/if}
			</p>
		</div>
		<div class="actions">
			{#if draftId}<button class="btn btn-quiet" onclick={discardDraft}>Discard draft</button>{/if}
			<button class="btn" onclick={download}>Download file</button>
			<button
				class="btn btn-primary"
				disabled={!status?.publishing}
				onclick={() => {
					published = null;
					publishError = '';
					dialog?.showModal();
				}}>Publish…</button>
		</div>
	</div>
	{#if status && !status.publishing}
		<div class="banner"><p>Publishing isn’t set up on this site yet, so you can edit and save drafts but not publish. (It needs a GitHub token in the Vercel settings.)</p></div>
	{/if}

	<section class="card meta">
		<label class="field wide">Title <input bind:value={source.title} placeholder="2027 Bible Reading Plan" /></label>
		<label class="field wide">Description <input bind:value={source.description} placeholder="Our reading plan for the year 2027." /></label>
		<div class="dates">
			<label class="field">
				Start date
				<input type="date" bind:value={source.start} />
			</label>
			<p class="muted small">
				{#if source.start}
					{source.plan.length} days · ends {niceDate(endDate)} ({fmtDay(endDate).split(',')[0]})
				{:else}
					No start date: people start this plan whenever they like.
				{/if}
			</p>
			{#if source.start}
				<button class="btn btn-quiet btn-small" onclick={() => setSelfPaced(true)}>Make it start-any-day</button>
			{/if}
		</div>
		<label class="toggle">
			<input type="checkbox" bind:checked={() => source.extra.supplemental === true, setSupplemental} />
			<span>
				<strong>Extra plan</strong>: readers can follow it alongside the church plan (Advent, Psalms &amp; Proverbs, …).
				It never becomes the current plan, so the church app (Subsplash) never shows it.
			</span>
		</label>
		{#if source.start && source.extra.supplemental !== true}
			<label class="toggle">
				<input type="checkbox" bind:checked={source.current} />
				<span>
					<strong>Current plan</strong>: what the current website and the church app (Subsplash) show as “current”.
					{#if source.current && currentElsewhere}<br /><span class="muted">Publishing moves this from “{currentElsewhere.title}”.</span>{/if}
				</span>
			</label>
		{/if}
	</section>

	<div class="layout">
		<section class="grid-wrap" aria-label="Days">
			<div class="toolbar">
				<button class="btn btn-small" onclick={addDay}>Add a day</button>
				<button class="btn btn-small" onclick={fillBlankDays} disabled={blankDays === 0}>
					Fill {blankDays || ''} blank day{blankDays === 1 ? '' : 's'} with “Lord’s Day”
				</button>
				<button class="btn btn-small" onclick={() => pasteDialog?.showModal()}>Replace days from a spreadsheet…</button>
			</div>
			<p class="muted small hint">
				Type readings any way you like (“Gen 1-2; Ps 23”); they’re tidied up when you move on. Inserting or removing a day
				moves every later day by one.
			</p>
			<div class="table">
				<div class="row header" aria-hidden="true">
					<span>Day</span><span>Date</span><span>Reading</span><span>Alternate (optional)</span><span></span>
				</div>
				{#each source.plan as row, i (i)}
					{@const n = i + 1}
					{@const date = dayLabel(i)}
					{@const dayErr = fieldErrors(n, 'day')}
					{@const altErr = fieldErrors(n, 'alt')}
					<div class="row" class:sunday={date && weekday(date) === 0} class:bad={dayErr.length || altErr.length}>
						<span class="n">{n}</span>
						<span class="date">{date ? fmtDay(date) : '—'}</span>
						<span class="cell">
							<input
								id="day-{n}"
								aria-label="Day {n} reading"
								aria-invalid={dayErr.length > 0}
								bind:value={row.day}
								onblur={() => tidy(i, 'day')}
							/>
							{#each dayErr as e (e.message)}
								<span class="msg">{e.message.replace(/^Day \d+( \([^)]*\))?: /, '')}{#if e.fix}<button class="fix" onclick={() => applyFix(e)}>Use “{e.fix}”</button>{/if}</span>
							{/each}
						</span>
						<span class="cell">
							<input
								aria-label="Day {n} alternate reading"
								aria-invalid={altErr.length > 0}
								value={row.alt ?? ''}
								oninput={(e) => (row.alt = e.currentTarget.value)}
								onblur={() => tidy(i, 'alt')}
							/>
							{#each altErr as e (e.message)}
								<span class="msg">{e.message.replace(/^Day \d+( \([^)]*\))?( \(alternate\))?: /, '')}{#if e.fix}<button class="fix" onclick={() => applyFix(e)}>Use “{e.fix}”</button>{/if}</span>
							{/each}
						</span>
						<span class="row-actions">
							<button class="icon" aria-label="Insert a day before day {n}" title="Insert a day before" onclick={() => insertAt(i)}>＋</button>
							<button class="icon" aria-label="Remove day {n}" title="Remove this day" onclick={() => removeAt(i)} disabled={source.plan.length === 1}>✕</button>
						</span>
					</div>
				{/each}
			</div>
		</section>

		<aside class="checks" aria-label="Checks">
			<h2>Checks</h2>
			{#if errors.length}
				<p class="count bad">{errors.length} to fix before publishing</p>
				<ul>
					{#each errors as e, k (k)}
						<li class="issue err">
							<p>{e.message}</p>
							<div class="row-btns">
								{#if e.fix}<button class="btn btn-small btn-primary" onclick={() => applyFix(e)}>Use “{e.fix}”</button>{/if}
								{#if e.day}<button class="btn btn-small" onclick={() => goToDay(e.day!)}>Go to day {e.day}</button>{/if}
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="count ok">✓ Every reading is a real book and chapter</p>
			{/if}
			{#if warnings.length || schedule.length}
				<h3>Worth a look <span class="muted">(won’t stop publishing)</span></h3>
				<ul>
					{#each [...warnings.map((w) => w.message), ...schedule] as text, k (k)}<li class="issue note"><p>{text}</p></li>{/each}
				</ul>
				{#each warnings.filter((w) => w.detail) as w (w.message)}
					<details>
						<summary>Show the repeated chapters</summary>
						<ul class="detail">{#each w.detail ?? [] as d (d)}<li>{d}</li>{/each}</ul>
					</details>
				{/each}
			{/if}
			<p class="muted small">{check.days} days · {check.chapters} different chapters from {check.books} books</p>
		</aside>
	</div>

	<dialog bind:this={dialog} aria-labelledby="publish-title">
		{#if published}
			<h2 id="publish-title">Published</h2>
			<p><strong>{source.title}</strong> will be live on the website and in the church app in about a minute.</p>
			{#if published.alsoUpdated.length}<p class="muted">The previous current plan was updated in the same change.</p>{/if}
			<div class="dialog-actions">
				<a class="btn btn-quiet" href={published.url} target="_blank" rel="noopener">See the change on GitHub</a>
				<a class="btn btn-primary" href="/admin/">Back to plans</a>
			</div>
		{:else}
			<h2 id="publish-title">Publish “{source.title || 'Untitled'}”?</h2>
			<ul class="summary">
				<li>{source.plan.length} days{#if source.start}, {niceDate(source.start)} to {niceDate(endDate)}{:else}, start any day{/if}</li>
				{#if source.current}<li>Becomes the <strong>current plan</strong>{#if currentElsewhere} (instead of “{currentElsewhere.title}”){/if}</li>{/if}
				{#if warnings.length}<li class="muted">{warnings.length} note{warnings.length === 1 ? '' : 's'} in Checks (fine to publish)</li>{/if}
				<li class="muted">Publishing to {status?.publishing?.branch === 'main' ? 'the live site' : `the “${status?.publishing?.branch}” branch`}</li>
			</ul>
			{#if errors.length}<p class="error">Fix the {errors.length} problem{errors.length === 1 ? '' : 's'} in Checks first.</p>{/if}
			{#if publishError}<p class="error" role="alert">{publishError}</p>{/if}
			<div class="dialog-actions">
				<button class="btn" onclick={() => dialog?.close()}>Cancel</button>
				<button class="btn btn-primary" onclick={publish} disabled={publishing || errors.length > 0 || !source.title.trim()}>
					{publishing ? 'Publishing…' : 'Publish now'}
				</button>
			</div>
		{/if}
	</dialog>

	<dialog bind:this={pasteDialog} aria-labelledby="paste-title">
		<h2 id="paste-title">Replace days from a spreadsheet</h2>
		<SheetFormatHelp />
		<label class="field">Rows <textarea bind:value={pasteText} rows="10"></textarea></label>
		{#if pasteText.trim()}<p class="muted small">{importSheet(pasteText).days.length} days found. This replaces all {source.plan.length} current days.</p>{/if}
		<div class="dialog-actions">
			<button class="btn" onclick={() => pasteDialog?.close()}>Cancel</button>
			<button class="btn btn-primary" onclick={replaceFromPaste} disabled={!pasteText.trim()}>Replace days</button>
		</div>
	</dialog>
{/if}

<style>
	.small {
		font-size: 14px;
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-end;
		gap: 16px;
		margin-bottom: 16px;
	}
	.top p {
		margin: 4px 0 0;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.banner {
		margin-bottom: 16px;
	}
	.meta {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px 18px;
		margin-bottom: 20px;
	}
	.meta .wide {
		grid-column: span 1;
	}
	.dates {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px 16px;
	}
	.dates p {
		margin: 0 0 12px;
	}
	.toggle {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		font-size: 14px;
		padding-top: 18px;
	}
	.toggle input {
		width: 20px;
		height: 20px;
		margin-top: 2px;
		accent-color: var(--brand);
	}
	@media (max-width: 760px) {
		.meta {
			grid-template-columns: 1fr;
		}
	}
	.layout {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		align-items: flex-start;
	}
	.grid-wrap {
		flex: 999 1 620px;
		min-width: 0;
	}
	.toolbar {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.hint {
		margin: 10px 0;
	}
	.table {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		overflow: hidden;
	}
	.row {
		display: grid;
		grid-template-columns: 44px 104px minmax(0, 3fr) minmax(0, 2fr) 76px;
		gap: 8px;
		align-items: start;
		padding: 6px 10px;
		border-top: 1px solid var(--line);
	}
	.row.header {
		border-top: 0;
		background: var(--surface-muted);
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		padding: 10px;
	}
	.row.sunday {
		background: color-mix(in srgb, var(--surface-muted) 60%, transparent);
	}
	.n,
	.date {
		padding-top: 10px;
		font-size: 14px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.cell input {
		width: 100%;
		min-height: 40px;
		padding: 0 10px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		font: 16px var(--font-scripture);
		color: var(--ink);
	}
	.cell input:hover {
		border-color: var(--line);
	}
	.cell input:focus {
		border-color: var(--brand);
		background: var(--surface);
		outline: none;
		box-shadow: 0 0 0 3px var(--brand-soft);
	}
	.cell input[aria-invalid='true'] {
		border-color: var(--danger-line);
		background: var(--danger-soft);
	}
	.msg {
		font-size: 13px;
		color: var(--danger);
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		align-items: center;
		padding: 0 2px 4px;
	}
	.fix {
		border: 0;
		background: none;
		color: var(--brand);
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
		padding: 4px 0;
		font-size: 13px;
	}
	.row-actions {
		display: flex;
		gap: 2px;
		padding-top: 2px;
	}
	.icon {
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
	.icon:hover:not(:disabled) {
		background: var(--surface-muted);
		color: var(--ink);
	}
	@media (max-width: 760px) {
		.row {
			grid-template-columns: 36px minmax(0, 1fr) 76px;
		}
		.row.header {
			display: none;
		}
		.row .date {
			grid-column: 2 / 4;
			padding-top: 4px;
		}
		.row .cell {
			grid-column: 1 / 3;
		}
		.row .cell + .cell input::placeholder {
			color: var(--muted);
		}
		.row-actions {
			grid-column: 3;
			grid-row: 1;
		}
	}
	.checks {
		flex: 1 1 320px;
		max-width: 420px;
		position: sticky;
		top: 16px;
		max-height: calc(100dvh - 32px);
		overflow: auto;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 18px;
	}
	@media (max-width: 1000px) {
		.checks {
			position: static;
			max-width: none;
			max-height: none;
			order: -1;
		}
	}
	.checks h2 {
		margin: 0 0 8px;
		font-size: 18px;
	}
	.checks h3 {
		font-size: 14px;
		margin: 18px 0 8px;
	}
	.checks ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.count {
		font-weight: 600;
		margin: 0 0 10px;
	}
	.count.bad {
		color: var(--danger);
	}
	.count.ok {
		color: var(--ok);
	}
	.issue {
		border-radius: 12px;
		padding: 10px 12px;
		font-size: 14px;
	}
	.issue p {
		margin: 0;
	}
	.issue.err {
		background: var(--danger-soft);
		border: 1px solid var(--danger-line);
		color: var(--ink);
	}
	.issue.note {
		background: var(--warn-soft);
		color: var(--warn-ink);
	}
	.row-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}
	.detail {
		font-size: 13px;
		gap: 2px !important;
		margin-top: 6px !important;
	}
	details {
		margin-top: 8px;
		font-size: 14px;
	}
	dialog {
		border: 0;
		border-radius: 18px;
		padding: 24px;
		max-width: 520px;
		width: calc(100% - 32px);
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 20px 60px rgb(0 0 0 / 0.25);
	}
	dialog::backdrop {
		background: rgb(28 25 23 / 0.45);
	}
	dialog h2 {
		margin: 0 0 12px;
		font-family: var(--font-scripture);
	}
	.summary {
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 18px;
	}
</style>
