import { useEffect, useState } from "react";
import { Check, MapPin, RefreshCw, Sparkles, Camera, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSales, KpiTile } from "./_shared";
import { supabase } from "@/integrations/supabase/client";
import TeamDashboard from "./TeamDashboard";

export default function Dashboard() {
  const { stats, dueFollowUps, discover, discovering, lastScout, setScanOpen, isAdmin } = useSales();
  const [winsMonth, setWinsMonth] = useState<{ count: number; sum: number }>({ count: 0, sum: 0 });

  useEffect(() => {
    if (!isAdmin) return;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    supabase.from("sales_wins" as any).select("amount, won_at").gte("won_at", monthStart.toISOString())
      .then(({ data }) => {
        const rows = (data as any[]) || [];
        setWinsMonth({ count: rows.length, sum: rows.reduce((s, r) => s + Number(r.amount || 0), 0) });
      });
  }, [isAdmin]);

  if (!isAdmin) return <TeamDashboard />;


  return (
    <>
      {/* KPI ROW */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiTile label="Total Leads" value={stats.total} delta={stats.total > 0 ? `${stats.total} active` : "—"} progress={Math.min(100, stats.total * 4)} />
        <KpiTile label="Not yet contacted" value={stats.notContacted} delta={`${stats.notContacted} fresh`} deltaTone="amber" progress={Math.min(100, stats.notContacted * 4)} />
        <KpiTile label="Contacted (ever)" value={stats.contactedEver} delta={stats.contactedEver ? "Worked" : "—"} deltaTone="emerald" progress={Math.min(100, stats.contactedEver * 4)} />
        <KpiTile
          label="Due Follow-ups"
          value={dueFollowUps.length}
          delta={dueFollowUps.length > 0 ? "High priority" : "All caught up"}
          deltaTone={dueFollowUps.length > 0 ? "amber" : "muted"}
          progress={Math.min(100, dueFollowUps.length * 12)}
        />
        <KpiTile label="Won (all)" value={stats.by.won || 0} delta="Closed deals" progress={Math.min(100, (stats.by.won || 0) * 10)} />
        <KpiTile label="Wins this month" value={winsMonth.count} delta={winsMonth.sum ? `$${winsMonth.sum.toLocaleString()}` : "Log a deal"} deltaTone="emerald" highlight progress={Math.min(100, winsMonth.count * 20)} />
      </section>

      {/* Reconciliation — same definitions as the Follow-ups tab */}
      <section className="text-xs text-muted-foreground bg-card border border-border rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span><span className="font-semibold text-foreground">{stats.inSequence}</span> in sequence</span>
        <span className="opacity-50">·</span>
        <span><span className="font-semibold text-foreground">{stats.notContacted}</span> awaiting first touch</span>
        <span className="opacity-50">·</span>
        <span><span className="font-semibold text-foreground">{dueFollowUps.length}</span> due follow-up</span>
        <span className="opacity-50">·</span>
        <span><span className="font-semibold text-foreground">{stats.by.queued || 0}</span> queued</span>
      </section>


      {/* SCAN BUSINESS CARD */}
      <section className="bg-gradient-to-br from-primary/15 via-card to-card border border-primary/30 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-start md:items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-sm">Scan a business card</h2>
            <p className="text-xs text-muted-foreground">
              Snap or upload a photo — AI extracts contact details and drops the lead into your pipeline.
            </p>
          </div>
        </div>
        <Button onClick={() => setScanOpen(true)} className="gap-2 shrink-0">
          <Camera className="w-4 h-4" />Scan card
        </Button>
      </section>

      {/* SCOUT AGENT — admin only */}
      {isAdmin && (
        <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-foreground/[0.02]">
            <div>
              <h2 className="font-display font-semibold text-sm">AI Lead Scout</h2>
              <p className="text-xs text-muted-foreground">Pulls 50 SMB leads across Nevada, California, and Texas — every lead has a verified email and a personalized draft.</p>
            </div>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded uppercase tracking-wider border border-primary/20">
              OpenAI · NV / CA / TX
            </span>
          </div>
          <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                <span>State rotates per run (NV → CA → TX). Target 50 verified leads.</span>
              </div>
              {lastScout && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Last run: {lastScout.inserted} leads from {lastScout.state}</span>
                </div>
              )}
              <div className="italic opacity-70">Healthcare, insurance, and medical verticals excluded.</div>
            </div>
            <Button onClick={discover} disabled={discovering} size="lg" className="h-12 font-semibold gap-2 px-6">
              {discovering ? <><RefreshCw className="w-4 h-4 animate-spin" />Scouting…</> : <><Sparkles className="w-4 h-4" />Scout 50 leads</>}
            </Button>
          </div>
        </section>
      )}

    </>
  );
}
