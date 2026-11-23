# Redeemer Plans v2: plan

Status: Phases 0 and 1 done. Admin is next, so it's ready for the pastor to write next year's plan. · Mockups: https://claude.ai/artifact/CvyVCA7kfqfKVwGFzmSkbD

## Decisions

| Topic | Decision |
|---|---|
| Hosting | **Vercel** (moving off Netlify) |
| Frontend | **SvelteKit** (Svelte 5), replacing 11ty + Alpine + Turbo |
| Publish latency | About a minute from Publish to live is fine, so the site stays static |
| Subsplash XML | Still used by the church app, so it stays **byte-compatible at the same URLs** |
| Reminders | **Calendar subscription only** (no email: avoids an extra service and its cost) |
| PWA | Must be installable and must tell the reader when an update is available |

## Goals

1. **Keep what works.** Free static hosting, a static JSON API, and plans as plain data
   that can be generated from a spreadsheet.
2. **A non-developer can manage plans.** The pastor creates, edits, checks and publishes plans
   in a browser. Nobody touches git, YAML or a terminal.
3. **Catch mistakes before readers do.** Automated checks for typos, impossible chapters,
   duplicates, gaps and date problems.
4. **A better reading experience.** A clear "Today" screen, progress and streaks, catch-up,
   personal self-paced plans, calendar subscription. Installable, works offline, and announces updates.

## Architecture

A single SvelteKit app on Vercel with `@sveltejs/adapter-vercel`. **Every page and data file is
prerendered at build time** and served from Vercel's CDN as static files. The only server code is
the admin **publish** endpoint, which runs as a Vercel Function.

```
 Reader ──► static HTML/JSON/ICS/XML on Vercel CDN  (prerendered, same as today in spirit)
              └─► Supabase: sign-in + reading progress only (as today)

 Pastor ──► /admin (prerendered page; data loads client-side)
              │  sign in: Supabase magic link + admins table
              │  drafts autosave to Supabase (no build per keystroke)
              ▼
         "Publish" ──► /api/admin/publish  (Vercel Function)
                            │  verifies the Supabase session belongs to an admin
                            │  re-runs the validator (errors are rejected)
                            │  commits src/plans/<slug>.yaml via the GitHub API
                            │  (fine-grained token: contents:write on this repo only,
                            │   stored as a Vercel env var)
                            ▼
                     push to main ──► Vercel build (~1 min) ──► live
```

Why this works well on Vercel:

- **Preview deployments:** every branch or PR gets its own URL, which is useful while v2 is
  built alongside the live site.
- **Rollback:** "Publishing history" in the admin lists git commits, and reverting one is a new
  commit. Vercel's instant rollback is also there as a safety net.
- **No moving parts for readers:** if Supabase is down or paused, plans still load. Only check-offs
  and sign-in are affected.

> Hosting note: Vercel's free Hobby plan is described as for personal, non-commercial use. A church
> reading site is probably fine, but it's worth reading their fair-use terms once. Pro is the paid fallback.

### Derive "current plan" from dates

Today someone has to flip `current: true/false` and rebuild when one plan ends and the next starts. In v2 the
client picks the church plan whose date range contains today, so changeovers need no edits.
`current` stays as an optional manual override.

## Project layout (proposed)

```
src/
  lib/
    scripture/        canon.ts (books, chapter + verse counts, aliases, OSIS ids)
                      parse.ts, validate.ts, links.ts   ← shared by build, admin and tests
    plans/            load.ts (reads src/plans/*.yaml at build time), dates.ts
    stores/           progress, preferences, auth (Supabase)
    components/       TodayCard, WeekStrip, DayRow, Heatmap, UpdateToast, InstallPrompt, …
  routes/
    +page.svelte                  Today
    plan/+page.svelte             Week / Month / Whole plan
    plan/[id]/+page.svelte        any plan (archived, self-paced)
    progress/+page.svelte
    settings/+page.svelte
    admin/…                       plans list, editor, import, history (ssr = false)
    api/current.json/+server.ts   ┐
    api/plans.json/+server.ts     │ v1 endpoints: same URLs, same shape
    api/plan/[id].json/+server.ts ┘
    api/v2/…/+server.ts           v2 endpoints
    subsplash/[id].xml/+server.ts Subsplash feed, same URL
    cal/[id].ics/+server.ts       calendar subscription
    api/admin/publish/+server.ts  the only non-prerendered route
  plans/*.yaml        plan data (moved from src/plan/*.md)
scripts/check-plans.ts            `npm run check:plans`, also run in the Vercel build
```

