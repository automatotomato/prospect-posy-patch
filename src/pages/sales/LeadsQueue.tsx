import { useMemo } from "react";
import { useSales, LeadTable, IndustryFilter, StatusFilter, OriginTypeFilter, effectiveOrigin, effectiveLeadType } from "./_shared";

export default function LeadsQueue() {
  const {
    leads, loading, setOpenLead, selected, toggleOne,
    industries, industryFilter, setIndustryFilter,
    statusFilter, setStatusFilter,
    originFilter, setOriginFilter, typeFilter, setTypeFilter,
    search,
  } = useSales();

  // Everything on this page is scoped to stage='queued'. Apply all filters
  // (industry, origin, type, status, search) locally so counts and rows agree.
  const q = search.trim().toLowerCase();
  const queuedBase = useMemo(() => leads.filter((l) => l.stage === "queued"), [leads]);

  const filtered = useMemo(() => queuedBase.filter((l) => {
    if (industryFilter !== "all" && (l.industry || "") !== industryFilter) return false;
    if (originFilter !== "all" && effectiveOrigin(l) !== originFilter) return false;
    if (typeFilter !== "all" && effectiveLeadType(l) !== typeFilter) return false;
    if (q && !(
      l.business_name.toLowerCase().includes(q) ||
      (l.city || "").toLowerCase().includes(q) ||
      (l.industry || "").toLowerCase().includes(q) ||
      (l.email || "").toLowerCase().includes(q)
    )) return false;
    return true;
  }), [queuedBase, industryFilter, originFilter, typeFilter, q]);

  const originTypeCounts = useMemo(() => {
    const industryScoped = queuedBase.filter((l) => industryFilter === "all" || (l.industry || "") === industryFilter);
    return {
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
    };
  }, [queuedBase, industryFilter]);

  return (
    <div className="space-y-4">
      <IndustryFilter
        value={industryFilter}
        onChange={setIndustryFilter}
        industries={industries}
        count={filtered.length}
      />
      <OriginTypeFilter
        origin={originFilter} setOrigin={setOriginFilter}
        type={typeFilter} setType={setTypeFilter}
        counts={originTypeCounts}
      />
      <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      <LeadTable leads={filtered} loading={loading} emptyText="Nothing queued for these filters." onOpen={setOpenLead} showColumn="queued" selected={selected} onToggle={toggleOne} />
    </div>
  );
}
