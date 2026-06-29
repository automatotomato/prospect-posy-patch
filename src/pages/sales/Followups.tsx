import { FollowUpSequencePanel } from "@/components/sales/FollowUpSequencePanel";
import { useSales, StatusFilter } from "./_shared";

export default function Followups() {
  const { filteredLeads, activities, setOpenLead, statusFilter, setStatusFilter } = useSales();
  return (
    <div className="space-y-4">
      <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      <FollowUpSequencePanel leads={filteredLeads} activities={activities} onOpenLead={setOpenLead} />
    </div>
  );
}
