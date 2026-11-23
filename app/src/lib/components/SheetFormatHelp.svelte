<script lang="ts">
	/** How to lay out a spreadsheet for "Paste from spreadsheet", with a sample file to start from. */
	let { open = false }: { open?: boolean } = $props();

	const sample = [
		['Date', 'Reading', 'Alternate'],
		['1/4/2027', 'Genesis 1, Genesis 2', ''],
		['1/5/2027', 'Gen 3-4; Ps 1', 'Psalm 2'],
		['1/6/2027', 'Matthew 1', ''],
		['1/7/2027', 'Genesis 5, Matthew 2', ''],
		['1/8/2027', 'Genesis 6-7', ''],
		['1/9/2027', 'Psalm 119:1-32', ''],
		['1/10/2027', '', ''],
		['1/11/2027', 'Genesis 8, Genesis 9', '']
	];

	function download() {
		const csv = sample.map((row) => row.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n');
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([csv + '\r\n'], { type: 'text/csv' }));
		a.download = 'reading-plan-sample.csv';
		a.click();
		URL.revokeObjectURL(a.href);
	}
</script>

<details class="help" {open}>
	<summary>How to set up the spreadsheet</summary>
	<div class="body">
		<p>One row per day, in order. Use these columns (the header row is optional):</p>
		<div class="scroll">
			<table>
				<thead><tr>{#each sample[0] as h (h)}<th>{h}</th>{/each}</tr></thead>
				<tbody>
					{#each sample.slice(1, 4) as row, i (i)}
						<tr>{#each row as cell, j (j)}<td>{cell}</td>{/each}</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<ul>
			<li><strong>Date</strong> (optional): 1/4/2027, 01-04-2027, 2027-01-04 or Jan 4, 2027. The first date becomes the start date, and each row after it is the next day, so don’t skip dates.</li>
			<li><strong>Reading</strong>: separate passages with commas or semicolons. Abbreviations and ranges are fine: “Gen 3-4; Ps 1” becomes “Genesis 3, Genesis 4, Psalm 1”. Verses work too: “Psalm 119:1-32”.</li>
			<li><strong>Alternate</strong> (optional): another reading for that day.</li>
			<li><strong>Sundays</strong>: type “Lord’s Day”, or leave the reading blank and fill blank days with Lord’s Day afterwards.</li>
		</ul>
		<p class="muted">In Google Sheets or Excel, select the cells and copy, then paste here. Or save as CSV and choose the file.</p>
		<button type="button" class="btn btn-small" onclick={download}>Download a sample file</button>
	</div>
</details>

<style>
	.help {
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface);
		font-size: 14px;
	}
	summary {
		cursor: pointer;
		padding: 12px 14px;
		font-weight: 600;
		color: var(--brand);
		min-height: 44px;
		box-sizing: border-box;
	}
	.body {
		padding: 0 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
	}
	.body p,
	.body ul {
		margin: 0;
	}
	ul {
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.scroll {
		overflow-x: auto;
		max-width: 100%;
	}
	table {
		border-collapse: collapse;
		font-size: 13px;
	}
	th,
	td {
		border: 1px solid var(--line);
		padding: 6px 10px;
		text-align: left;
		white-space: nowrap;
	}
	th {
		background: var(--surface-muted);
	}
</style>
