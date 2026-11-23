/** Reader preferences, kept on this device. */
import { load, save } from './storage.ts';
import type { ReadingApp, Translation } from '#lib/shared/links.js';

export type Theme = 'system' | 'light' | 'dark';
type Prefs = { translation: Translation; app: ReadingApp; theme: Theme };

const defaults: Prefs = { translation: 'ESV', app: 'youversion', theme: 'system' };

export const prefs = $state<Prefs>({ ...defaults });

let started = false;
export function startPrefs() {
	if (started) return;
	started = true;
	// The current site stored the YouVersion translation id; carry it over.
	const legacy = load<string | null>('translation', null);
	const legacyMap: Record<string, Translation> = { '1': 'KJV', '59': 'ESV', '1713': 'CSB', '2692': 'NASB', '3345': 'LSB', '111': 'NIV', '114': 'NKJV', '116': 'NLT' };
	Object.assign(prefs, defaults, legacy && legacyMap[legacy] ? { translation: legacyMap[legacy] } : {}, load<Partial<Prefs>>('prefs', {}));
	$effect.root(() => {
		$effect(() => {
			save('prefs', { ...prefs });
			applyTheme(prefs.theme);
		});
	});
}

export function applyTheme(theme: Theme) {
	if (theme === 'system') delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = theme;
}
