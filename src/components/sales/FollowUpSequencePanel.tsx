import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Mail, Clock, Eye, Building2, ChevronRight, Settings2, Sparkles, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import type { Lead, Activity } from "@/hooks/useSalesLeads";

export type Touchpoint = {
  id: string;
  step: number;
  channel: "email" | "sms" | "call";
  delayDays: number;
  subject: string;
  body: string;
  angle: string;
};

const STORAGE_KEY = "sales.followup.sequence.v1";

const DEFAULT_SEQUENCE: Touchpoint[] = [
  {
    id: "step-1", step: 1, channel: "email", delayDays: 0, angle: "Intro / spreadsheet pain",
    subject: "Cleaner reporting for {{company}}",
    body:
`Hi {{first_name}},

I run Z & C Consultants — we build Power BI dashboards and process automation for operations-heavy shops in {{city}} (manufacturing, warehouse, logistics, 3PL).

Most owners I talk to are still pulling weekly numbers out of spreadsheets, NetSuite exports, or QuickBooks copy-pastes. We replace that with one live dashboard pulling from your existing systems — no new software for your team to learn.

Open to a quick call to see if it'd fit {{company}}?

— Z & C Consultants
(214) 997-4331 | management@z-cconsultants.com`,
  },
  {
    id: "step-2", step: 2, channel: "email", delayDays: 4, angle: "Manual reporting cost",
    subject: "Re: Cleaner reporting for {{company}}",
    body:
`Hey {{first_name}},

Quick follow-up. Operations teams in {{city}} usually burn 8-15 hours/week stitching reports together by hand. That's $30-60k/yr in admin time before anyone even looks at the numbers.

We build the data pipeline + Power BI layer so the report builds itself, every morning, automatically.

Worth 15 minutes to compare to what you're doing today?

— Z & C Consultants`,
  },
  {
    id: "step-3", step: 3, channel: "email", delayDays: 8, angle: "Inventory / throughput visibility",
    subject: "Live inventory + throughput in one view",
    body:
`{{first_name}},

For warehouses and distribution shops in {{city}}, the biggest win is usually a single screen showing real-time inventory, throughput per shift, and slow-moving SKUs — pulled straight from your WMS or ERP.

We've built this for clients running NetSuite, SAP, Fishbowl, Cin7, and plain SQL backends. Setup is 2-3 weeks, no replatform required.

Want me to send a short walkthrough video?

— Z & C Consultants`,
  },
  {
    id: "step-4", step: 4, channel: "email", delayDays: 12, angle: "Automation / freed-up hours",
    subject: "How we freed up 22 hrs/week for a {{city}} 3PL",
    body:
`{{first_name}},

Quick story: a 3PL we work with had two people running daily fulfillment, billing, and KPI reports out of Excel. We automated the data pulls, billing reconciliation, and the morning report.

Result: 22 hours/week back, plus billing errors dropped to near-zero.

Happy to walk you through what they did — same approach would map to {{company}}.

— Z & C Consultants
(214) 997-4331`,
  },
  {
    id: "step-5", step: 5, channel: "email", delayDays: 16, angle: "Scoped pilot offer",
    subject: "Scoped pilot — one dashboard, fixed price",
    body:
`{{first_name}},

If you want to test how this would work for {{company}} without a big commitment, we offer a scoped pilot: one Power BI dashboard wired into your real data, fixed price, 2-week turnaround.

If you don't see value at the end, you keep the dashboard and we part ways.

Open to a 15-min scoping call?

— Z & C Consultants`,
  },
  {
    id: "step-6", step: 6, channel: "email", delayDays: 20, angle: "Breakup",
    subject: "Should I close your file?",
    body:
`{{first_name}},

Haven't heard back so I'll stop reaching out. No hard feelings if the timing's off.

If you ever want to replace a fragile spreadsheet with something that runs itself, my direct line is (214) 997-4331.

Wishing {{company}} a strong quarter.

— Z & C Consultants`,
  },
];

function loadSequence(): Touchpoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SEQUENCE;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SEQUENCE;
    return parsed;
  } catch {
    return DEFAULT_SEQUENCE;
  }
}

function saveSequence(seq: Touchpoint[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seq));
}

function renderVars(text: string, lead?: Lead) {
  return text
    .replace(/\{\{first_name\}\}/g, (lead?.business_name || "there").split(" ")[0] || "there")
    .replace(/\{\{company\}\}/g, lead?.business_name || "your business")
    .replace(/\{\{city\}\}/g, lead?.city || "your city");
}

