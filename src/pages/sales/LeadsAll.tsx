import { useSales, LeadTable } from "./_shared";

export default function LeadsAll() {
  const { filteredLeads, loading, setOpenLead, selected, toggleOne } = useSales();
  return <LeadTable leads={filteredLeads} loading={loading} emptyText="No leads yet." onOpen={setOpenLead} showColumn="updated" selected={selected} onToggle={toggleOne} />;
}
