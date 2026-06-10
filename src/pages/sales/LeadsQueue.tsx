import { useSales, LeadTable } from "./_shared";

export default function LeadsQueue() {
  const { queuedLeads, loading, setOpenLead, selected, toggleOne } = useSales();
  return <LeadTable leads={queuedLeads} loading={loading} emptyText="Nothing queued. Move leads to Queue from the pipeline." onOpen={setOpenLead} showColumn="queued" selected={selected} onToggle={toggleOne} />;
}
