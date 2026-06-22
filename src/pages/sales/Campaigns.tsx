import { CampaignsPanel } from "@/components/sales/CampaignsPanel";
import { AIDraftsPanel } from "@/components/sales/AIDraftsPanel";

export default function Campaigns() {
  return (
    <div className="space-y-6">
      <CampaignsPanel />
      <AIDraftsPanel />
    </div>
  );
}
