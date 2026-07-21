## 1. Force password setup before accessing /sales

**How we'll track "hasn't set a password yet":** stamp new invited users with `user_metadata.must_set_password = true` at invite time, and clear it once they successfully call `updateUser({ password })`. Existing users (who already log in normally today) have no such flag and are unaffected.

### Changes

- **`supabase/functions/invite-team-member/index.ts`**
  - When creating the auth user via `admin.auth.admin.createUser(...)`, add `user_metadata: { full_name: name, must_set_password: true }`.
  - When the user already exists but the admin is re-inviting, call `admin.auth.admin.updateUserById(existing.id, { user_metadata: { ...existing.user_metadata, must_set_password: true } })` so a resent invite re-arms the guard.
  - Redeploy the function.

- **`src/pages/sales/SetPassword.tsx`**
  - In `submit()`, after a successful `supabase.auth.updateUser({ password })`, also call `supabase.auth.updateUser({ data: { must_set_password: false } })` before navigating to `/sales`.

- **`src/components/ProtectedRoute.tsx`** (guard already wraps `/sales/*`)
  - After session load, if `user.user_metadata?.must_set_password === true` AND current path is not `/sales/set-password`, `Navigate` to `/sales/set-password` (replace).
  - Allow `/sales/set-password` and `/sales/login` through unconditionally so the recovery flow still works.

- **`src/pages/sales/Login.tsx`**
  - After a successful `signInWithPassword`, if `must_set_password` is still true (edge case: admin re-armed the flag), route to `/sales/set-password` instead of `/sales`.
  - Add a small "First time here? Use the code from your invite email →" link to `/sales/set-password`.

### Verification
- Invite a fresh test email → confirm the recovery email lands, code works, password form shows, and after submit the user reaches `/sales` with `must_set_password` cleared (check via `supabase.auth.getUser()` in console).
- Sign an existing admin (`alex@automateplanet.com`) in → confirm they go straight to `/sales` (no redirect loop).
- Manually re-arm `must_set_password = true` on a test user via the invite resend → confirm next login bounces them to `/sales/set-password`.

## 2. Restrict team members to only their assigned leads

**Current state (verified):** RLS on `sales_leads` already reads `owner_id = auth.uid() OR assigned_to = auth.uid() OR is_admin(auth.uid())`. That's correct in principle, but two gaps let team members see more than intended:

1. `owner_id` on AI-scouted and uploaded leads is set to the admin who ran the scout/import, so non-admins never own leads — fine. But leads with `assigned_to IS NULL` are invisible to reps (correct) yet the sidebar/queue KPI counts, and some hooks, still count them because those numbers come from admin-context tiles wired into the same views reps see.
2. A few write paths (bulk edit, drip send, follow-up assignment) fall back to `.eq('assigned_to', ...)` filters but don't hard-block reps from selecting leads outside their assignment when the list is unfiltered.

### Changes

- **RLS tightening (`supabase--migration`)**
  - Keep the existing SELECT / UPDATE / DELETE policies as-is (they already scope correctly to owner/assigned/admin).
  - Add a stricter INSERT policy so a non-admin cannot create a lead assigned to someone else: `WITH CHECK (is_admin(auth.uid()) OR (owner_id = auth.uid() AND (assigned_to IS NULL OR assigned_to = auth.uid())))`.
  - Add a trigger `prevent_sales_lead_assignee_change_by_reps` mirroring the existing `prevent_sales_lead_owner_change`: only admins may change `assigned_to`. Reps updating their own leads keep working because the trigger only fires when `assigned_to` actually changes.

- **`src/hooks/useSalesLeads.ts`**
  - No filter change needed for reps — RLS already scopes reads. But add an explicit `assigned_to = current user` fallback filter when `!isAdmin` so counts, `stats.by.*`, and pagination totals reflect only the rep's book (defense in depth + faster queries).

- **`src/pages/sales/SalesLayout.tsx`**
  - Sidebar Queue / All / Follow-ups badges: when `!isAdmin`, compute from the rep-scoped leads only (already the case if the hook change above lands).

- **`src/components/sales/AssigneeSelect.tsx`**
  - Disable the control entirely for non-admins (read-only chip showing the current assignee).

- **`src/pages/sales/_shared.tsx` (BulkBar)**
  - Hide "Reassign" and "Bulk delete" bulk actions for non-admins. Keep "Send", "Mark contacted", "Add follow-up".

- **`src/pages/sales/Dashboard.tsx`**
  - Already branches to `TeamDashboard` for non-admins; confirm `TeamDashboard.tsx` KPIs use the scoped hook so numbers match "my leads only".

### Verification
- Log in as a `sales_rep` test user with 2 assigned leads → All Leads / Queue / Pipeline / Follow-ups all show exactly those 2 (and the sidebar badges match).
- As the rep, try to reassign a lead to another user via the API directly → RLS/trigger rejects.
- As admin, reassignment continues to work.
- Confirm the rep cannot see or open leads that aren't theirs (URL-tampering a `/sales/leads/<id>` link they weren't assigned returns empty).

## Technical notes

- No new tables. One migration (stricter INSERT policy + assignee-change trigger). One edge function redeploy (`invite-team-member`). Three frontend files edited, one auth flag added to metadata.
- `must_set_password` lives in `auth.users.raw_user_meta_data`, which is user-editable — that's acceptable here because the worst case is a malicious user *removing* the flag on themselves to skip the setup screen, at which point they'd still need a valid password to log in (which is exactly what the flag is trying to force). It is not a security boundary, just a UX guard.
