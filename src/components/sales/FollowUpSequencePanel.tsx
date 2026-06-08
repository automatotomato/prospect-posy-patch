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
    id: "step-1", step: 1, channel: "email", delayDays: 0, angle: "Intro / value",
    subject: "Quick idea for {{company}}",
    body:
`Hi {{first_name}},

Saw {{company}} is running operations out of {{city}} — wanted to share something we've been doing with similar shops.

We deploy an AI receptionist that answers every call in under 2 rings (24/7, 72 languages) so quotes don't go to voicemail. Most clients recover $40-$200 per missed call.

Worth a 15-min look? https://calendly.com/automateplanet/15

— Alex Perez
Automate Planet | (702) 863-3200`,
  },
  {
    id: "step-2", step: 2, channel: "email", delayDays: 3, angle: "After-hours angle",
    subject: "Re: Quick idea for {{company}}",
    body:
`Hey {{first_name}} — quick follow-up.

60-70% of inbound calls hit small businesses outside 9-5. If {{company}} is anything like the rest of {{city}}, that's a lot of jobs walking next door.

Our AI picks up nights, weekends, and lunch hours, then texts you the lead within 30 seconds.

Want me to send a 90-sec demo recording?

— Alex`,
  },
  {
    id: "step-3", step: 3, channel: "email", delayDays: 7, angle: "Cost of VAs",
    subject: "$1.5k VAs that still miss calls",
    body:
`{{first_name}},

Most owners I talk to in {{city}} are paying $1,500-$3,000/mo on a VA or answering service — and still losing calls when the VA is on break or on another line.

Our setup is one flat fee, never on break, never sleeping. Captures every call, books on your calendar, dispatches to the on-call crew.

Open to comparing numbers side-by-side?

— Alex`,
  },
  {
    id: "step-4", step: 4, channel: "email", delayDays: 14, angle: "Crew on job / win story",
    subject: "How a {{city}} shop booked 2x more jobs",
    body:
`{{first_name}},

Quick story: one of our {{city}} clients had their crew tied up on a job, missed 11 inbound calls in 4 hours. After we plugged in the AI, they recovered 9 of those calls the same week — booked 4.

Want to see how it handled the conversations? I can share the transcripts.

— Alex
(702) 863-3200`,
  },
  {
    id: "step-5", step: 5, channel: "email", delayDays: 21, angle: "Risk-free trial",
    subject: "500 free calls on us",
    body:
`{{first_name}},

We're running a no-risk pilot: 500 calls handled on us, no contract.

If you don't book at least 3 new jobs from those calls, you walk. Most shops in {{city}} clear that in the first 5 days.

Grab a 15-min slot here if you want in: https://calendly.com/automateplanet/15

— Alex`,
  },
  {
    id: "step-6", step: 6, channel: "email", delayDays: 30, angle: "Breakup",
    subject: "Should I close your file?",
    body:
`{{first_name}},

Haven't heard back so I'll stop reaching out. If this isn't the right time, no hard feelings.

If anything changes and you want to stop losing calls, my cell is (702) 863-3200.

Wishing {{company}} a strong quarter.

— Alex`,
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
      body: "Hi {{first_name}},\n\n— Alex",
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
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">AP</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Alex Perez</div>
                      <div className="text-[11px] text-muted-foreground">alex@automateplanet.com → {previewLead?.email || "lead@example.com"}</div>
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
