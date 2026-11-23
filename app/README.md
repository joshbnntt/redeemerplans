# Redeemer Bible Reading (v2)

SvelteKit 3 + Svelte 5 app that will replace the 11ty site in the repository root.
See `../docs/v2/PLAN.md` for the plan.

Everything is **prerendered** to static files and served from Vercel's CDN. Plans are read at
build time from `../src/plan/*.md`, the same files the current site uses.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # output in .vercel/output
npm test           # unit tests (Vitest)
npm run check      # type check
```

From the repository root, `npm run test:compat` builds this app and checks that the Subsplash XML,
the v1 JSON API and the calendar feed are byte-for-byte the same as the current site's.

## Layout

| Path | What |
|---|---|
| `src/lib/shared/` | Plain-JS ES modules shared with the legacy site and (later) the admin page: Bible canon and reference parsing, plan dates, plan checks, link builders |
| `src/lib/server/plans.ts` | Loads the plans at build time |
| `src/lib/server/v1.ts` | Legacy outputs, kept identical: `/api/*.json`, `/subsplash/<plan>.xml`, `/currentplan.xml`, `/feed.ics` |
| `src/lib/server/v2.ts` | New outputs: `/api/v2/plans.json`, `/api/v2/plans/<id>.json`, `/cal/<id>.ics` |
| `src/lib/today.ts` | Works out today's reading in the reader's own time zone |
| `src/lib/components/UpdateToast.svelte` | "A new version is available · Reload" |
| `src/lib/components/InstallPrompt.svelte` | Install prompt (Android/desktop) and Add to Home Screen hint (iOS) |

## PWA

`@vite-pwa/sveltekit` generates `/sw.js` (the same path as the old site's service worker, so
installed copies upgrade cleanly). The app shell and every page are precached. Plan data uses
stale-while-revalidate, so it opens offline and picks up a publish on the next visit. An open app
checks for a new version on launch, when it comes back to the foreground, and hourly.

## Deploying (preview)

Until the switchover, this folder deploys as the separate Vercel project **`redeemerplans-v2`**
(Root Directory `app`); every push gets its own preview URL. The existing `redeemerplans` project
keeps serving the live 11ty site from the repository root. Keep "Include files outside the root directory in
the Build Step" enabled (the default), because plans are read from `../src/plan`.
