import { useMemo } from "react";
import { useSales, LeadTable, IndustryFilter, StatusFilter, statusMatches } from "./_shared";

export default function LeadsAll() {
  const {
    leads, filteredLeads, loading, setOpenLead, selected, toggleOne,
    industries, industryFilter, setIndustryFilter,
    statusFilter, setStatusFilter,
  } = useSales();

  // Count per status across industry-scoped leads (so counts react to industry too)
  const industryScoped = useMemo(
    () => leads.filter((l) => industryFilter === "all" || (l.industry || "") === industryFilter),
    [leads, industryFilter],
  );
  const counts = useMemo(() => ({
    all: industryScoped.length,
    new: industryScoped.filter((l) => statusMatches(l, "new")).length,
    contacted: industryScoped.filter((l) => statusMatches(l, "contacted")).length,
    in_sequence: industryScoped.filter((l) => statusMatches(l, "in_sequence")).length,
    due: industryScoped.filter((l) => statusMatches(l, "due")).length,
    replied: industryScoped.filter((l) => statusMatches(l, "replied")).length,
    won: industryScoped.filter((l) => statusMatches(l, "won")).length,
  }), [industryScoped]);

  return (
    <div className="space-y-4">
      <IndustryFilter
        value={industryFilter}
        onChange={setIndustryFilter}
        industries={industries}
        count={filteredLeads.length}
      />
      <StatusFilter value={statusFilter} onChange={setStatusFilter} counts={counts} />
      <LeadTable leads={filteredLeads} loading={loading} emptyText="No leads match the current filters." onOpen={setOpenLead} showColumn="updated" selected={selected} onToggle={toggleOne} />
    </div>
  );
}
