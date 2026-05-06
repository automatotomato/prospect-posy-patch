---
name: Painpoint Follow-Up Framework
description: Per-step painpoint angle assignment for the 6-step follow-up sequence + ban list and owner-language rules
type: feature
---
Follow-up emails (process-follow-ups, generate-follow-up, classify-and-draft-reply) are anchored to a 10-angle painpoint library. Each step in the sequence is locked to a distinct angle so prospects never get the same hook twice.

## Step → Angle Map (no_response trigger)
- #1: angle_1_ad_spend (wasted ad spend, $40-200/missed call)
- #2: angle_3_after_hours (60-70% of calls outside 9-5)
- #3: angle_4_va_cost ($1.5-3k/mo VAs still miss calls)
- #4: angle_5_crew_truck (crew on job + win story)
- #5: angle_7_surge for trades (HVAC/roofing/plumbing/pest/electrical/landscaping), else angle_8_languages
- #6: angle_breakup (friendly, leave the cell, no P.S.)

## Behavioral triggers
- opened_not_clicked → angle_2_next_listing
- not_opened → angle_6_speed_to_lead
- clicked → angle_10_risk_free

## Hard ban list (all 3 functions)
"just following up", "touching base", "circling back", "hope this finds", "I noticed", "I came across", "synergy", "leverage", "streamline", "optimize", "solution", "quick chat", "5-minute call", em dashes.

## Owner-language requirement
Use: call, job, crew, voicemail, competitor, next on Google, payroll, ad spend, after hours.
Always include a real dollar number or percentage when the angle has one.

## DB
The 9 follow_up_rules rows have `name` + `ai_context` rewritten to anchor each rule to its assigned angle. Rule IDs are stable.

## Backfill
`supabase/functions/backfill-follow-ups` re-enrolls every eligible contacted prospect (no reply, not DNC/unsub, status not in qualified/quoted/closed/responded, no existing pending follow-up) into the next due step, spaced 5 min apart. Triggered via "Resume follow-ups for everyone" button on FollowUpDashboard. Supports `dry_run: true` for preview.
