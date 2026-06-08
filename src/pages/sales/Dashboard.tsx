import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  LogOut, Sparkles, Copy, Check, RefreshCw, Search, Trash2,
  ListChecks, Clock, Users, Send, MoreVertical, ChevronRight, Activity as ActivityIcon, TrendingUp,
  LayoutDashboard, Kanban, Settings as SettingsIcon, Bell, Building2, MapPin,
} from "lucide-react";
import { useSalesLeads, STAGES, type Lead } from "@/hooks/useSalesLeads";

const VERTICALS = [
  "manufacturing", "warehouse", "logistics company", "transportation company",
  "freight broker", "distribution center", "wholesale supplier", "3PL",
];

const STAGE_META: Record<string, { dot: string; accent: string; tint: string }> = {
  new:        { dot: "bg-sky-400",     accent: "text-sky-300",     tint: "border-l-sky-500" },
  queued:     { dot: "bg-amber-400",   accent: "text-amber-300",   tint: "border-l-amber-500" },
  contacted:  { dot: "bg-blue-400",    accent: "text-blue-300",    tint: "border-l-blue-500" },
  follow_up:  { dot: "bg-indigo-400",  accent: "text-indigo-300",  tint: "border-l-indigo-500" },
  replied:    { dot: "bg-fuchsia-400", accent: "text-fuchsia-300", tint: "border-l-fuchsia-500" },
  won:        { dot: "bg-emerald-400", accent: "text-emerald-300", tint: "border-l-emerald-500" },
  lost:       { dot: "bg-rose-500",    accent: "text-rose-300",    tint: "border-l-rose-500" },
};

