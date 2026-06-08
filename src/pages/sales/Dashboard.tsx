import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Briefcase, LogOut, Sparkles, Copy, Check, RefreshCw, Search, Trash2,
  ListChecks, Clock, Users, Send, MoreVertical, ChevronRight, Activity as ActivityIcon, TrendingUp,
} from "lucide-react";
import { useSalesLeads, STAGES, type Lead } from "@/hooks/useSalesLeads";

const VERTICALS = [
  "manufacturing", "warehouse", "logistics company", "transportation company",
  "freight broker", "distribution center", "wholesale supplier", "3PL",
];

const STAGE_COLORS: Record<string, string> = {
  new: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  queued: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  contacted: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  follow_up: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  replied: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
  won: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30",
  lost: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};

function StageBadge({ stage }: { stage: string }) {
  const label = STAGES.find((s) => s.id === stage)?.label || stage;
  return <Badge variant="outline" className={STAGE_COLORS[stage] || ""}>{label}</Badge>;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (Math.abs(diff) < 60) return "now";
  if (diff > 0 && diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 0 && diff > -86400 * 14) return `in ${Math.ceil(-diff / 86400)}d`;
  return d.toLocaleDateString();
}

function ActivityIconFor({ type }: { type: string }) {
  if (type.startsWith("stage:")) return <TrendingUp className="w-3 h-3" />;
  if (type === "email_generated") return <Sparkles className="w-3 h-3" />;
  if (type === "follow_up_scheduled") return <Clock className="w-3 h-3" />;
  if (type === "note_added") return <ActivityIcon className="w-3 h-3" />;
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

  useEffect(() => {
    if (!user) navigate("/sales/login", { replace: true });
  }, [user, navigate]);

  // Keep openLead in sync with leads state
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
    // Log discovery activity for each new lead
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Outbound Sales</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/sales/login"); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} icon={<Users className="w-4 h-4" />} />
          <StatCard label="Queued" value={stats.by.queued || 0} icon={<ListChecks className="w-4 h-4" />} />
          <StatCard label="Contacted" value={stats.by.contacted || 0} icon={<Send className="w-4 h-4" />} />
          <StatCard label="Due follow-ups" value={dueFollowUps.length} icon={<Clock className="w-4 h-4" />} highlight={dueFollowUps.length > 0} />
          <StatCard label="Won" value={stats.by.won || 0} icon={<TrendingUp className="w-4 h-4" />} />
        </div>

        {/* Discover */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Discover new leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vertical</Label>
                <Select value={vertical} onValueChange={setVertical}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VERTICALS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, ST" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Count</Label>
                <Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} />
              </div>
              <div className="flex items-end">
                <Button onClick={discover} disabled={discovering} className="w-full">
                  {discovering ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Searching</> : <><Search className="w-4 h-4 mr-2" />Discover</>}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Excludes healthcare, medical, dental, pharma, and any insurance verticals.
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="followups">
              Follow-ups{dueFollowUps.length > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5">{dueFollowUps.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="queue">Queue ({queuedLeads.length})</TabsTrigger>
            <TabsTrigger value="all">All ({leads.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Pipeline (Kanban) */}
          <TabsContent value="pipeline" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 overflow-x-auto">
              {STAGES.map((s) => {
                const items = leads.filter((l) => l.stage === s.id);
                return (
                  <div key={s.id} className="rounded-lg border bg-card p-2 min-h-[200px]">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-medium">{s.label}</span>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setOpenLead(l)}
                          className="w-full text-left p-2 rounded-md border bg-background hover:bg-accent transition-colors"
                        >
                          <div className="text-xs font-medium truncate">{l.business_name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{l.city || "—"}</div>
                          {l.follow_up_at && (
                            <div className="text-[10px] mt-1 text-muted-foreground flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {fmtDate(l.follow_up_at)}
                            </div>
                          )}
                        </button>
                      ))}
                      {items.length === 0 && <div className="text-[10px] text-muted-foreground px-1">Empty</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Follow-ups */}
          <TabsContent value="followups" className="mt-4">
            <LeadTable
              leads={dueFollowUps}
              loading={loading}
              emptyText="No follow-ups due."
              onOpen={setOpenLead}
              showColumn="follow_up"
            />
          </TabsContent>

          {/* Queue */}
          <TabsContent value="queue" className="mt-4">
            <LeadTable
              leads={queuedLeads}
              loading={loading}
              emptyText="Nothing queued. Move leads to Queue from the pipeline."
              onOpen={setOpenLead}
              showColumn="queued"
            />
          </TabsContent>

          {/* All */}
          <TabsContent value="all" className="mt-4">
            <LeadTable leads={leads} loading={loading} emptyText="No leads yet." onOpen={setOpenLead} showColumn="updated" />
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No activity yet.</p>
                ) : (
                  <ul className="divide-y">
                    {activities.map((a) => {
                      const lead = leads.find((l) => l.id === a.lead_id);
                      return (
                        <li key={a.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-accent/30 cursor-pointer"
                            onClick={() => lead && setOpenLead(lead)}>
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <ActivityIconFor type={a.type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">
                              <span className="font-medium">{lead?.business_name || "(deleted lead)"}</span>
                              <span className="text-muted-foreground"> — {activityLabel(a)}</span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{fmtDate(a.created_at)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Lead detail panel */}
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

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-amber-500/50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
          <span>{label}</span>{icon}
        </div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function LeadTable({
  leads, loading, emptyText, onOpen, showColumn,
}: {
  leads: Lead[]; loading: boolean; emptyText: string; onOpen: (l: Lead) => void;
  showColumn: "follow_up" | "queued" | "updated";
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (leads.length === 0) return <Card><CardContent className="p-6 text-sm text-muted-foreground">{emptyText}</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {leads.map((l) => (
            <button key={l.id} onClick={() => onOpen(l)}
              className="w-full text-left px-4 py-3 hover:bg-accent/40 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{l.business_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[l.industry, l.city, l.state].filter(Boolean).join(" · ") || "—"}
                  {l.phone && <> · {l.phone}</>}
                </div>
              </div>
              <div className="text-xs text-muted-foreground hidden sm:block w-28 text-right">
                {showColumn === "follow_up" && <>FU {fmtDate(l.follow_up_at)}</>}
                {showColumn === "queued" && <>Queued {fmtDate(l.queued_at)}</>}
                {showColumn === "updated" && <>{fmtDate(l.last_activity_at || l.created_at)}</>}
              </div>
              <StageBadge stage={l.stage} />
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LeadDrawer({
  lead, onClose, activities, onGenerate, generating, onCopy, copied,
  onStage, onFollowUp, onDelete,
}: {
  lead: Lead; onClose: () => void; activities: { id: string; type: string; note: string | null; created_at: string }[];
  onGenerate: () => void; generating: boolean; onCopy: () => void; copied: boolean;
  onStage: (s: string) => void; onFollowUp: (days: number) => void; onDelete: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-lg bg-background border-l z-50 overflow-y-auto">
        <div className="sticky top-0 bg-background border-b px-5 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-semibold truncate">{lead.business_name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[lead.industry, lead.city, lead.state].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StageBadge stage={lead.stage} />
            <Button size="sm" variant="ghost" onClick={onClose}>×</Button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Quick meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Meta label="Website" value={lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" className="underline truncate block">{lead.website}</a> : "—"} />
            <Meta label="Phone" value={lead.phone || "—"} />
            <Meta label="Email" value={lead.email || "—"} />
            <Meta label="Last contacted" value={fmtDate(lead.last_contacted_at)} />
            <Meta label="Follow-up" value={fmtDate(lead.follow_up_at)} />
            <Meta label="Touches" value={String(lead.contact_count)} />
          </div>

          {/* Stage actions */}
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
              <Button size="sm" variant="outline" onClick={() => onStage("queued")}>
                <ListChecks className="w-3 h-3 mr-1" />Queue
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onStage("contacted")}>
              <Send className="w-3 h-3 mr-1" />Mark contacted
            </Button>
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

          {/* Email */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Outreach email</div>
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
              <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                <div className="text-xs text-muted-foreground">Subject</div>
                <div className="text-sm font-medium">{lead.email_subject}</div>
                <div className="text-xs text-muted-foreground mt-2">Body</div>
                <pre className="text-sm whitespace-pre-wrap font-sans">{lead.email_body}</pre>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No email drafted yet.</p>
            )}
          </div>

          {/* Activity timeline */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Activity</div>
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
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
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
