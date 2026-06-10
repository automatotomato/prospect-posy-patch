import { FollowUpSequencePanel } from "@/components/sales/FollowUpSequencePanel";
import { useSales } from "./_shared";

export default function Followups() {
  const { leads, activities, setOpenLead } = useSales();
  return <FollowUpSequencePanel leads={leads} activities={activities} onOpenLead={setOpenLead} />;
}
