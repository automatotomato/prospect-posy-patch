# Remove Approvals and Wins from Sidebar Menu

## Goal
Hide the **Approvals** and **Wins** navigation items from the sales sidebar menu while leaving the underlying routes and pages intact (they remain reachable by direct URL if needed).

## Changes
1. **Update `src/pages/sales/SalesLayout.tsx`**
   - Remove the conditional `Approvals` sidebar link (lines 252-254).
   - Remove the `Wins` sidebar link (line 255).
   - Clean up unused imports if `ShieldCheck` and `Trophy` are no longer used elsewhere in the file.

## Notes
- The `/sales/approvals` and `/sales/wins` routes in `App.tsx` stay as-is so existing bookmarks/direct links still work.
- The `pendingApprovals` polling logic and context value can remain since it does not affect the UI once the link is removed; it can be removed later if desired.