## PWA: install and updates

Use `@vite-pwa/sveltekit` (Workbox under the hood).

- **Installable:** web manifest with the existing icons in `src/assets/images`. A small "Install"
  prompt appears on Today after a reader's second visit (`beforeinstallprompt` on Android/desktop).
  On iOS, which has no prompt event, a one-time "Add to Home Screen" hint is shown instead.
- **Knows about updates:** `registerType: 'prompt'`. When a new deploy has a new service worker, the
  app shows a toast: *"A new version is available · Reload"*. The app also calls
  `registration.update()` on launch and whenever it comes back to the foreground, because installed
  PWAs can stay open for days.
- **Plan data stays fresh without a reload:** the app shell is precached. The plan JSON uses
  stale-while-revalidate, so plans open instantly offline and the next screen shows the latest
  publish. When a plan the reader is viewing changes, the page refreshes its data in place.
- **Offline check-offs:** marking a day read offline is queued locally and synced to Supabase when
  the device is back online.

## Data model

Plans move from Markdown front matter to pure data files, `src/plans/<slug>.yaml`. The `day`
string format stays the same so spreadsheet exports keep working:

```yaml
title: 2027 Bible Reading Plan
description: Reading the Bible together as a church.
start: 2027-01-04          # ISO date (v1 used MM-DD-YYYY, which parses inconsistently)
mode: church               # church = fixed dates · self-paced = reader picks start date
intentional_repeats:       # silences "repeat" warnings the pastor has accepted
  - Proverbs
plan:
  - day: Genesis 1, Genesis 2
  - day: Genesis 3, Genesis 4, Psalm 1
    alt: Psalm 2
  - day: Lord's Day
```

The input is forgiving (`Gen 1-2`, `Ps 23`, `Song of Songs 1`, `;` or `,` separators). The
admin normalizes it to the canonical form on save, so the files stay clean.

### URLs that must not change

| URL | Used by | v2 |
|---|---|---|
| `/subsplash/<slug>.xml` | Church app (Subsplash) | Same output; checked against today's files by a test (below) |
| `/api/current.json` | Current site | Same shape, kept |
| `/api/plans.json`, `/api/plan/<slug>.json` | Current site, maybe others | Same shape, kept |
| `/plan/<slug>/` | Shared links | Same paths |

**Subsplash safety net:** before removing 11ty, save today's generated XML for every plan into
`tests/fixtures/subsplash/`. A test then compares SvelteKit's output with those files, so the
church app can't break silently. The test pins exactly what the app receives today, whitespace included.

### Static API v2

- `/api/v2/plans.json`: index only (id, title, start, end, mode, days): small and fast
- `/api/v2/plans/<id>.json`: full plan with structured references:

```json
{ "id": "2026-bible-reading-plan", "start": "2026-01-01", "end": "2027-01-03",
  "days": [ { "n": 327, "date": "2026-11-23", "type": "reading",
              "refs": [ { "book": "JDG", "name": "Judges", "chapter": 17 },
                        { "book": "JDG", "name": "Judges", "chapter": 18 } ],
              "label": "Judges 17, Judges 18" },
            { "n": 326, "date": "2026-11-22", "type": "lords-day", "label": "Lord's Day" } ] }
```

The client builds links from `refs` and the reader's preferences (translation, YouVersion /
ESV.org / Bible Gateway / Logos), rather than receiving prebuilt HTML anchors with a hard-coded
translation id.

- `/cal/<id>.ics`: an all-day event per reading day, with the passages in the title and a link to
  the day. Calendar apps re-fetch these feeds periodically, so edits show up there without readers doing
  anything. This replaces email reminders.

## Checks (the validator)

| Check | Severity | Notes |
|---|---|---|
| Unknown book | Error | Suggest nearest match ("Revealtion" → Revelation) |
| Chapter doesn't exist | Error | e.g. Jude 2, Psalm 151 |
| Verse range doesn't exist | Error | needs verse-count data |
| Missing chapter number | Error | "Jude" → offer "Jude 1" for one-chapter books |
| Unparseable entry | Error | |
| Same chapter read twice | Warning | Can be marked intentional per plan or per book |
| Chapter skipped inside a book's run | Warning | e.g. 43, 45, 46, 48, 48: likely typos |
| Coverage summary | Info | "Covers 1,187 of 1,189 chapters; missing …" |
| "Lord's Day" not on a Sunday / Sunday with readings | Warning | Rows shift when one is inserted or deleted |
| Overlap with another church plan | Warning | |
| Gap with no church plan | Warning | Shown as a banner on the admin home |
| Empty rows, stray whitespace, non-canonical names | Auto-fix | |

