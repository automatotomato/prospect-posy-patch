## Goal

Wipe the existing sales pipeline, then run an OpenAI-powered agent that scouts real SMB leads across **Nevada, California, and Texas** — broadened to any SMB with spreadsheet/reporting pain — and drafts a personalized email for each one. Every lead must have a verified email address; no email = not saved. Resend is **not** wired up yet; emails stay as drafts.

## 1. Clean slate

- Delete every row in `sales_leads`. Pipeline starts empty.

## 2. New scouting agent (edge function `sales-scout-leads`)

Replaces `sales-discover-leads`. Per run it produces up to **50** new leads with a valid email.

Flow per run:

```text
  ┌─ pick state (NV / CA / TX, round-robin per run)
  │
  ├─ Google Places: SMBs in major metros (Vegas/Reno, LA/SF/SD/Sac, Houston/Dallas/Austin/SA)
  │  broad query set: "small business", "professional services", "operations",
  │  "logistics", "wholesale", "field services", "agency", "manufacturing"...
  │
  ├─ for each candidate:
  │    1. dedupe by domain + business_name (owner-scoped)
  │    2. OpenAI web-search tool finds a real contact email on the company
  │       site / public sources (decision-maker > generic). Drop if none.
  │    3. OpenAI summarizes what the business does + a spreadsheet/reporting
  │       pain hypothesis (1–2 sentences, used to personalize email).
  │    4. OpenAI drafts personalized email (subject + body, <120 words,
  │       warm, references the business, soft CTA).
  │    5. insert into sales_leads with status='drafted', source='ai_scout'
  │
  └─ stop when 50 inserted OR candidate pool exhausted; log run
```

Guarantees:
- Lead is only saved if a valid-format, non-disposable email was found.
- Hard exclusion list (healthcare/insurance/etc.) still enforced.
- State rotation tracked in `agent_settings` so consecutive runs hit different states.

## 3. UI changes on `/sales`

- Dashboard "Discover" panel becomes **"Scout 50 leads"** — single button, no vertical/city inputs (agent picks). Shows last run state + count.
- Lead row still shows the AI-drafted subject/body with **Regenerate**, **Copy**, **Mark sent**. No send button.
- Manual run only — no cron yet (per your choice).

## 4. Data

`sales_leads` keeps its current shape. New `source` value: `ai_scout`. Add a small `agent_settings` row `scout_state_cursor` to remember which state was last used.

## 5. Secrets / services

- Uses existing `OPENAI_API_KEY` and `GOOGLE_PLACES_API_KEY`. No new secrets.
- Resend stays disconnected — explicitly out of scope.

## 6. Out of scope

- Sending email (no Resend wiring).
- Automated daily cron (manual button only for now; easy to add later).
- Touching the Automate Planet CRM / drip system.

## Technical notes

- New edge function: `supabase/functions/sales-scout-leads/index.ts` (Deno, verify_jwt default, CORS).
- Uses OpenAI `gpt-4o-mini` with the `web_search` tool for email discovery + summary; same model for email drafting.
- Deletes `sales-discover-leads` references from the dashboard (function file can stay for now or be removed).
- Frontend: update `src/pages/sales/Dashboard.tsx` discover panel + hook call in `src/hooks/useSalesLeads.ts`.
- Migration: `DELETE FROM sales_leads;` + upsert `agent_settings` row for state cursor.
