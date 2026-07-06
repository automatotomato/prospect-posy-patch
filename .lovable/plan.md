# Leads classification, pipeline clarity, and safe daily volume

## Why

Right now every lead is in one bucket with a stage label. You can't tell at a glance which are your uploaded decision-maker contacts, which came from the AI scout, or which are useful "personal" emails vs generic mailboxes (info@, sales@, hr@…). That makes CPA math and team focus impossible. You also want to keep the automation running but hard-cap it at ~50 emails/day.

## What you'll see in the app

Every lead card and list row will show two chips:

- **Origin** — `Mine` (uploaded contacts) or `AI` (scout-generated)
- **Type** — `Direct` (person@company.com) or `General` (info@, sales@, hello@, contact@, support@, admin@, office@, hr@, marketing@, billing@, careers@, team@, help@)

The Leads Queue, Leads All, Pipeline, and Dashboard get filter dropdowns for both. The dashboard tiles split into:

```text
                Mine        AI
Direct          123         42
General          88         73
```

so you can see exactly which slice is converting and divide spend accordingly.

## Pipeline stages — one clean ladder

Every lead moves through exactly these stages (rename/consolidate anything else):

```text
new  →  queued  →  contacted  →  replied  →  meeting  →  won / lost / unsubscribed
```

- `new`: uploaded / scouted, not yet queued for outreach
- `queued`: draft ready, waiting for send window
- `contacted`: at least one email sent, in the auto follow-up sequence (touches 1–5)
- `replied`: reply intent detected (positive / neutral / negative shown as a sub-badge)
- `meeting`: booking link clicked or manually marked
- `won` / `lost` / `unsubscribed`: terminal

Stage counts on the dashboard and the Kanban header will reflect this exactly, and each count breaks down by Origin × Type in a tooltip.

## AI scout: bias toward Direct leads

The AI scout will:

1. Try to find a decision-maker email first (owner, GM, ops manager, etc.) via the existing discovery flow.
2. Only fall back to a general mailbox if no personal email is discoverable.
3. Tag `lead_type` on insert so the split is accurate from day one.
4. Skip leads that would be duplicates of your uploaded `Mine` contacts (match by email lowercase).

## Daily send cap: 50/day

The hourly follow-up worker will check how many auto-sends have gone out in the last 24h before drafting anything. Once 50 sends is reached, the run returns `skipped_daily_cap` and waits for the next window. This is a hard ceiling across both `Mine` and `AI` leads combined, adjustable from an admin setting later.

## CPA tracking

A tiny `lead_costs` config (single row for now) lets you enter:

- Cost per AI lead (avg)
- Cost per uploaded lead (avg, from your marketing spend)

The dashboard multiplies these against `won` counts per Origin × Type to show a live CPA figure per slice. You can update the numbers as your spend changes.

---

## Technical section

### Database

Migration on `public.sales_leads`:

- Add `lead_type text check (lead_type in ('direct','general'))`
- Add `origin text check (origin in ('mine','ai'))` (derived from existing `source` in a backfill; keep `source` for raw provenance)
- Backfill:
  - `origin = 'mine'` where `source = 'my_contacts'`, else `'ai'`
  - `lead_type = 'general'` where email local-part matches the generic-mailbox list, else `'direct'`
- Add `stage` check constraint enforcing the ladder above; migrate any legacy values (`drafted` → `queued`, unknown → `new`).
- Add index on `(origin, lead_type, stage)` for dashboard queries.

New table `public.lead_costs` (single-row keyed by `id = 'default'`):

- `ai_cost_per_lead numeric`, `mine_cost_per_lead numeric`, `updated_at`
- RLS: admins read/write, everyone else read.

### Follow-up worker (`process-lead-followups`)

- Before drafting: `select count(*) from sales_activities where type='email_sent' and metadata->>'auto'='true' and created_at > now() - interval '24 hours'`.
- If count ≥ 50, return `{ ok:true, skipped:'daily_cap', sent_last_24h: count }`.
- Otherwise cap the batch to `min(BATCH_SIZE, 50 - count)`.

### AI scout (`sales-discover-leads` / `sales-scout-leads`)

- Prompt updates: require decision-maker role, personal email preferred, list generic mailboxes as fallback-only.
- On insert, compute `lead_type` from email prefix and set `origin='ai'`.
- Dedupe against existing `email` (case-insensitive) before insert.

### UI

- `src/hooks/useSalesLeads.ts`: extend query + filter args with `origin`, `lead_type`.
- Shared badge component `<LeadBadges lead />` rendering Origin + Type chips.
- Pages: `LeadsQueue`, `LeadsAll`, `Pipeline`, `Followups`, `Dashboard` get:
  - Two `<Select>` filters (Origin, Type)
  - Badges on every card / row
- `Dashboard`: 2×2 breakdown tile per stage; CPA tile pulling from `lead_costs`.
- `SalesLayout` sidebar: stage counts scoped to current filters.

### Reconciliation

Extend `reconcile-lead-statuses` to also:

- Normalize any legacy `stage` values to the ladder.
- Recompute `lead_type` for rows where it is null (new uploads that predate the migration).

### Docs / plan file

Update `.lovable/plan.md` with the classification model and the 50/day cap so future work stays consistent.

---

# Update: lead classification + daily send cap (shipped)

- Every lead is tagged with `origin` (mine|ai) and `lead_type` (direct|general) at write time.
- Uploaded contacts (ClientsPanel → "Send to pipeline") tag as `origin=mine`, and `lead_type` from the email prefix.
- AI scout (`sales-scout-leads`) prefers personal decision-maker emails, falls back to generic mailboxes only if none discoverable, dedupes against every existing lead email, and inserts with `origin=ai` + `lead_type`.
- Auto follow-up worker (`process-lead-followups`) reads `lead_costs.daily_send_cap` (default 50) and refuses to draft/send once 24h auto-sends hit the cap.
- `lead_costs` table stores AI cost per lead, Mine cost per lead, daily_send_cap. Admins can edit from Dashboard → "Edit costs".
- Dashboard: 2x2 Origin×Type matrix, per-origin CPA tile, and a "Sent last 24h / cap" tile.
- Reconciler backfills `origin`/`lead_type` on any legacy row missing them.
