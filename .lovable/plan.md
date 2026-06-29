
## Problem

1. **Dashboard ↔ Follow-up tab numbers don't match.** The dashboard "Contacted" KPI only counts leads whose `stage` is exactly `contacted` (2 leads), while the Follow-up tracker counts anything with `contact_count > 0` **OR** stage in `contacted / follow_up / replied` (235 leads). Worse, the tracker's step math is `Math.max(1, contact_count)`, so even leads with **0 touches** get bucketed into "Step 1" — that's why 232/235 sit in Step 1.

2. **No way to filter "new vs already contacted" on the Leads pages.** A lead can show stage `new` in the table even though an email was drafted/sent, which is confusing — and the user is about to upload 2,000 leads and needs to separate fresh ones from ones already worked.

## Fix

### A. Make the dashboard reflect reality

In `src/pages/sales/Dashboard.tsx` and `src/hooks/useSalesLeads.ts`:

- Replace the single-stage "Contacted" KPI with **"Contacted (ever)"** = leads where `contact_count > 0` OR `last_contacted_at IS NOT NULL` OR stage in (`contacted`, `follow_up`, `replied`, `won`, `lost`). This matches the tracker definition.
- Add a derived stat **"Not yet contacted"** = `total - contactedEver`, so the split adds up to total leads at a glance.
- Add a small "Reconciliation" line under the KPI row: `X in sequence · Y awaiting first touch · Z due follow-up`, using the **same** filter the Follow-up tracker uses, so the two pages can never disagree again.
- Compute these in `useSalesLeads` so every page reads from one source of truth.

### B. Fix the Follow-up tracker step math

In `src/components/sales/FollowUpSequencePanel.tsx`:

- Only enroll a lead in the tracker when `contact_count > 0` **or** `last_contacted_at` is set (drop the loose stage check that was pulling in untouched leads).
- Change step calc to `step = Math.min(sequence.length, contact_count)` (no `Math.max(1, …)`), so 0-touch leads aren't shown as Step 1.
- After this, the tracker total should drop from 235 → roughly the count of leads we've actually emailed, matching the dashboard.

### C. Add a Status filter to the Leads pages

In `src/pages/sales/_shared.tsx`:

- Add a new `statusFilter` to `SalesContext`: `"all" | "new" | "contacted" | "in_sequence" | "due" | "replied" | "won"`.
- Add a `StatusFilter` component (matching `IndustryFilter` styling) — a pill/segmented control that shows counts next to each option.
- Apply the filter inside `filteredLeads` / `queuedLeads` so all lead views respect it.

Render the new filter alongside `IndustryFilter` in:
- `src/pages/sales/LeadsAll.tsx`
- `src/pages/sales/LeadsQueue.tsx`
- `src/pages/sales/Pipeline.tsx` (above the kanban)
- `src/pages/sales/Followups.tsx` (passed to the panel)

"New" = `contact_count = 0` AND `last_contacted_at IS NULL` regardless of stage label, so a lead the AI already emailed will no longer show up under "New".

### D. Backfill the stage badge so it doesn't lie

In `src/hooks/useSalesLeads.ts`, when listing leads, derive a `displayStage`:
- If stage is `new` but `contact_count > 0` or `last_contacted_at` set → show as `contacted` in the badge.
- Underlying DB stage is unchanged; this is presentation only so the user isn't misled.

## Out of scope

- No schema changes, no edge function changes.
- No changes to send/drip logic.
- Industry filter behavior unchanged.

## Files touched

- `src/hooks/useSalesLeads.ts` — extra derived stats + displayStage helper
- `src/pages/sales/_shared.tsx` — status filter state, `StatusFilter` component, updated `filteredLeads`, `StageBadge` uses `displayStage`
- `src/pages/sales/Dashboard.tsx` — KPI swap + reconciliation line
- `src/pages/sales/LeadsAll.tsx`, `LeadsQueue.tsx`, `Pipeline.tsx`, `Followups.tsx` — render `StatusFilter`
- `src/components/sales/FollowUpSequencePanel.tsx` — corrected enrollment + step math
