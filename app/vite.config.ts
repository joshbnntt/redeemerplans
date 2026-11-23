import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-vercel';
import { withPwa } from '@vite-pwa/sveltekit';

export default defineConfig({
	server: {
		// Plans are read from ../src/plan (shared with the legacy site until the switchover).
		fs: { allow: ['..'] }
	},
	plugins: [
		withPwa(
			// SvelteKit options
			{
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
				},
				adapter: adapter()
			},
			// PWA options
			{
				// Ask before updating: the app shows "A new version is available · Reload".
				registerType: 'prompt',
				injectRegister: false,
				// Same path as the old site's service worker, so installed copies upgrade cleanly.
				filename: 'sw.js',
				kit: { trailingSlash: 'always' },
				manifest: {
					name: 'Redeemer Bible Reading',
					short_name: 'Bible Reading',
					description: 'Bible reading plans for Redeemer Church in North Santa Rosa County, Florida',
					start_url: '/',
					scope: '/',
					lang: 'en-US',
					theme_color: '#0c4a6e',
					background_color: '#f6f4ef',
					display: 'standalone',
					icons: [
						{ src: '/images/web/icon-192.png', type: 'image/png', sizes: '192x192' },
						{ src: '/images/web/icon-512.png', type: 'image/png', sizes: '512x512' },
						{ src: '/images/web/icon-192-maskable.png', type: 'image/png', sizes: '192x192', purpose: 'maskable' },
						{ src: '/images/web/icon-512-maskable.png', type: 'image/png', sizes: '512x512', purpose: 'maskable' }
					],
					shortcuts: [{ name: 'Plan', short_name: 'Plan', url: '/plan/', icons: [{ src: '/images/web/icon-192.png', sizes: '192x192' }] }]
				},
				generateSW: {
					// Precache the app shell and pages; plan data is cached at runtime (below).
					globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff2}', 'prerendered/**/*.html'],
					// Opening a data file in the browser (the Subsplash XML, the JSON API, calendar feeds)
					// must get the real file, not the app's offline page.
					navigateFallbackDenylist: [/\.[a-z0-9]+$/i, /^\/(api|cal|subsplash)\//],
					runtimeCaching: [
						{
							// Plan data: show the cached copy instantly (works offline), refresh in the background.
							urlPattern: ({ url }) => url.pathname.startsWith('/api/v2/'),
							handler: 'StaleWhileRevalidate',
							options: { cacheName: 'plans-v2', expiration: { maxEntries: 50 } }
						}
					]
				}
			}
		)
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
