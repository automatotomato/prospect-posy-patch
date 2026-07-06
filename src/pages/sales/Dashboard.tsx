import { useEffect, useMemo, useState } from "react";
import { Check, MapPin, RefreshCw, Sparkles, Camera, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSales, KpiTile, effectiveOrigin, effectiveLeadType } from "./_shared";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TeamDashboard from "./TeamDashboard";

type LeadCosts = {
  ai_cost_per_lead: number;
  mine_cost_per_lead: number;
  daily_send_cap: number;
};

export default function Dashboard() {
  const { stats, dueFollowUps, discover, discovering, lastScout, setScanOpen, isAdmin, leads } = useSales();
  const [winsMonth, setWinsMonth] = useState<{ count: number; sum: number }>({ count: 0, sum: 0 });
  const [costs, setCosts] = useState<LeadCosts>({ ai_cost_per_lead: 0, mine_cost_per_lead: 0, daily_send_cap: 50 });
  const [costsOpen, setCostsOpen] = useState(false);
  const [sentToday, setSentToday] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    supabase.from("sales_wins" as any).select("amount, won_at").gte("won_at", monthStart.toISOString())
      .then(({ data }) => {
        const rows = (data as any[]) || [];
        setWinsMonth({ count: rows.length, sum: rows.reduce((s, r) => s + Number(r.amount || 0), 0) });
      });

    supabase.from("lead_costs").select("*").eq("id", "default").maybeSingle()
      .then(({ data }) => { if (data) setCosts(data as any); });

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    supabase.from("sales_activities").select("id", { count: "exact", head: true })
      .eq("type", "email_sent").gte("created_at", since)
      .then(({ count }) => setSentToday(count || 0));
  }, [isAdmin]);

  // Origin x Type breakdown (all leads)
  const matrix = useMemo(() => {
    const m: Record<"mine" | "ai", Record<"direct" | "general", number>> = {
      mine: { direct: 0, general: 0 },
      ai: { direct: 0, general: 0 },
    };
    for (const l of leads) {
      m[effectiveOrigin(l)][effectiveLeadType(l)] += 1;
    }
    return m;
  }, [leads]);

  const wonCounts = useMemo(() => {
    const m = { mine: 0, ai: 0 };
    for (const l of leads) if (l.stage === "won") m[effectiveOrigin(l)] += 1;
    return m;
  }, [leads]);

  const cpaAi = wonCounts.ai > 0 ? (costs.ai_cost_per_lead * matrix.ai.direct + costs.ai_cost_per_lead * matrix.ai.general) / wonCounts.ai : 0;
  const cpaMine = wonCounts.mine > 0 ? (costs.mine_cost_per_lead * matrix.mine.direct + costs.mine_cost_per_lead * matrix.mine.general) / wonCounts.mine : 0;

  if (!isAdmin) return <TeamDashboard />;

  return (
    <>
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiTile label="Total Leads" value={stats.total} delta={stats.total > 0 ? `${stats.total} active` : "—"} progress={Math.min(100, stats.total * 4)} />
        <KpiTile label="Not yet contacted" value={stats.notContacted} delta={`${stats.notContacted} fresh`} deltaTone="amber" progress={Math.min(100, stats.notContacted * 4)} />
        <KpiTile label="Contacted (ever)" value={stats.contactedEver} delta={stats.contactedEver ? "Worked" : "—"} deltaTone="emerald" progress={Math.min(100, stats.contactedEver * 4)} />
        <KpiTile label="Due Follow-ups" value={dueFollowUps.length} delta={dueFollowUps.length > 0 ? "High priority" : "All caught up"} deltaTone={dueFollowUps.length > 0 ? "amber" : "muted"} progress={Math.min(100, dueFollowUps.length * 12)} />
        <KpiTile label="Sent last 24h" value={sentToday} delta={`Cap ${costs.daily_send_cap}/day`} deltaTone={sentToday >= costs.daily_send_cap ? "amber" : "muted"} progress={Math.min(100, (sentToday / Math.max(1, costs.daily_send_cap)) * 100)} />
        <KpiTile label="Wins this month" value={winsMonth.count} delta={winsMonth.sum ? `$${winsMonth.sum.toLocaleString()}` : "Log a deal"} deltaTone="emerald" highlight progress={Math.min(100, winsMonth.count * 20)} />
      </section>

      {/* Origin × Type breakdown */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <h3 className="font-display font-semibold text-sm">Lead mix — Origin × Type</h3>
              <p className="text-xs text-muted-foreground">Uploaded contacts vs AI-scouted, split by direct vs generic mailbox.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div />
            <div className="font-semibold text-emerald-300 uppercase text-[10px] tracking-wider">Mine</div>
            <div className="font-semibold text-violet-300 uppercase text-[10px] tracking-wider">AI</div>

            <div className="font-semibold text-sky-300 uppercase text-[10px] tracking-wider text-right pr-2 self-center">Direct</div>
            <MatrixCell n={matrix.mine.direct} tone="strong" />
            <MatrixCell n={matrix.ai.direct} tone="strong" />

            <div className="font-semibold text-amber-300 uppercase text-[10px] tracking-wider text-right pr-2 self-center">General</div>
            <MatrixCell n={matrix.mine.general} tone="soft" />
            <MatrixCell n={matrix.ai.general} tone="soft" />
          </div>
          <p className="mt-4 text-[10px] text-muted-foreground italic">
            "Direct" = personal decision-maker email. "General" = info@ / sales@ / hello@ style catch-alls. AI scout now biases toward Direct where discoverable.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <h3 className="font-display font-semibold text-sm">Cost per acquisition</h3>
              <p className="text-xs text-muted-foreground">Set your average lead cost by origin to compute CPA per closed win.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setCostsOpen(true)} className="gap-1"><Pencil className="w-3.5 h-3.5" />Edit costs</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CpaCard label="AI leads" wins={wonCounts.ai} totalCost={costs.ai_cost_per_lead * (matrix.ai.direct + matrix.ai.general)} cpa={cpaAi} accent="violet" />
            <CpaCard label="Uploaded (Mine)" wins={wonCounts.mine} totalCost={costs.mine_cost_per_lead * (matrix.mine.direct + matrix.mine.general)} cpa={cpaMine} accent="emerald" />
          </div>
        </div>
      </section>

      <section className="text-xs text-muted-foreground bg-card border border-border rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span><span className="font-semibold text-foreground">{stats.inSequence}</span> in sequence</span>
        <span className="opacity-50">·</span>
        <span><span className="font-semibold text-foreground">{stats.notContacted}</span> awaiting first touch</span>
        <span className="opacity-50">·</span>
        <span><span className="font-semibold text-foreground">{dueFollowUps.length}</span> due follow-up</span>
        <span className="opacity-50">·</span>
        <span><span className="font-semibold text-foreground">{stats.by.queued || 0}</span> queued</span>
        <span className="opacity-50">·</span>
        <span><span className="font-semibold text-foreground">{sentToday}</span>/{costs.daily_send_cap} auto sent (24h)</span>
      </section>

      <section className="bg-gradient-to-br from-primary/15 via-card to-card border border-primary/30 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-start md:items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-sm">Scan a business card</h2>
            <p className="text-xs text-muted-foreground">
              Snap or upload a photo — AI extracts contact details and drops the lead into your pipeline as a Mine · Direct lead.
            </p>
          </div>
        </div>
        <Button onClick={() => setScanOpen(true)} className="gap-2 shrink-0">
          <Camera className="w-4 h-4" />Scan card
        </Button>
      </section>

      {isAdmin && (
        <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-foreground/[0.02]">
            <div>
              <h2 className="font-display font-semibold text-sm">AI Lead Scout</h2>
              <p className="text-xs text-muted-foreground">Pulls SMB leads across NV / CA / TX. Prefers personal decision-maker emails; falls back to generic mailboxes only when no direct email is discoverable.</p>
            </div>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded uppercase tracking-wider border border-primary/20">
              OpenAI · NV / CA / TX
            </span>
          </div>
          <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                <span>State rotates per run (NV → CA → TX). Every insert is tagged AI · Direct/General.</span>
              </div>
              {lastScout && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Last run: {lastScout.inserted} leads from {lastScout.state}</span>
                </div>
              )}
            </div>
            <Button onClick={discover} disabled={discovering} size="lg" className="h-12 font-semibold gap-2 px-6">
              {discovering ? <><RefreshCw className="w-4 h-4 animate-spin" />Scouting…</> : <><Sparkles className="w-4 h-4" />Scout leads</>}
            </Button>
          </div>
        </section>
      )}

      <CostsDialog open={costsOpen} onOpenChange={setCostsOpen} costs={costs} onSaved={setCosts} />
    </>
  );
}

