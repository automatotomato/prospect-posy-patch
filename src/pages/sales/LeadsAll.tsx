import { useMemo } from "react";
import { useSales, LeadTable, IndustryFilter, StatusFilter, OriginTypeFilter, statusMatches, originMatches, typeMatches, effectiveOrigin, effectiveLeadType } from "./_shared";

export default function LeadsAll() {
  const {
    leads, filteredLeads, loading, setOpenLead, selected, toggleOne,
    industries, industryFilter, setIndustryFilter,
    statusFilter, setStatusFilter,
    originFilter, setOriginFilter, typeFilter, setTypeFilter,
  } = useSales();

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

  const originTypeCounts = useMemo(() => ({
    origin: {
      all: industryScoped.length,
      mine: industryScoped.filter((l) => effectiveOrigin(l) === "mine").length,
      ai: industryScoped.filter((l) => effectiveOrigin(l) === "ai").length,
    },
    type: {
      all: industryScoped.length,
      direct: industryScoped.filter((l) => effectiveLeadType(l) === "direct").length,
      general: industryScoped.filter((l) => effectiveLeadType(l) === "general").length,
    },
  }), [industryScoped]);

  return (
    <div className="space-y-4">
      <IndustryFilter
        value={industryFilter}
        onChange={setIndustryFilter}
        industries={industries}
        count={filteredLeads.length}
      />
      <OriginTypeFilter
        origin={originFilter} setOrigin={setOriginFilter}
        type={typeFilter} setType={setTypeFilter}
        counts={originTypeCounts}
      />
      <StatusFilter value={statusFilter} onChange={setStatusFilter} counts={counts} />
      <LeadTable leads={filteredLeads} loading={loading} emptyText="No leads match the current filters." onOpen={setOpenLead} showColumn="updated" selected={selected} onToggle={toggleOne} />
    </div>
  );
}
