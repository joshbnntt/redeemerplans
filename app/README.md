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

## Admin (`/admin`)

For editors (the pastor and anyone they add). Sign in with an emailed link; editor access is the
`readingplan-edit` row in Supabase's `permissions` table, managed from the **Editors** page.
An editor can add someone by email even before they have an account: they're invited, and editing
switches on the first time they sign in. The admin sign-in page never creates accounts for anyone
else.

- **Plans:** every plan with its dates, status and check results, plus drafts in progress.
- **Paste from spreadsheet:** paste rows from Google Sheets/Excel or choose a CSV; shows what was
  typed next to what will be saved ("Gen 1-2" → "Genesis 1, Genesis 2"), then saves a draft.
- **Editor:** one row per day with dates worked out from the start date, checks with one-click
  fixes, autosaved drafts, and Publish.
- **Publish** (`/api/admin/publish`, a Vercel Function): checks the editor, re-runs the plan
  checks, refuses if the plan changed since it was opened, and commits `src/plan/<name>.md` to
  GitHub in the same layout as the existing files. Making a plan "current" un-marks the old one in
  the same commit. Both Vercel projects rebuild, so it's live in about a minute.
- **Readers:** everyone with an account: when they joined and were last active, whether they're
  still signed in on any device, and their progress (percent, streak, days behind, last two weeks)
  in the current plan or any earlier church plan. Data comes from the editor-only `list_readers()`
  function.
- **Publishing history:** who published what, with a link to each change on GitHub.

Database changes are in `../supabase/migrations/` (drafts, publish log and editor functions; all
additive).

### Settings (Vercel → redeemerplans-v2 → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | Fine-grained token, this repository only, **Contents: Read and write**. Mark it Sensitive. Without it, editing and drafts work but Publish is off. |
| `GITHUB_BRANCH` | Preview: `claude/stoic-hawking-earl1m` (already set, so testing never touches the live site). Production: unset, which means `main`. |
| `GITHUB_REPO` | Optional; defaults to `joshbnntt/redeemerplans`. |

Supabase → Authentication → URL Configuration → **Redirect URLs** must include the admin's address
(for example `https://redeemerplans-v2-*-joshuabnntts-projects.vercel.app/admin/` and the live
domain's `/admin/`), or sign-in links will send people to the old site instead.

## Daily plan changeover (`/api/cron/changeover`)

Vercel runs this once a day at 12:05am Central time (a Vercel Schedule in `vercel.json`; Vercel
handles daylight saving, and on the free plan may start it up to 15 minutes late).
If a church plan started today (or up to 3 days ago, to catch up a missed run) and isn't
"current" yet, it makes one commit that marks it current and un-marks the old one, changing only
the `current:` line in each file. On every other day it does nothing, so it costs no builds.

It needs `GITHUB_TOKEN` and `CRON_SECRET` (Vercel sends the secret with scheduled requests).
To check what it would do on a given date without changing anything:

    curl -H "Authorization: Bearer $CRON_SECRET" "https://redeemerplans-v2.vercel.app/api/cron/changeover?dryRun=1&today=2027-01-04"
