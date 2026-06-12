## Goal

Give admins fine-grained control over what each team member can do, the ability to assign specific leads to specific members, and an approval flow so reps can draft emails for admin sign-off before they go out.

---

## 1. Permissions checklist (per team member)

Stored on `allowed_users.permissions` (jsonb). Admins implicitly have everything. Keys:

- `view_leads` — see leads assigned to them
- `edit_leads` — edit lead details / stage / notes
- `draft_emails` — generate / save email drafts
- `send_emails` — send without admin approval (otherwise drafts go to approval queue)
- `send_sms` — text leads
- `log_calls` — record call activity
- `manage_campaigns` — create / edit campaigns
- `import_contacts` — upload contacts CSV
- `delete_leads` — remove leads

**Settings → Team** gets a "Permissions" button next to each member that opens a dialog with the checklist. Saving writes to `allowed_users.permissions` for that member. Sales-rep visibility stays strict (current behavior): they only see leads where `assigned_to = auth.uid()`.

---

## 2. Lead assignment

- New `sales_leads.assigned_to` (uuid → auth.users). Defaults to `NULL`.
- Bulk bar gains an **Assign to…** dropdown listing active team members.
- Lead drawer gets an **Assignee** select.
- RLS expanded: a rep can view/update a lead if `owner_id = auth.uid()` **or** `assigned_to = auth.uid()` **or** admin. Delete still requires `delete_leads` permission (enforced client-side; admins always allowed by RLS).

Admins continue to see everything.

---

## 3. Email approval queue

New table `email_approvals`:

```
id, lead_id, requested_by, subject, body,
status ('pending'|'approved'|'rejected'|'sent'),
reviewed_by, reviewed_at, decision_note, created_at
```

Flow when a rep clicks **Send email** on a lead:
- If they have `send_emails` → sends now (existing path).
- Otherwise → inserts an `email_approvals` row (`pending`) and shows "Sent for admin approval".

New **Approvals** sidebar item (admin only) → `/sales/approvals` page listing pending requests with:
- Lead context (business, industry, city)
- Editable subject / body
- **Approve & send**, **Reject** (with optional reason)

Approve updates row to `sent`, logs `sales_activities` "email_sent_approved", marks lead stage `contacted`. Reject sets `rejected` and notifies requester via in-app toast on next load (read on render).

---

## 4. Files touched

**New**
- `supabase/migrations/<ts>_permissions_and_approvals.sql` — `permissions` column, `assigned_to` column, RLS update, `email_approvals` table + policies + grants.
- `src/hooks/usePermissions.ts` — fetch `allowed_users` row for current user, return `can(key)` helper; admins → all true.
- `src/pages/sales/Approvals.tsx` — admin queue UI.
- `src/components/sales/PermissionsDialog.tsx` — checkbox editor used in Settings.
- `src/components/sales/AssigneeSelect.tsx` — reusable dropdown of team members.

**Edited**
- `src/pages/sales/Settings.tsx` — add per-member Permissions button + dialog.
- `src/pages/sales/SalesLayout.tsx` — add `assigned_to` to context, expose `assignLeads`, `permissions` (`can`) via `useSales()`; add Approvals nav for admins; gate Scout / Send buttons.
- `src/pages/sales/_shared.tsx` — extend `SalesCtx`, add assignee column + Assign action in `BulkBar`, gate Delete/Edit/Send.
- `src/hooks/useSalesLeads.ts` — include `assigned_to` in `Lead` type.
- `src/components/sales/CampaignsPanel.tsx` & `ClientsPanel.tsx` — gate create/import/delete on permissions.
- `src/App.tsx` — register `/sales/approvals` route.

---

## Technical notes

- Admins are detected via existing `useCurrentRole().isAdmin` (already used in Settings).
- Permissions are enforced both in the UI (hide/disable controls) **and** at the DB layer through RLS where possible (assignment & admin-only writes on `email_approvals`).
- Backfill: existing leads have `assigned_to = NULL`. Admin can bulk-assign from the leads list. Reps see nothing until an admin assigns them work — matches the requested "Assigned only" visibility.
- No changes to existing Resend/email send paths; the approval queue uses the same `sales-generate-email` and (when approved) the normal send path.
