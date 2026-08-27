# Fix Google Places 403 PERMISSION_DENIED

## Diagnosis
The scout function fails with `API_KEY... blocked` from `places.googleapis.com` SearchText. The new API key is restricted in Google Cloud Console in a way that blocks Places API (New) server-side calls. No code change is needed — the fix is in the Google Cloud key configuration.

## User steps (Google Cloud Console)
1. APIs & Services → Library → enable **Places API (New)** (legacy "Places API" alone is not sufficient).
2. Credentials → API key → set **API restrictions** to "Don't restrict key" or include Places API (New).
3. Set **Application restrictions** to **None** (backend calls have no HTTP referrer).
4. Confirm a billing account is linked to the project.
5. Wait ~2 minutes for propagation.

## Agent verification (after user confirms)
1. Call the `sales-scout-leads` edge function and confirm it returns `inserted > 0` or at least no Places `warning`.
2. If a 403 persists, surface the exact Google error body from the function response and iterate on the key settings.
3. Confirm newly scouted leads appear in the Leads view with emails and drafted outreach.