function StageBadge({ stage }: { stage: string }) {
  const label = STAGES.find((s) => s.id === stage)?.label || stage;
  const m = STAGE_META[stage];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${m?.accent || ""}`}>
      <span className={`stage-dot ${m?.dot || "bg-muted-foreground"}`} />{label}
    </span>
  );
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (Math.abs(diff) < 60) return "now";
  if (diff > 0 && diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff > 0 && diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 0 && diff > -86400 * 14) return `in ${Math.ceil(-diff / 86400)}d`;
  return d.toLocaleDateString();
}

function ActivityIconFor({ type }: { type: string }) {
  if (type.startsWith("stage:")) return <TrendingUp className="w-3 h-3" />;
  if (type === "email_generated") return <Sparkles className="w-3 h-3" />;
  if (type === "follow_up_scheduled") return <Clock className="w-3 h-3" />;
  return <ActivityIcon className="w-3 h-3" />;
}

function activityLabel(a: { type: string; note: string | null }) {
  if (a.type.startsWith("stage:")) {
    const s = a.type.split(":")[1];
    return `Moved to ${STAGES.find((x) => x.id === s)?.label || s}`;
  }
  if (a.type === "email_generated") return "Email drafted";
  if (a.type === "follow_up_scheduled") return `Follow-up scheduled${a.note ? ` (${a.note})` : ""}`;
  if (a.type === "discovered") return "Discovered";
  if (a.type === "note_added") return a.note || "Note added";
  return a.type;
}

export default function SalesDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { leads, activities, loading, load, logActivity, setStage, scheduleFollowUp, removeLead, stats } =
    useSalesLeads(user?.id);

  const [discovering, setDiscovering] = useState(false);
  const [vertical, setVertical] = useState(VERTICALS[0]);
  const [city, setCity] = useState("Las Vegas, NV");
  const [count, setCount] = useState(10);
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState("pipeline");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) navigate("/sales/login", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (openLead) {
      const fresh = leads.find((l) => l.id === openLead.id);
      if (fresh && fresh !== openLead) setOpenLead(fresh);
      if (!fresh) setOpenLead(null);
    }
  }, [leads, openLead]);

  const discover = async () => {
    setDiscovering(true);
    const { data, error } = await supabase.functions.invoke("sales-discover-leads", {
      body: { vertical, city, count },
    });
    setDiscovering(false);
    if (error) return toast.error(error.message);
    toast.success(`Found ${data?.inserted ?? 0} new leads`);
    if (data?.leads?.length) {
      for (const l of data.leads) logActivity(l.id, "discovered", `${vertical} · ${city}`);
    }
    load();
  };

  const generate = async (lead: Lead) => {
    setGeneratingId(lead.id);
    const { data, error } = await supabase.functions.invoke("sales-generate-email", {
      body: { lead_id: lead.id },
    });
    setGeneratingId(null);
    if (error) return toast.error(error.message);
    if (data?.lead) {
      await logActivity(lead.id, "email_generated");
      load();
      toast.success("Email drafted");
    }
  };

  const copy = async (lead: Lead) => {
    const text = `Subject: ${lead.email_subject}\n\n${lead.email_body}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const dueFollowUps = useMemo(() => {
    const now = Date.now();
    return leads
      .filter((l) => l.follow_up_at && new Date(l.follow_up_at).getTime() <= now && !["replied","won","lost"].includes(l.stage))
      .sort((a, b) => new Date(a.follow_up_at!).getTime() - new Date(b.follow_up_at!).getTime());
  }, [leads]);

  const queuedLeads = useMemo(() => leads.filter((l) => l.stage === "queued"), [leads]);
  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter((l) =>
      l.business_name.toLowerCase().includes(q) ||
      (l.city || "").toLowerCase().includes(q) ||
      (l.industry || "").toLowerCase().includes(q)
    );
  }, [leads, search]);

  const initials = (user?.email || "ZC").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* ============ SIDEBAR ============ */}
      <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center font-display font-bold text-primary-foreground shadow-lg shadow-primary/20">
              Z&amp;C
            </div>
            <div className="min-w-0">
              <div className="font-display font-semibold text-sm leading-tight">Z &amp; C</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Consultants</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <SidebarLink active icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" />
          <SidebarLink icon={<Kanban className="w-4 h-4" />} label="Pipeline" onClick={() => setTab("pipeline")} />
          <SidebarLink icon={<Users className="w-4 h-4" />} label="Leads" onClick={() => setTab("all")} />
          <SidebarLink icon={<ActivityIcon className="w-4 h-4" />} label="Activity" onClick={() => setTab("activity")} />
          <SidebarLink icon={<Clock className="w-4 h-4" />} label="Follow-ups" badge={dueFollowUps.length || undefined} onClick={() => setTab("followups")} />
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <SidebarLink icon={<SettingsIcon className="w-4 h-4" />} label="Settings" onClick={() => navigate("/team")} />
          <button
            onClick={() => { signOut(); navigate("/sales/login"); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="font-display text-lg font-semibold leading-tight">Sales Pipeline</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live outbound activity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads…"
                className="pl-9 w-64 bg-card border-border h-9 rounded-full text-sm"
              />
            </div>
            <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              {dueFollowUps.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary border-2 border-background" />
              )}
            </button>
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold border border-border">
              {initials}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8">
          {/* ============ KPI ROW ============ */}
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

          {/* ============ DISCOVER ============ */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-foreground/[0.02]">
              <div>
                <h2 className="font-display font-semibold text-sm">Discover new leads</h2>
                <p className="text-xs text-muted-foreground">AI-targeted prospects in operations-heavy verticals.</p>
              </div>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded uppercase tracking-wider border border-primary/20">
                AI Engine
              </span>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vertical</Label>
                  <Select value={vertical} onValueChange={setVertical}>
                    <SelectTrigger className="bg-secondary border-border h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{VERTICALS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, ST" className="bg-secondary border-border h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batch Count</Label>
                  <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="bg-secondary border-border h-10" />
                </div>
                <Button onClick={discover} disabled={discovering} className="h-10 font-semibold gap-2">
                  {discovering ? <><RefreshCw className="w-4 h-4 animate-spin" />Searching</> : <><Search className="w-4 h-4" />Discover</>}
                </Button>
              </div>
              <p className="mt-4 text-[10px] text-muted-foreground italic">
                Excludes healthcare, medical, dental, pharma, and any insurance verticals.
              </p>
            </div>
          </section>

          {/* ============ TABS + PIPELINE ============ */}
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <div className="border-b border-border">
              <TabsList className="bg-transparent h-auto p-0 gap-6 rounded-none">
                <PillTab value="pipeline" current={tab}>Pipeline</PillTab>
                <PillTab value="followups" current={tab} count={dueFollowUps.length} accent>Follow-ups</PillTab>
                <PillTab value="queue" current={tab} count={queuedLeads.length}>Queue</PillTab>
                <PillTab value="all" current={tab} count={leads.length}>All Leads</PillTab>
                <PillTab value="activity" current={tab}>Activity</PillTab>
              </TabsList>
            </div>

            <TabsContent value="pipeline" className="mt-4">
              <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4 -mx-2 px-2">
                {STAGES.map((s) => {
                  const items = leads.filter((l) => l.stage === s.id);
                  const meta = STAGE_META[s.id];
                  return (
                    <div key={s.id} className="min-w-[260px] w-[260px] shrink-0 space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className={`stage-dot ${meta?.dot}`} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</span>
                        </div>
                        <span className="text-[10px] font-mono font-semibold bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded">
                          {items.length.toString().padStart(2, "0")}
                        </span>
                      </div>
                      <div className="space-y-2 min-h-[120px]">
                        {items.map((l) => (
                          <KanbanLeadCard key={l.id} lead={l} onClick={() => setOpenLead(l)} />
                        ))}
                        {items.length === 0 && (
                          <div className="h-24 flex items-center justify-center border border-dashed border-border rounded-xl text-[10px] text-muted-foreground">
                            Empty
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="followups" className="mt-4">
              <LeadTable leads={dueFollowUps} loading={loading} emptyText="No follow-ups due." onOpen={setOpenLead} showColumn="follow_up" />
            </TabsContent>
            <TabsContent value="queue" className="mt-4">
              <LeadTable leads={queuedLeads} loading={loading} emptyText="Nothing queued. Move leads to Queue from the pipeline." onOpen={setOpenLead} showColumn="queued" />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <LeadTable leads={filteredLeads} loading={loading} emptyText="No leads yet." onOpen={setOpenLead} showColumn="updated" />
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
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
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {openLead && (
        <LeadDrawer
          lead={openLead}
          onClose={() => setOpenLead(null)}
          activities={activities.filter((a) => a.lead_id === openLead.id)}
          onGenerate={() => generate(openLead)}
          generating={generatingId === openLead.id}
          onCopy={() => copy(openLead)}
          copied={copiedId === openLead.id}
          onStage={(s) => setStage(openLead, s)}
          onFollowUp={(days) => scheduleFollowUp(openLead, days)}
          onDelete={() => { removeLead(openLead.id); setOpenLead(null); }}
        />
      )}
    </div>
  );
}

/* ============ Pieces ============ */

function SidebarLink({ icon, label, active, badge, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; badge?: number; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-primary/10 text-primary border border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className="text-[10px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded">{badge}</span>
      ) : null}
    </button>
  );
}

function PillTab({ value, current, children, count, accent }: {
  value: string; current: string; children: React.ReactNode; count?: number; accent?: boolean;
}) {
  const isActive = current === value;
  return (
    <TabsTrigger
      value={value}
      className={`relative bg-transparent rounded-none px-0 pb-3 pt-0 text-sm font-medium data-[state=active]:shadow-none data-[state=active]:bg-transparent ${
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="flex items-center gap-2">
        {children}
        {count !== undefined && count > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            accent ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
          }`}>{count}</span>
        )}
      </span>
      {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-full" />}
    </TabsTrigger>
  );
}

function KpiTile({ label, value, delta, deltaTone = "primary", progress = 50, highlight }: {
  label: string; value: number; delta?: string; deltaTone?: "primary" | "emerald" | "amber" | "muted"; progress?: number; highlight?: boolean;
}) {
  const toneClass = highlight
    ? "bg-white/20 text-white"
    : deltaTone === "emerald" ? "bg-emerald-500/10 text-emerald-400"
    : deltaTone === "amber" ? "bg-amber-500/10 text-amber-400"
    : deltaTone === "muted" ? "bg-muted/60 text-muted-foreground"
    : "bg-primary/10 text-primary";

  return (
    <div className={highlight ? "kpi-tile-primary" : "kpi-tile"}>
      <div className="flex justify-between items-start">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? "text-white/70" : "text-muted-foreground"}`}>
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
        {delta && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${toneClass}`}>{delta}</span>
        )}
      </div>
      <div className={`mt-3 h-1 w-full rounded-full overflow-hidden ${highlight ? "bg-white/20" : "bg-muted/40"}`}>
        <div
          className={`h-full rounded-full transition-all ${highlight ? "bg-white" : "bg-primary"}`}
          style={{ width: `${Math.max(8, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}

function KanbanLeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const meta = STAGE_META[lead.stage];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-card hover:bg-secondary/50 border border-border border-l-2 ${meta?.tint || "border-l-border"} rounded-xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 group`}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        {lead.industry ? (
          <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider truncate max-w-[140px]">
            {lead.industry}
          </span>
        ) : <span />}
        <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(lead.last_activity_at || lead.created_at)}</span>
      </div>
      <h4 className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
        {lead.business_name}
      </h4>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        {lead.city && (
          <span className="flex items-center gap-1 truncate"><MapPin className="w-2.5 h-2.5" />{lead.city}</span>
        )}
        {lead.contact_count > 0 && (
          <span className="flex items-center gap-1"><Send className="w-2.5 h-2.5" />{lead.contact_count}</span>
        )}
        {lead.email_body && (
          <span className="flex items-center gap-1 text-primary"><Sparkles className="w-2.5 h-2.5" />Drafted</span>
        )}
      </div>
    </button>
  );
}

