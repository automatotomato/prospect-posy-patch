## Goal

A clean, separate dashboard at `/sales` for outbound sales: log in, discover new business leads in target verticals, and generate a short personalized outreach email for each one. No email is actually sent — drafts only, copy-to-clipboard.

## 1. Auth — password login for management@z-cconsultants.com

- Enable email+password sign-in on the backend (the existing 8-digit OTP flow stays for other users).
- Create a new `/sales/login` page with email + password fields (separate from the existing OTP login so we don't disturb the current CRM users).
- Seed the user:
  - Add `management@z-cconsultants.com` to `allowed_users` as `admin` so the existing `handle_new_user` trigger provisions their role and team membership automatically.
  - Create the auth user with a password via a one-time admin migration/insert. You'll be prompted to enter the password securely — it is never stored in code or chat.
- After login, redirect to `/sales`.

## 2. Sales dashboard `/sales`

Single-page layout:

```text
┌──────────────────────────────────────────────────┐
│  Outbound Sales                    [user] [out] │
├──────────────────────────────────────────────────┤
│  [Discover new leads]   vertical: [dropdown]    │
│  city: [input]   count: [10 ▼]                  │
├──────────────────────────────────────────────────┤
│  Leads (table)                                   │
│   Name · Industry · City · Email · Status · ▸   │
│   ─────────────────────────────────────────────  │
│   row → expands to show generated email draft    │
│         [Regenerate] [Copy email] [Mark sent]    │
└──────────────────────────────────────────────────┘
```

- **Discover**: calls a new edge function `sales-discover-leads` that uses Google Places + Perplexity to find businesses in the chosen vertical/city and stores them in a new `sales_leads` table. Default verticals: manufacturing, warehousing, logistics, transportation, inventory management, distribution, 3PL, freight, wholesale, field services — anything spreadsheet-heavy. **Hard exclusion list**: healthcare, hospitals, clinics, dental, medical, pharma, health insurance, any insurance (life/auto/home/P&C).
- **Generate email**: edge function `sales-generate-email` uses Lovable AI Gateway to draft a short (≤90 words) personalized outreach email focused on building a connection, not pitching. Tone: warm, curious, references something specific about the business. Ends with a light question, no hard CTA. No sending — just stores the draft on the lead row.
- **Mark sent**: manual status toggle (since email isn't wired).

## 3. Data

New table `sales_leads` (separate from the existing `prospects` table so the two systems don't collide):

- business_name, website, email, phone, city, state, industry, source
- notes (what the discovery agent learned)
- email_subject, email_body, email_generated_at
- status: `new` | `drafted` | `sent` | `skipped`
- owner_id (auth user)
- created_at, updated_at

RLS: only the owner (or admin) can read/write their own leads.

## 4. Exclusions / safety

- Discovery prompt and a post-filter both reject any lead whose industry/name matches the healthcare or insurance blocklist.
- Existing DNC table is respected if an email matches.

## 5. Out of scope (per your request)

- Actually sending email (no Resend wiring on this dashboard).
- Touching the existing Automate Planet CRM, queues, drip system, or analytics.
- The earlier secret/connector linking tasks — those remain pending and can be done separately when you're ready.

## Technical notes

- Routes: `/sales/login`, `/sales` (protected).
- New files: `src/pages/sales/Login.tsx`, `src/pages/sales/Dashboard.tsx`, `src/hooks/useSalesLeads.ts`, edge functions `sales-discover-leads`, `sales-generate-email`.
- Reuses existing `GOOGLE_PLACES_API_KEY`, `LOVABLE_API_KEY`. No new secrets required for this step.
- Password auth enabled via `configure_auth`; OTP flow untouched.
- You'll be asked to enter the initial password through Lovable's secure secret input so it never appears in chat or code.