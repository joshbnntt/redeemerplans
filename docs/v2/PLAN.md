# Redeemer Plans v2: plan

Status: proposal · Mockups: https://claude.ai/artifact/CvyVCA7kfqfKVwGFzmSkbD

## Goals

1. **Keep what works.** Free static hosting, a static JSON API, and plans as plain data
   that can be generated from a spreadsheet.
2. **A non-developer can manage plans.** The pastor creates, edits, checks and publishes plans
   in a browser. Nobody touches git, YAML or a terminal.
3. **Catch mistakes before readers do.** Automated checks for typos, impossible chapters,
   duplicates, gaps and date problems.
4. **A better reading experience.** A clear "Today" screen, progress and streaks, catch-up,
   personal self-paced plans, calendar subscription.

## Recommended architecture: "publish = commit"

The site stays static. What changes is the **path by which plans get edited**: there is no
change to how they are read.

```
 Pastor ──► /admin (static page)
              │  sign in: Supabase magic link (already used for readers) + admins table
              │  drafts autosave to Supabase (no build per keystroke)
              ▼
         "Publish" ──► Supabase Edge Function (checks admin, runs validator again)
                            │  commits plans/<slug>.yaml via GitHub API (fine-grained token,
                            │  contents:write on this repo only)
                            ▼
                     GitHub ──► Netlify auto-build (~1 min) ──► static JSON / HTML / ICS
```

Why this over moving plans into a live database:

| | Publish = commit (recommended) | Plans live in Supabase |
|---|---|---|
| Reader stability | Unchanged: static files on a CDN | Site depends on DB uptime and the free-tier pause policy |
| Cost | Free | Free until limits |
| Edit to live | ~1 min, automatic | Instant |
| History / undo | Every publish is a git commit | Needs building |
| Spreadsheet → data | Same YAML as today | Needs an export path for backups |

There is still a build, but nobody has to run it: the pastor clicks Publish and the site
updates about a minute later. If changes **must** be instant, the fallback is a hybrid where
Supabase is the source of truth and a build hook exports JSON. That has more moving parts, so I'd only do it if the
one-minute delay is a real problem.

**Why not the existing `/admin`?** It loads `netlify-cms@^2`, the old name of Decap CMS, which
is no longer updated, and it depends on Netlify Identity and Git Gateway, which Netlify has
deprecated. A generic CMS also can't do the plan-specific checks, the paste-from-spreadsheet
step, or the "did you mean…?" fixes. As a **stopgap**, swapping it for Sveltia CMS
(which is Decap-config compatible and uses a GitHub login) would keep basic editing working
while v2 is built.

### Derive "current plan" from dates

Today a person has to flip `current: true/false` and rebuild when a plan changes over. In v2 the
client picks the plan whose date range contains today, so plan changeovers need no edits.
`current` stays as an optional manual override.

## Data model

Plans move from Markdown front matter to pure data files, `src/plans/<slug>.yaml`. The
`day` string format stays the same so spreadsheet exports keep working:

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

A shared `scripture` module (one JS file, used by **both** the build and the admin page in
the browser) owns:

- the canon: 66 books, chapter counts, verse counts per chapter, aliases/abbreviations, OSIS ids
- `parse("Gen 1-2; Ps 23:1-6")` → structured references
- `validate(plan, otherPlans)` → issues with severity, location and a suggested fix
- link builders: YouVersion, ESV.org, Bible Gateway, Logos

### Static API v2 (v1 stays as it is)

`/api/v1/...` and the existing `current.json`, `plans.json`, `plan/<slug>.json` and Subsplash
XML keep working unchanged for existing consumers. New:

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

The client builds links from `refs` and the reader's preferences, rather than receiving
prebuilt HTML anchors with a hard-coded translation id.

- `/cal/<id>.ics`: calendar subscription per plan (`ical-generator` is already a dependency)

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

Errors block Publish. Warnings don't. The same validator runs in the Netlify build
(`npm run check`), so a bad hand edit to YAML fails the deploy instead of shipping.

### What it finds in the current repo today

I ran a prototype of these checks over `src/plan/*.md`:

- **2024 July – January 2025**
  - Day 34: `Revealtion 7` is a typo. `generateBibleLinks` silently drops unknown books, so readers got no link.
  - Day 50: `Jude` has no chapter number.
  - Jeremiah 44 and 47 are never read, and Jeremiah 48 is read on both days 51 and 52.
  - Zephaniah 1–3 is repeated (days 67–69 and 162–164).
- **2025 July – December**
  - `Song of Songs 1–8` (days 120–125) isn't recognized by the link generator (it expects
    "Song of Solomon"), so those days had no links.
  - It ends Jan 3, 2026, overlapping the 2026 plan by 3 days.
- **2026 plan (live)**
  - It has 368 entries, so it runs until **Jan 3, 2027**.
  - It repeats John 6, Romans 14, Hebrews 7 and Hebrews 9. These may be intentional.
- **Naming**: `bible.yml` says "Psalms" but plans say "Psalm". That's fine, but the canon
  should treat them as aliases.
- **Lord's Days**: every one falls on a Sunday in every dated plan.

## Reader experience (see mockups)

- **Today**: one big card with today's passages, a single "Mark as read" button, this week's
  dots, a catch-up prompt for missed days, a streak, and a "N at Redeemer read today" count
  (aggregate only, no names).
- **Plan**: Week / Month / Whole plan views, search ("when do we read Ruth?"), rest days
  styled as rest, "Subscribe in your calendar".
- **Progress**: percent of the plan to date, current and best streak, a year heat map, per-book progress.
- **Plans & settings**: the church plan plus optional **personal self-paced plans** (e.g. Praying
  the Psalms from any start date); translation; which app opens passages; theme; reminders.
- Works signed out: progress is kept on the device and merged into the account when the reader signs in.
- PWA/offline stays.

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
- **Preview as reader** before publishing. **Publishing history** shows each commit with who made it and a one-click revert.
- Later: an engagement view with aggregate readers per day.

## Phases

0. **Quick wins (this week)**: fix the data errors above; add `npm run check` to the build;
   add aliases for Song of Songs and Psalm/Psalms; parse dates as ISO/UTC.
1. **Data and API**: the `scripture` module, the YAML plan files, API v2 plus v1 compatibility, ICS feeds,
   and the current plan derived from dates.
2. **Admin**: auth and admins table, drafts, editor, checks, import, the publish function, and history.
3. **Reader redesign**: Today, Plan, Progress and Settings, `reading_log` migration, signed-out mode.
4. **Extras**: personal plans, notes, the church count, optional email reminders.

## Open questions

1. Hosting is Netlify, right? (The admin config points at Git Gateway.) Is the publish function OK
   to run on Supabase Edge Functions, or would you prefer Netlify Functions?
2. Is the ~1 minute between Publish and live acceptable, or is "instant" a hard requirement?
3. Is the Subsplash XML feed still used by the church app? If so, that is a reason to keep it byte-for-byte.
4. Who besides the pastor should be an admin?
5. Frontend stack: stay on 11ty + Alpine (smallest change), or move the reader app to
   something component-based (e.g. Svelte/Preact islands) given the richer UI?
6. Are email reminders wanted, or is a calendar subscription enough?
