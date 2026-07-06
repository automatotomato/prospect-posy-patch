import { useMemo } from "react";
import { useSales, LeadTable, IndustryFilter, StatusFilter, OriginTypeFilter, effectiveOrigin, effectiveLeadType } from "./_shared";

export default function LeadsQueue() {
  const {
    leads, queuedLeads, loading, setOpenLead, selected, toggleOne,
    industries, industryFilter, setIndustryFilter,
    statusFilter, setStatusFilter,
    originFilter, setOriginFilter, typeFilter, setTypeFilter,
  } = useSales();

  const queuedInIndustry = useMemo(
    () => leads.filter((l) => l.stage === "queued" && (industryFilter === "all" || (l.industry || "") === industryFilter)),
    [leads, industryFilter],
  );
  const originTypeCounts = useMemo(() => ({
    origin: {
      all: queuedInIndustry.length,
      mine: queuedInIndustry.filter((l) => effectiveOrigin(l) === "mine").length,
      ai: queuedInIndustry.filter((l) => effectiveOrigin(l) === "ai").length,
    },
    type: {
      all: queuedInIndustry.length,
      direct: queuedInIndustry.filter((l) => effectiveLeadType(l) === "direct").length,
      general: queuedInIndustry.filter((l) => effectiveLeadType(l) === "general").length,
    },
  }), [queuedInIndustry]);

  return (
    <div className="space-y-4">
      <IndustryFilter
        value={industryFilter}
        onChange={setIndustryFilter}
        industries={industries}
        count={queuedLeads.length}
      />
      <OriginTypeFilter
        origin={originFilter} setOrigin={setOriginFilter}
        type={typeFilter} setType={setTypeFilter}
        counts={originTypeCounts}
      />
      <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      <LeadTable leads={queuedLeads} loading={loading} emptyText="Nothing queued for these filters." onOpen={setOpenLead} showColumn="queued" selected={selected} onToggle={toggleOne} />
    </div>
  );
}
