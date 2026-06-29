import { useSales, LeadTable, IndustryFilter, StatusFilter } from "./_shared";

export default function LeadsQueue() {
  const {
    queuedLeads, loading, setOpenLead, selected, toggleOne,
    industries, industryFilter, setIndustryFilter,
    statusFilter, setStatusFilter,
  } = useSales();
  return (
    <div className="space-y-4">
      <IndustryFilter
        value={industryFilter}
        onChange={setIndustryFilter}
        industries={industries}
        count={queuedLeads.length}
      />
      <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      <LeadTable leads={queuedLeads} loading={loading} emptyText="Nothing queued for this industry." onOpen={setOpenLead} showColumn="queued" selected={selected} onToggle={toggleOne} />
    </div>
  );
}
