import { useEffect, useMemo, useState } from "react";
import { Camera, Clock, Trophy, CheckCircle2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSales, KpiTile } from "./_shared";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

export default function TeamDashboard() {
  const { leads, dueFollowUps, setScanOpen, setOpenLead } = useSales();
  const { user } = useAuth();
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [myWins, setMyWins] = useState<{ count: number; sum: number }>({ count: 0, sum: 0 });

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("team_members").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setTeamMemberId((data as any)?.id || null));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    supabase.from("sales_wins" as any).select("amount, won_at, owner_id")
      .eq("owner_id", user.id)
      .gte("won_at", monthStart.toISOString())
      .then(({ data }) => {
        const rows = (data as any[]) || [];
        setMyWins({ count: rows.length, sum: rows.reduce((s, r) => s + Number(r.amount || 0), 0) });
      });
  }, [user?.id]);

  // "Mine" = assigned to this team member (preferred) or to this user
  const mine = useMemo(() => {
    return leads.filter((l) => {
      if (!l.assigned_to) return false;
      return l.assigned_to === teamMemberId || l.assigned_to === user?.id;
    });
  }, [leads, teamMemberId, user?.id]);

  const myDue = useMemo(() => {
    const now = Date.now();
    return mine.filter((l) => l.follow_up_at && new Date(l.follow_up_at).getTime() <= now
      && !["replied", "won", "lost"].includes(l.stage));
  }, [mine]);

  const byStage = (s: string) => mine.filter((l) => l.stage === s).length;

  return (
    <>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="My Leads" value={mine.length} delta="Assigned to you" progress={Math.min(100, mine.length * 5)} />
        <KpiTile label="Queued" value={byStage("queued")} delta="Ready to contact" progress={Math.min(100, byStage("queued") * 8)} />
        <KpiTile label="Due Follow-ups" value={myDue.length} delta={myDue.length ? "Action needed" : "All caught up"} deltaTone={myDue.length ? "amber" : "muted"} progress={Math.min(100, myDue.length * 12)} />
        <KpiTile label="Wins this month" value={myWins.count} delta={myWins.sum ? `$${myWins.sum.toLocaleString()}` : "Log a deal"} deltaTone="emerald" highlight progress={Math.min(100, myWins.count * 20)} />
      </section>

      {/* Quick action: scan card */}
      <section className="bg-gradient-to-br from-primary/15 via-card to-card border border-primary/30 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-start md:items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-sm">Scan a business card</h2>
            <p className="text-xs text-muted-foreground">Capture a lead in seconds and route it into your pipeline.</p>
          </div>
        </div>
        <Button onClick={() => setScanOpen(true)} className="gap-2 shrink-0">
          <Camera className="w-4 h-4" />Scan card
        </Button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's follow-ups */}
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /><h3 className="font-semibold text-sm">Due follow-ups</h3></div>
            <Link to="/sales/followups" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {myDue.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                Nothing due right now.
              </div>
            ) : myDue.slice(0, 8).map((l) => (
              <button key={l.id} onClick={() => setOpenLead(l)}
                className="w-full text-left px-5 py-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{l.business_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{l.city || "—"} · {l.industry || "—"}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-amber-500 shrink-0">Due</span>
              </button>
            ))}
          </div>
        </section>

        {/* My queue */}
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2"><Inbox className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">My queue</h3></div>
            <Link to="/sales/leads/queue" className="text-xs text-primary hover:underline">Open queue</Link>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {mine.filter((l) => l.stage === "queued").length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No queued leads.</div>
            ) : mine.filter((l) => l.stage === "queued").slice(0, 8).map((l) => (
              <button key={l.id} onClick={() => setOpenLead(l)}
                className="w-full text-left px-5 py-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{l.business_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{l.email || l.phone || "—"}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-primary shrink-0">Queued</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <div>
            <div className="text-sm font-semibold">Closed a deal?</div>
            <div className="text-xs text-muted-foreground">Mark a lead as Won from the pipeline to log it here.</div>
          </div>
        </div>
        <Link to="/sales/pipeline"><Button variant="outline" size="sm">Open pipeline</Button></Link>
      </section>
    </>
  );
}