export function FollowUpSequencePanel({
  leads, activities, onOpenLead,
}: {
  leads: Lead[];
  activities: Activity[];
  onOpenLead: (l: Lead) => void;
}) {
  const [sequence, setSequence] = useState<Touchpoint[]>(() => loadSequence());
  const [editing, setEditing] = useState<Touchpoint | null>(null);
  const [previewLeadId, setPreviewLeadId] = useState<string | null>(null);
  const [tab, setTab] = useState("tracker");

  useEffect(() => { saveSequence(sequence); }, [sequence]);

  const previewLead = useMemo(
    () => leads.find((l) => l.id === previewLeadId) || leads[0],
    [leads, previewLeadId],
  );

  // Tracker: leads that have been followed up with — any lead in follow_up/contacted/replied with contact_count > 0
  const followedLeads = useMemo(() => {
    return leads
      .filter((l) => l.contact_count > 0 || ["follow_up", "contacted", "replied"].includes(l.stage))
      .map((l) => {
        const acts = activities.filter((a) => a.lead_id === l.id);
        const followUpActs = acts.filter((a) => a.type === "follow_up_scheduled" || a.type.startsWith("stage:contacted") || a.type === "email_generated");
        const step = Math.min(sequence.length, Math.max(1, (l.contact_count || 0)));
        const lastTouch = followUpActs[0]?.created_at || l.last_contacted_at || l.last_activity_at || l.created_at;
        const nextDue = l.follow_up_at;
        return { lead: l, step, touches: l.contact_count || 0, lastTouch, nextDue };
      })
      .sort((a, b) => new Date(b.lastTouch).getTime() - new Date(a.lastTouch).getTime());
  }, [leads, activities, sequence]);

  const addTouchpoint = () => {
    const nextStep = sequence.length + 1;
    const t: Touchpoint = {
      id: `step-${Date.now()}`,
      step: nextStep,
      channel: "email",
      delayDays: 7 * nextStep,
      angle: "New angle",
      subject: "New follow-up subject",
      body: "Hi {{first_name}},\n\n— Z & C Consultants",
    };
    setSequence([...sequence, t]);
    setEditing(t);
  };

  const updateTouchpoint = (t: Touchpoint) => {
    setSequence(sequence.map((s) => (s.id === t.id ? t : s)));
    setEditing(t);
  };

  const removeTouchpoint = (id: string) => {
    if (!confirm("Remove this touchpoint?")) return;
    const next = sequence.filter((s) => s.id !== id).map((s, i) => ({ ...s, step: i + 1 }));
    setSequence(next);
    toast.success("Touchpoint removed");
  };

  const saveTouchpoint = () => {
    if (!editing) return;
    setSequence((prev) => prev.map((s) => (s.id === editing.id ? editing : s)));
    toast.success(`Step ${editing.step} saved`);
    setEditing(null);
  };

  const resetDefaults = () => {
    if (!confirm("Reset the follow-up sequence to defaults?")) return;
    setSequence(DEFAULT_SEQUENCE);
    toast.success("Sequence reset");
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tracker"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Tracker</TabsTrigger>
          <TabsTrigger value="sequence"><Settings2 className="w-3.5 h-3.5 mr-1.5" />Sequence</TabsTrigger>
          <TabsTrigger value="preview"><Eye className="w-3.5 h-3.5 mr-1.5" />Message Preview</TabsTrigger>
        </TabsList>

        {/* ============ TRACKER ============ */}
        <TabsContent value="tracker" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Enrolled" value={followedLeads.length} tone="primary" />
            <StatCard label="Step 1-2" value={followedLeads.filter(f => f.step <= 2).length} tone="sky" />
            <StatCard label="Step 3-4" value={followedLeads.filter(f => f.step >= 3 && f.step <= 4).length} tone="amber" />
            <StatCard label="Final stretch" value={followedLeads.filter(f => f.step >= 5).length} tone="emerald" />
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm">Leads in sequence</h3>
              <Badge variant="outline" className="text-[10px]">{followedLeads.length} contacts</Badge>
            </div>
            {followedLeads.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No leads have entered the follow-up sequence yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {followedLeads.map(({ lead, step, touches, lastTouch, nextDue }) => {
                  const tp = sequence[Math.min(sequence.length - 1, step - 1)];
                  return (
                    <button
                      key={lead.id}
                      onClick={() => onOpenLead(lead)}
                      className="w-full text-left px-5 py-3 hover:bg-muted/30 flex items-center gap-4 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-primary">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{lead.business_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[lead.industry, lead.city].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <div className="hidden md:flex flex-col items-end text-[11px] text-muted-foreground w-40">
                        <span>Last touch: {timeAgo(lastTouch)}</span>
                        {nextDue && <span>Next: {timeAgo(nextDue)}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-[10px]">
                          Step {step}/{sequence.length}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] hidden lg:inline-flex">
                          {tp?.angle}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {touches} touch{touches === 1 ? "" : "es"}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ============ SEQUENCE ============ */}
        <TabsContent value="sequence" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-sm">Sequence touchpoints</h3>
              <p className="text-xs text-muted-foreground">Configure each step in the follow-up cadence.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetDefaults}>Reset defaults</Button>
              <Button size="sm" onClick={addTouchpoint}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add touchpoint
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {sequence.map((t, i) => (
              <Card key={t.id} className="p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-display font-bold flex items-center justify-center">
                      {t.step}
                    </div>
                    {i < sequence.length - 1 && <div className="w-px h-6 bg-border" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-display font-semibold text-sm">{t.subject}</h4>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Mail className="w-3 h-3" />{t.channel}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="w-3 h-3" />
                        {t.delayDays === 0 ? "Day 0" : `+${t.delayDays}d`}
                      </Badge>
                      <Badge className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20">
                        {t.angle}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 whitespace-pre-wrap">
                      {t.body}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Dialog open={editing?.id === t.id} onOpenChange={(o) => !o && setEditing(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Edit</Button>
                      </DialogTrigger>
                      {editing?.id === t.id && (
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Step {editing.step} — {editing.angle}</DialogTitle>
                          </DialogHeader>
                          <TouchpointEditor t={editing} onChange={updateTouchpoint} onSave={saveTouchpoint} />
                        </DialogContent>
                      )}
                    </Dialog>
                    <Button size="sm" variant="ghost" onClick={() => removeTouchpoint(t.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ============ PREVIEW ============ */}
        <TabsContent value="preview" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview as:</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[220px]"
              value={previewLead?.id || ""}
              onChange={(e) => setPreviewLeadId(e.target.value)}
            >
              {leads.length === 0 && <option value="">(no leads — using sample data)</option>}
              {leads.slice(0, 100).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.business_name} {l.city ? `· ${l.city}` : ""}
                </option>
              ))}
            </select>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Sparkles className="w-3 h-3" />Live variable rendering
            </Badge>
          </div>

          <div className="space-y-4">
            {sequence.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-display font-bold text-xs flex items-center justify-center">
                      {t.step}
                    </div>
                    <span className="font-display font-semibold text-sm">{t.angle}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Clock className="w-3 h-3" />
                    {t.delayDays === 0 ? "Sent immediately" : `Sends ${t.delayDays} day${t.delayDays === 1 ? "" : "s"} after step ${t.step - 1}`}
                  </Badge>
                </div>
                <div className="p-5 space-y-3 bg-background">
                  <div className="flex items-center gap-2 pb-3 border-b border-border">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">ZC</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Z &amp; C Consultants</div>
                      <div className="text-[11px] text-muted-foreground">management@z-cconsultants.com → {previewLead?.email || "lead@example.com"}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</div>
                    <div className="text-base font-semibold mt-1">{renderVars(t.subject, previewLead)}</div>
                  </div>
                  <div>
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
                      {renderVars(t.body, previewLead)}
                    </pre>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TouchpointEditor({
  t, onChange, onSave,
}: { t: Touchpoint; onChange: (t: Touchpoint) => void; onSave: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Step</Label>
          <Input type="number" min={1} value={t.step} onChange={(e) => onChange({ ...t, step: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Delay (days)</Label>
          <Input type="number" min={0} value={t.delayDays} onChange={(e) => onChange({ ...t, delayDays: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Channel</Label>
          <select
            value={t.channel}
            onChange={(e) => onChange({ ...t, channel: e.target.value as Touchpoint["channel"] })}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="call">Call</option>
          </select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Angle / hook</Label>
        <Input value={t.angle} onChange={(e) => onChange({ ...t, angle: e.target.value })} placeholder="e.g. After-hours angle" />
      </div>
      <div>
        <Label className="text-xs">Subject</Label>
        <Input value={t.subject} onChange={(e) => onChange({ ...t, subject: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Body</Label>
        <Textarea rows={12} value={t.body} onChange={(e) => onChange({ ...t, body: e.target.value })} />
        <p className="text-[11px] text-muted-foreground mt-1">
          Variables: <code>{"{{first_name}}"}</code>, <code>{"{{company}}"}</code>, <code>{"{{city}}"}</code>
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={onSave}>Save touchpoint</Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "primary" | "sky" | "amber" | "emerald" }) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    sky: "bg-sky-500/10 text-sky-500",
    amber: "bg-amber-500/10 text-amber-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
  }[tone];
  return (
    <Card className="p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${toneClass}`}>in sequence</span>
      </div>
    </Card>
  );
}

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (Math.abs(diff) < 60) return "now";
  if (diff > 0 && diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff > 0 && diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 0 && diff > -86400 * 14) return `in ${Math.ceil(-diff / 86400)}d`;
  if (diff > 0 && diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
