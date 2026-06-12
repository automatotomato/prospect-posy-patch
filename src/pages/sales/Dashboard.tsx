import { Check, MapPin, RefreshCw, Sparkles, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSales, KpiTile } from "./_shared";

export default function Dashboard() {
  const { stats, dueFollowUps, discover, discovering, lastScout, setScanOpen, isAdmin } = useSales();

  return (
    <>
      {/* KPI ROW */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiTile label="Total Leads" value={stats.total} delta={stats.total > 0 ? `${stats.total} active` : "—"} progress={Math.min(100, stats.total * 4)} />
        <KpiTile label="Queued" value={stats.by.queued || 0} delta="Ready to send" progress={Math.min(100, (stats.by.queued || 0) * 8)} />
        <KpiTile label="Contacted" value={stats.by.contacted || 0} delta="+ this week" deltaTone="emerald" progress={Math.min(100, (stats.by.contacted || 0) * 6)} />
        <KpiTile
          label="Due Follow-ups"
          value={dueFollowUps.length}
          delta={dueFollowUps.length > 0 ? "High priority" : "All caught up"}
          deltaTone={dueFollowUps.length > 0 ? "amber" : "muted"}
          progress={Math.min(100, dueFollowUps.length * 12)}
        />
        <KpiTile label="Won" value={stats.by.won || 0} delta="Closed deals" highlight progress={Math.min(100, (stats.by.won || 0) * 10)} />
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

      {/* SCOUT AGENT */}
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
    </>
  );
}