function MatrixCell({ n, tone }: { n: number; tone: "strong" | "soft" }) {
  return (
    <div className={`rounded-xl px-3 py-4 flex flex-col items-center justify-center gap-0.5 border ${
      tone === "strong" ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border"
    }`}>
      <span className="font-display text-2xl font-bold tabular-nums">{n}</span>
      <span className="text-[10px] text-muted-foreground">leads</span>
    </div>
  );
}

function CpaCard({ label, wins, totalCost, cpa, accent }: { label: string; wins: number; totalCost: number; cpa: number; accent: "violet" | "emerald" }) {
  const accentClass = accent === "violet"
    ? "text-violet-300 bg-violet-500/10 border-violet-500/30"
    : "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
  return (
    <div className={`rounded-xl p-4 border ${accentClass}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">
        {cpa > 0 ? `$${cpa.toFixed(2)}` : "—"}
      </div>
      <div className="mt-1 text-[10px] opacity-70">
        {wins} wins · ${totalCost.toFixed(0)} invested
      </div>
    </div>
  );
}

function CostsDialog({ open, onOpenChange, costs, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; costs: LeadCosts;
  onSaved: (c: LeadCosts) => void;
}) {
  const [ai, setAi] = useState(String(costs.ai_cost_per_lead));
  const [mine, setMine] = useState(String(costs.mine_cost_per_lead));
  const [cap, setCap] = useState(String(costs.daily_send_cap));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAi(String(costs.ai_cost_per_lead));
    setMine(String(costs.mine_cost_per_lead));
    setCap(String(costs.daily_send_cap));
  }, [costs, open]);

  const save = async () => {
    setSaving(true);
    const patch = {
      ai_cost_per_lead: Number(ai) || 0,
      mine_cost_per_lead: Number(mine) || 0,
      daily_send_cap: Math.max(1, Math.floor(Number(cap) || 50)),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("lead_costs").update(patch).eq("id", "default").select().maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    onSaved(data as any);
    toast.success("Saved");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Lead cost & send cap</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Cost per AI lead ($)</Label>
            <Input value={ai} onChange={(e) => setAi(e.target.value)} type="number" step="0.01" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs">Cost per uploaded (Mine) lead ($)</Label>
            <Input value={mine} onChange={(e) => setMine(e.target.value)} type="number" step="0.01" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs">Daily auto-follow-up cap (emails / 24h)</Label>
            <Input value={cap} onChange={(e) => setCap(e.target.value)} type="number" step="1" className="bg-secondary border-border" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
