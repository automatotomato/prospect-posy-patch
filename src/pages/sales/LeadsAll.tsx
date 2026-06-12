import { useSales, LeadTable, IndustryFilter } from "./_shared";

export default function LeadsAll() {
  const { filteredLeads, loading, setOpenLead, selected, toggleOne, industries, industryFilter, setIndustryFilter } = useSales();
  return (
    <div className="space-y-4">
      <IndustryFilter
        value={industryFilter}
        onChange={setIndustryFilter}
        industries={industries}
        count={filteredLeads.length}
      />
      <LeadTable leads={filteredLeads} loading={loading} emptyText="No leads match the current filters." onOpen={setOpenLead} showColumn="updated" selected={selected} onToggle={toggleOne} />
    </div>
  );
}