function LeadTable({
  leads, loading, emptyText, onOpen, showColumn,
}: {
  leads: Lead[]; loading: boolean; emptyText: string; onOpen: (l: Lead) => void;
  showColumn: "follow_up" | "queued" | "updated";
}) {
  if (loading) return <p className="text-sm text-muted-foreground p-6">Loading…</p>;
  if (leads.length === 0)
    return <div className="bg-card border border-border rounded-2xl p-8 text-sm text-muted-foreground text-center">{emptyText}</div>;
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="divide-y divide-border">
        {leads.map((l) => (
          <button
            key={l.id}
            onClick={() => onOpen(l)}
            className="w-full text-left px-5 py-3 hover:bg-muted/30 flex items-center gap-4 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-primary">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{l.business_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[l.industry, l.city, l.state].filter(Boolean).join(" · ") || "—"}
                {l.phone && <> · {l.phone}</>}
              </div>
            </div>
            <div className="text-xs text-muted-foreground hidden sm:block w-28 text-right">
              {showColumn === "follow_up" && <>Follow-up {fmtDate(l.follow_up_at)}</>}
              {showColumn === "queued" && <>Queued {fmtDate(l.queued_at)}</>}
              {showColumn === "updated" && <>{fmtDate(l.last_activity_at || l.created_at)}</>}
            </div>
            <StageBadge stage={l.stage} />
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function LeadDrawer({
  lead, onClose, activities, onGenerate, generating, onCopy, copied,
  onStage, onFollowUp, onDelete,
}: {
  lead: Lead; onClose: () => void;
  activities: { id: string; type: string; note: string | null; created_at: string }[];
  onGenerate: () => void; generating: boolean; onCopy: () => void; copied: boolean;
  onStage: (s: string) => void; onFollowUp: (days: number) => void; onDelete: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-lg bg-card border-l border-border z-50 overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-display font-semibold truncate">{lead.business_name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[lead.industry, lead.city, lead.state].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StageBadge stage={lead.stage} />
            <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">×</Button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <Meta label="Website" value={lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" className="underline truncate block text-primary">{lead.website}</a> : "—"} />
            <Meta label="Phone" value={lead.phone || "—"} />
            <Meta label="Email" value={lead.email || "—"} />
            <Meta label="Last contacted" value={fmtDate(lead.last_contacted_at)} />
            <Meta label="Follow-up" value={fmtDate(lead.follow_up_at)} />
            <Meta label="Touches" value={String(lead.contact_count)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">Move stage <MoreVertical className="w-3 h-3 ml-1" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Set stage</DropdownMenuLabel>
                {STAGES.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => onStage(s.id)} disabled={s.id === lead.stage}>
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {lead.stage !== "queued" && (
              <Button size="sm" variant="outline" onClick={() => onStage("queued")}><ListChecks className="w-3 h-3 mr-1" />Queue</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onStage("contacted")}><Send className="w-3 h-3 mr-1" />Mark contacted</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><Clock className="w-3 h-3 mr-1" />Follow up</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {[1, 3, 7, 14, 30].map((d) => (
                  <DropdownMenuItem key={d} onClick={() => onFollowUp(d)}>In {d} day{d > 1 ? "s" : ""}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive ml-auto">
              <Trash2 className="w-3 h-3 mr-1" />Delete
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Outreach email</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onGenerate} disabled={generating}>
                  {generating ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Drafting</> : <><Sparkles className="w-3 h-3 mr-1" />{lead.email_body ? "Regenerate" : "Generate"}</>}
                </Button>
                {lead.email_body && (
                  <Button size="sm" variant="outline" onClick={onCopy}>
                    {copied ? <><Check className="w-3 h-3 mr-1" />Copied</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                  </Button>
                )}
              </div>
            </div>
            {lead.email_body ? (
              <div className="border border-border rounded-xl p-4 bg-secondary/40 space-y-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</div>
                  <div className="text-sm font-semibold mt-1">{lead.email_subject}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Body</div>
                  <pre className="text-sm whitespace-pre-wrap font-sans mt-1 leading-relaxed">{lead.email_body}</pre>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No email drafted yet.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Activity</div>
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <ActivityIconFor type={a.type} />
                    </div>
                    <span className="flex-1">{activityLabel(a)}</span>
                    <span className="text-muted-foreground">{fmtDate(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium truncate mt-0.5">{value}</div>
    </div>
  );
}