Errors block Publish. Warnings don't. The same validator runs in the Vercel build, so a bad hand
edit to YAML fails the deploy and the live site stays on the last good version.

`npm run check:plans` shows a one-line summary per plan (`-- -v` for detail). Past and self-paced
plans are never blocked.

## Reader experience (see mockups)

- **Today**: one big card with today's passages, a single "Mark as read" button, this week's
  dots, a catch-up prompt for missed days, a streak, and a "N at Redeemer read today" count
  (aggregate only, no names).
- **Plan**: Week / Month / Whole plan views, search ("when do we read Ruth?"), rest days
  styled as rest, "Subscribe in your calendar".
- **Progress**: percent of the plan to date, current and best streak, a year heat map, per-book progress.
- **Plans & settings**: the church plan plus optional **personal self-paced plans** (e.g. Praying
  the Psalms from any start date); translation; which app opens passages; theme; calendar subscription;
  install the app.
- Works signed out: progress is kept on the device and merged into the account when the reader signs in.

### Supabase changes

Today's `haveread(plan_day text)` stores a date string. v2:

- `reading_log(user_id, plan_id, day_n, read_at)`: survives plan edits that don't move days;
  migrate existing rows by matching dates to the live plan
- `user_plans(user_id, plan_id, start_date)`: personal plans
- `notes(user_id, plan_id, day_n, body)`: private notes
- `admins(user_id)` and `plan_drafts(id, plan_id, yaml, updated_by, updated_at)`
- RPC `readers_today(plan_id)` returns a count only
- Row-level security on every table (confirm it's on for `haveread` today, since the anon key is
  public by design).

## Admin experience (see mockups)

- **Plans list**: status (Live / Scheduled / Draft / Archived / Self-paced), date range, check
  results, and a "nothing scheduled after …" banner.
- **Editor**: a spreadsheet-like grid with dates and weekdays calculated from the start date,
  problems highlighted in the cell, and a Checks panel with one-click fixes. Bulk tools:
  fill every Sunday with "Lord's Day", insert or delete a row (dates shift), CSV download.
- **Paste from spreadsheet**: paste or upload CSV/XLSX, map columns automatically, and see a preview of
  what will be saved, with abbreviations expanded and problems flagged, then save as a draft.
- **Preview as reader** renders the draft client-side with the real reader components before
  publishing. **Publishing history** shows each commit with who made it and a one-click revert.
- Later: an engagement view with aggregate readers per day.

## Phases

Plan *content* belongs to the pastor: these phases change tooling, never the plans themselves.

0. **Quick wins on the current site** ✅
   - Plan checks run in the build. Only errors in a live or upcoming plan stop a deploy; anything
     else is a one-line note.
   - The This Week view now works across New Year, and "Song of Songs"/"Psalms" get links.
   - Snapshot of the Subsplash XML, v1 JSON and calendar feed, plus `vercel.json`.
1. **SvelteKit foundation** ✅ (`app/`)
   - SvelteKit 3 / Svelte 5 on Vercel, fully prerendered.
   - Shared canon, dates and checks in `app/src/lib/shared/` (the old site uses the same files).
   - v1 outputs byte-identical to the 11ty site (`npm run test:compat`), plus the v2 JSON API and per-plan calendars.
   - PWA: installable, works offline, and prompts to reload when a new version is deployed
     (verified in a browser for first-time and returning visitors).
   - First screens: Today, the plan list, and a full plan page.
2. **Admin** (next; needed before the pastor writes next year's plan)
   - Supabase sign-in plus an admins table, and drafts.
   - The editor with checks, and paste from spreadsheet.
   - The publish endpoint (a Vercel Function that commits to GitHub), and history.
3. **Reader redesign**
   - Plan week/month views, progress, settings, mark as read.
   - `reading_log` migration and signed-out mode.
   - Switch production to the new app, with redirects for `/current/`, `/thisweek/` and `/login/`.
4. **Extras**: personal plans, notes, the church count.

## Still open

1. Who besides the pastor should be an admin?
2. Is the `/api/*.json` used by anything outside this site (another app or integration)? If not, the v1
   endpoints can be retired later, once Subsplash is the only external consumer.
