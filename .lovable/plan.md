# Reduce Cloud + AI Balance Burn

Five changes to stop the project from chewing through credits.

## 1. Slow down cron schedules

Reschedule the two recurring jobs in `cron.job`:
- `process-scheduled-emails`: `*/15 * * * *` → `*/30 * * * *` (every 30 min instead of 15). Most runs do nothing — logs confirm "No pending emails to process".
- `recalculate-lead-scores-every-15min`: `0 * * * *` → `0 6 * * *` (once daily at 6 AM UTC). Lead scores don't need hourly refresh on a 1,764-row table.

## 2. Slow drip interval

Update `agent_settings.drip_settings`:
- `interval_minutes`: 2 → 15
- Keep `enabled: true`, `max_per_hour: 47`

## 3. Aggressive cron exhaust cleanup

Currently `cron._http_response` (85 MB) and `cron.job_run_details` (65 MB) account for ~75% of the database. Cleanup runs only daily.

Add a new hourly cron job `cleanup-cron-exhaust-hourly` (`0 * * * *`):
```sql
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '1 day';
DELETE FROM net._http_response   WHERE created    < now() - interval '6 hours';
```

Run an immediate one-time cleanup as part of this work to reclaim ~150 MB.

## 4. Cap discovery runs per day

Add a hard cap inside `supabase/functions/discover-businesses/index.ts`, just before the `agent_runs` insert:

- Count today's `agent_runs` rows (UTC day).
- If count ≥ 5, return HTTP 429 with `{ error, capped: true, runs_today }` and skip the entire Google Places + Perplexity + OpenAI chain.
- Allow override via `body.force === true` for manual admin triggers.

This caps the worst-case AI cost at 5 discovery runs/day no matter how many times the agent or UI fires it.

## 5. Audit Lovable AI usage

Audit confirms zero remaining `ai.gateway.lovable.dev` calls in `supabase/functions/` and `src/`. The two functions converted earlier (`ingest-email`, `classify-and-draft-reply`) now use OpenAI. The remaining `LOVABLE_API_KEY` references are for the Twilio connector gateway (`send-sms`) and Auth email webhook signing (`auth-email-hook`) — neither hits the AI balance.

Update `mem://index.md` Core to remove the stale "Lovable AI Gateway" line and reflect OpenAI as the sole AI provider.

## Technical Details

**Cron changes** — applied via `cron.unschedule` + `cron.schedule` using the existing service-role auth headers already stored in the jobs.

**Settings update** — single SQL `UPDATE agent_settings SET setting_value = '{...}'::jsonb WHERE setting_key = 'drip_settings'`.

**Discovery cap** — runs before any external API call so capped invocations cost effectively nothing.

**Files modified**
- `supabase/functions/discover-businesses/index.ts` (add cap)
- `mem://index.md` (memory note)
- DB: `cron.job` (3 schedule changes), `agent_settings` (1 row update), one-shot prune of `cron._http_response` + `cron.job_run_details`

## Expected impact

- Cron invocations: ~150/day → ~75/day (50% drop in serverless invocations)
- DB size: ~197 MB → ~50 MB after prune
- Drip throughput: 30/hr → 4/hr (still hits the 47/hr cap when needed)
- Discovery AI cost: bounded to 5 runs/day max
