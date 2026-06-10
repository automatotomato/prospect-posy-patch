import { useSales, ActivityIconFor, activityLabel, fmtDate } from "./_shared";

export default function ActivityPage() {
  const { activities, leads, setOpenLead } = useSales();
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {activities.map((a) => {
            const lead = leads.find((l) => l.id === a.lead_id);
            return (
              <li
                key={a.id}
                className="px-5 py-3 flex items-center gap-3 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => lead && setOpenLead(lead)}
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <ActivityIconFor type={a.type} />
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <span className="font-medium">{lead?.business_name || "(deleted lead)"}</span>
                  <span className="text-muted-foreground"> — {activityLabel(a)}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(a.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
