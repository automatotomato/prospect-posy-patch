import { useMemo } from "react";
import { useSales, LeadTable, IndustryFilter, StatusFilter, OriginTypeFilter, statusMatches, effectiveOrigin, effectiveLeadType } from "./_shared";

export default function LeadsAll() {
  const {
    leads, loading, setOpenLead, selected, toggleOne,
    industries, industryFilter, setIndustryFilter,
    statusFilter, setStatusFilter,
    originFilter, setOriginFilter, typeFilter, setTypeFilter,
    search,
  } = useSales();

  const q = search.trim().toLowerCase();

  const displayedLeads = useMemo(() => leads.filter((l) => {
    if (industryFilter !== "all" && (l.industry || "") !== industryFilter) return false;
    if (!statusMatches(l, statusFilter)) return false;
    if (originFilter !== "all" && effectiveOrigin(l) !== originFilter) return false;
    if (typeFilter !== "all" && effectiveLeadType(l) !== typeFilter) return false;
    if (q && !(
      l.business_name.toLowerCase().includes(q) ||
      (l.city || "").toLowerCase().includes(q) ||
      (l.industry || "").toLowerCase().includes(q) ||
      (l.email || "").toLowerCase().includes(q)
    )) return false;
    return true;
  }), [leads, industryFilter, statusFilter, originFilter, typeFilter, q]);

  // Origin/Type counts reflect every OTHER active filter (industry, status, search)
  // so the pill numbers match what the list actually shows.
  const originTypeCounts = useMemo(() => {
    const matchesOther = (l: typeof leads[number]) => {
      if (industryFilter !== "all" && (l.industry || "") !== industryFilter) return false;
      if (!statusMatches(l, statusFilter)) return false;
      if (q && !(
        l.business_name.toLowerCase().includes(q) ||
        (l.city || "").toLowerCase().includes(q) ||
        (l.industry || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q)
      )) return false;
      return true;
    };
    const scopedForOrigin = leads.filter((l) => matchesOther(l) && (typeFilter === "all" || effectiveLeadType(l) === typeFilter));
    const scopedForType = leads.filter((l) => matchesOther(l) && (originFilter === "all" || effectiveOrigin(l) === originFilter));
    return {
      origin: {
        all: scopedForOrigin.length,
        mine: scopedForOrigin.filter((l) => effectiveOrigin(l) === "mine").length,
        ai: scopedForOrigin.filter((l) => effectiveOrigin(l) === "ai").length,
      },
      type: {
        all: scopedForType.length,
        direct: scopedForType.filter((l) => effectiveLeadType(l) === "direct").length,
        general: scopedForType.filter((l) => effectiveLeadType(l) === "general").length,
      },
    };
  }, [leads, industryFilter, statusFilter, originFilter, typeFilter, q]);

  return (
    <div className="space-y-4">
      <IndustryFilter
        value={industryFilter}
        onChange={setIndustryFilter}
        industries={industries}
        count={displayedLeads.length}
      />
      <OriginTypeFilter
        origin={originFilter} setOrigin={setOriginFilter}
        type={typeFilter} setType={setTypeFilter}
        counts={originTypeCounts}
      />
      {/* StatusFilter derives its own counts from context, respecting all other filters */}
      <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      <LeadTable leads={displayedLeads} loading={loading} emptyText="No leads match the current filters." onOpen={setOpenLead} showColumn="updated" selected={selected} onToggle={toggleOne} />
    </div>
  );
}
