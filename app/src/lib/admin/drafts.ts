/** Drafts are saved in Supabase as the pastor works, so nothing is lost and nothing is live yet. */
import type { PlanSource } from '#lib/shared/planFile.js';
import { supabase } from './session.svelte.ts';

export type Draft = {
	id: string;
	plan_id: string | null; // file name of the published plan this edits, or null for a new plan
	title: string;
	data: PlanSource;
	base_sha: string | null;
	updated_at: string;
};

export async function listDrafts(): Promise<Draft[]> {
	const { data, error } = await supabase.from('plan_drafts').select('*').order('updated_at', { ascending: false });
	if (error) throw error;
	return data as Draft[];
}

export async function getDraft(id: string): Promise<Draft | null> {
	const { data, error } = await supabase.from('plan_drafts').select('*').eq('id', id).maybeSingle();
	if (error) throw error;
	return data as Draft | null;
}

export async function draftForFile(file: string): Promise<Draft | null> {
	const { data, error } = await supabase
		.from('plan_drafts')
		.select('*')
		.eq('plan_id', file)
		.order('updated_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return data as Draft | null;
}

export async function saveDraft(draft: { id?: string; plan_id: string | null; data: PlanSource; base_sha: string | null }): Promise<Draft> {
	const row = { ...draft, title: draft.data.title };
	const query = draft.id
		? supabase.from('plan_drafts').update(row).eq('id', draft.id).select().single()
		: supabase.from('plan_drafts').insert(row).select().single();
	const { data, error } = await query;
	if (error) throw error;
	return data as Draft;
}

export async function deleteDraft(id: string) {
	const { error } = await supabase.from('plan_drafts').delete().eq('id', id);
	if (error) throw error;
}
