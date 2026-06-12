# Plan

## 1. Admin assigns leads to team members
Lead assignment infrastructure (`sales_leads.assigned_to`, `AssigneeSelect`, bulk assign in `BulkBar`) already exists from a prior turn. This step focuses on making it admin-driven and discoverable:

- **Leads tables (`LeadsAll`, `LeadsContacts`, `LeadsQueue`)**: add an "Assignee" column showing the assigned member's name (or "—"), with an inline `AssigneeSelect` for admins. Sales reps see the name read-only.
- **Bulk bar**: surface the existing bulk-assign action only for admins (gate via `useCurrentRole().isAdmin`).
- **LeadDrawer**: ensure the per-lead `AssigneeSelect` is admin-only editable; reps see the assignee label.
- **Filter**: add an "Assignee" dropdown filter (Anyone / Unassigned / each member) to the leads toolbar so admins can quickly see one rep's book.

## 2. Team activity view
Extend the existing `/sales/activity` page:

- Add a top filter bar: **Team member** select (defaults to "All"), **Type** filter (calls, emails sent, replies, stage changes), and **date range** (Today / 7d / 30d / All).
- Add a small "Team summary" strip above the list: per-member counts for the selected range (calls, emails, stage moves, wins) using `sales_activities` joined with `sales_leads.assigned_to` and the activity's `owner_id`.
- Each row already shows the lead + action; append a small chip with the team member's name (from `team_members` lookup via `owner_id`).
- Admin only. Sales reps continue to see only their own activity (existing RLS).

## 3. Won-lead tracking
Capture which leads were converted via this app:

- New table `sales_wins` (lead_id, owner_id, closed_by, amount numeric, currency, deal_notes, won_at). RLS: admins all; reps can insert/select where `closed_by = auth.uid()` or assignee.
- Trigger: when `sales_leads.stage` moves to `won`, auto-insert a `sales_wins` row (if none exists) with `closed_by = auth.uid()`, `owner_id = assigned_to`.
- LeadDrawer: when stage is set to "Won", open a small "Log win" dialog asking for amount + notes; updates the `sales_wins` row.
- New **Wins** nav item under `/sales/wins`: list of won leads with assignee, amount, date, notes; totals strip (count + $ this month / quarter / all-time); CSV export. Admin-only.
- Dashboard: add a "Wins this month" KPI tile.

## 4. Booking link in all outgoing emails
Add the Outlook Bookings link to every email Z&C sends.

- Add `bookingUrl` to `supabase/functions/_shared/brand.ts` (the long LinkedIn-wrapped URL provided).
- Update `BRAND.cta` and `BRAND.signature` to include "Book a 15-min call: {bookingUrl}".
- In `send-email/index.ts`, when rendering HTML, append a branded "Book a call" button (anchor styled as button) above the unsubscribe footer pointing to `BRAND.bookingUrl`. Plain-text branch (if any) gets the URL inline.
- Update `sales-generate-email` and `generate-email` prompts so the AI is told the CTA is the booking link (not Calendly); leave actual link injection to the send step so the model can't malform it.
- Update approval-queue send path in `Approvals.tsx` so the same link is appended (it already calls `send-email`, so this is automatic once `send-email` is updated).

## Technical notes
- Files to add: `supabase/migrations/<ts>_wins.sql`, `src/pages/sales/Wins.tsx`, `src/components/sales/LogWinDialog.tsx`.
- Files to edit: `src/pages/sales/Activity.tsx`, `LeadsAll.tsx`, `LeadsContacts.tsx`, `LeadsQueue.tsx`, `_shared.tsx` (BulkBar + LeadDrawer), `SalesLayout.tsx` (Wins nav), `Dashboard.tsx`, `App.tsx`, `supabase/functions/_shared/brand.ts`, `send-email/index.ts`, `sales-generate-email/index.ts`, `generate-email/index.ts`.
- No changes to existing RLS on `sales_leads`; assignment already governed.
