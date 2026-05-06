---
name: Access control and team invites
description: DB-driven invite list, role-based access, OTP login flow
type: constraint
---
Access is gated by the `allowed_users` table. Admins invite team members from `/team` (calls `invite-team-member` edge function). Login uses email OTP. The `Auth.tsx` allow-list check queries `allowed_users` (not a hardcoded array). Roles: `admin` (full access) and `sales_rep` (sees only leads where `prospects.assigned_to = current_team_member_id()`). RLS on prospects, call_logs, prospect_tasks, sent_emails, sent_sms, scheduled_emails, scheduled_follow_ups, outreach_queue, reply_intents, conversions, and email_events enforces this. Helper functions: `is_admin`, `current_team_member_id`, `can_access_prospect`. The `handle_new_user` trigger auto-links a new auth user to their `team_members` row and assigns role from `allowed_users`. Seeded admins: alex@automateplanet.com, nick.k.mccarthy@gmail.com.
