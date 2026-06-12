import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSales, ActivityIconFor, activityLabel, fmtDate } from "./_shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Member = { user_id: string; name: string | null; email: string };

export default function ActivityPage() {
  const { activities, leads, setOpenLead, isAdmin } = useSales();
  const [members, setMembers] = useState<Member[]>([]);
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [range, setRange] = useState<"today" | "7d" | "30d" | "all">("7d");

  useEffect(() => {
    supabase.from("team_members").select("user_id, name, email").not("user_id", "is", null).then(({ data }) => {
      setMembers(((data as any) || []).filter((m: any) => m.user_id));
    });
  }, []);

  const memberMap = useMemo(() => {
    const m: Record<string, string> = {};
    members.forEach((x) => (m[x.user_id] = x.name || x.email));
    return m;
  }, [members]);

  const sinceTs = useMemo(() => {
    const now = Date.now();
    if (range === "today") {
      const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
    }
    if (range === "7d") return now - 7 * 86400_000;
    if (range === "30d") return now - 30 * 86400_000;
    return 0;
  }, [range]);

  const matchesType = (t: string) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "stage") return t.startsWith("stage:");
    if (typeFilter === "email") return t === "email_generated" || t === "email_approved";
    if (typeFilter === "follow_up") return t === "follow_up_scheduled";
    return t === typeFilter;
  };

  const filtered = useMemo(() => activities.filter((a) => {
    if (memberFilter !== "all" && a.owner_id !== memberFilter) return false;
    if (!matchesType(a.type)) return false;
    if (sinceTs && new Date(a.created_at).getTime() < sinceTs) return false;
    return true;
  }), [activities, memberFilter, typeFilter, sinceTs]);

  const summary = useMemo(() => {
    const byMember: Record<string, { stage: number; email: number; followup: number; other: number; total: number }> = {};
    for (const a of filtered) {
      const k = a.owner_id || "—";
      if (!byMember[k]) byMember[k] = { stage: 0, email: 0, followup: 0, other: 0, total: 0 };
      byMember[k].total++;
      if (a.type.startsWith("stage:")) byMember[k].stage++;
      else if (a.type === "email_generated" || a.type === "email_approved") byMember[k].email++;
      else if (a.type === "follow_up_scheduled") byMember[k].followup++;
      else byMember[k].other++;
    }
    return byMember;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {isAdmin && (
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger className="w-[200px] h-9 bg-card border-border text-sm">
              <SelectValue placeholder="Team member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All team members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.name || m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-card border-border text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="stage">Stage changes</SelectItem>
            <SelectItem value="email">Emails</SelectItem>
            <SelectItem value="follow_up">Follow-ups</SelectItem>
            <SelectItem value="discovered">Discovered</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => setRange(v as any)}>
          <SelectTrigger className="w-[140px] h-9 bg-card border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} events</span>
      </div>

      {isAdmin && Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(summary).map(([uid, s]) => (
            <div key={uid} className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs font-semibold truncate">{memberMap[uid] || "Unassigned"}</div>
              <div className="font-display text-xl font-bold tabular-nums mt-1">{s.total}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {s.email} email · {s.stage} stage · {s.followup} f/u
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">No activity for this filter.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((a) => {
              const lead = leads.find((l) => l.id === a.lead_id);
              const who = a.owner_id ? memberMap[a.owner_id] : null;
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
                  {who && <Badge variant="secondary" className="hidden sm:inline-flex text-[10px]">{who}</Badge>}
                  <span className="text-xs text-muted-foreground shrink-0">{fmtDate(a.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
