import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Plus, Play, Pause, Trash2, RefreshCw, ChevronRight, Users, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "./ClientsPanel";

type CampaignStatus = "draft" | "active" | "paused" | "completed";

type CampaignStep = {
  id?: string;
  step_order: number;
  delay_days: number;
  subject: string;
  body: string;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  created_at: string;
  started_at: string | null;
};

type CampaignDetail = Campaign & {
  steps: CampaignStep[];
  recipientCount: number;
};

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  completed: "bg-sky-500/10 text-sky-400 border-sky-500/30",
};

export function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<CampaignDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, description, status, created_at, started_at, campaign_steps(id, step_order, delay_days, subject, body), campaign_recipients(id)")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const mapped: CampaignDetail[] = (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status,
      created_at: c.created_at,
      started_at: c.started_at,
      steps: (c.campaign_steps || []).sort((a: any, b: any) => a.step_order - b.step_order),
      recipientCount: (c.campaign_recipients || []).length,
    }));
    setCampaigns(mapped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: CampaignStatus) => {
    const patch: any = { status };
    if (status === "active") patch.started_at = new Date().toISOString();
    const { error } = await supabase.from("campaigns").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Campaign ${status}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campaign deleted");
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm">Campaigns</h3>
            <p className="text-xs text-muted-foreground">
              Multi-step drip sequences for your contacts
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />New campaign
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="p-10 text-center">
            <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No campaigns yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a multi-step drip to reach your contacts.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {campaigns.map((c) => (
              <li key={c.id} className="px-4 md:px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{c.name}</span>
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${STATUS_STYLES[c.status]}`}>{c.status}</Badge>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.steps.length} step{c.steps.length === 1 ? "" : "s"}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.recipientCount} recipient{c.recipientCount === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.status !== "active" && (
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => setStatus(c.id, "active")}>
                        <Play className="w-3.5 h-3.5" />Start
                      </Button>
                    )}
                    {c.status === "active" && (
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => setStatus(c.id, "paused")}>
                        <Pause className="w-3.5 h-3.5" />Pause
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setOpenId(c.id)}>
                      Edit <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={load}
      />
      {openId && (
        <CampaignDialog
          campaignId={openId}
          open={!!openId}
          onOpenChange={(v) => !v && setOpenId(null)}
          onDone={load}
        />
      )}
    </div>
  );
}

function CampaignDialog({ campaignId, open, onOpenChange, onDone, presetName, presetDescription, presetClientIds }: {
  campaignId?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
  presetName?: string;
  presetDescription?: string;
  presetClientIds?: string[];
}) {
  const isEdit = !!campaignId;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<CampaignStep[]>([
    { step_order: 1, delay_days: 0, subject: "", body: "" },
  ]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: cdata } = await supabase
        .from("clients")
        .select("*")
        .order("business_name");
      setClients((cdata as Client[]) || []);

      if (isEdit && campaignId) {
        const { data } = await supabase
          .from("campaigns")
          .select("name, description, campaign_steps(id, step_order, delay_days, subject, body), campaign_recipients(client_id)")
          .eq("id", campaignId)
          .single();
        if (data) {
          setName(data.name);
          setDescription(data.description || "");
          const loadedSteps = ((data as any).campaign_steps || [])
            .sort((a: any, b: any) => a.step_order - b.step_order);
          setSteps(loadedSteps.length ? loadedSteps : [{ step_order: 1, delay_days: 0, subject: "", body: "" }]);
          const enrolled = new Set<string>(((data as any).campaign_recipients || []).map((r: any) => r.client_id));
          setEnrolledIds(enrolled);
          setSelectedClientIds(new Set(enrolled));
        }
      } else {
        setName(presetName || ""); setDescription(presetDescription || "");
        setSteps([{ step_order: 1, delay_days: 0, subject: "", body: "" }]);
        setSelectedClientIds(new Set(presetClientIds || []));
        setEnrolledIds(new Set());
      }
    })();
  }, [open, campaignId, isEdit, presetName, presetDescription, presetClientIds]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.business_name, c.contact_name, c.email].some((f) => (f || "").toLowerCase().includes(q))
    );
  }, [clients, search]);

  const addStep = () => {
    setSteps((prev) => [...prev, {
      step_order: prev.length + 1,
      delay_days: 3,
      subject: "",
      body: "",
    }]);
  };

  const updateStep = (i: number, patch: Partial<CampaignStep>) => {
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const removeStep = (i: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_order: idx + 1 })));
  };

  const toggleClient = (id: string) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (steps.some((s) => !s.subject.trim() || !s.body.trim())) {
      return toast.error("Every step needs a subject and body");
    }
    setSaving(true);

    let id = campaignId;
    if (!isEdit) {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ name: name.trim(), description: description.trim() || null, status: "draft" })
        .select("id")
        .single();
      if (error || !data) { setSaving(false); return toast.error(error?.message || "Insert failed"); }
      id = data.id;
    } else {
      const { error } = await supabase
        .from("campaigns")
        .update({ name: name.trim(), description: description.trim() || null })
        .eq("id", campaignId!);
      if (error) { setSaving(false); return toast.error(error.message); }
    }

    // Replace steps
    await supabase.from("campaign_steps").delete().eq("campaign_id", id!);
    const stepsPayload = steps.map((s, idx) => ({
      campaign_id: id!,
      step_order: idx + 1,
      delay_days: Number(s.delay_days) || 0,
      subject: s.subject.trim(),
      body: s.body.trim(),
    }));
    if (stepsPayload.length) {
      const { error: serr } = await supabase.from("campaign_steps").insert(stepsPayload);
      if (serr) { setSaving(false); return toast.error(serr.message); }
    }

    // Sync recipients
    const toAdd = [...selectedClientIds].filter((cid) => !enrolledIds.has(cid));
    const toRemove = [...enrolledIds].filter((cid) => !selectedClientIds.has(cid));

    if (toAdd.length) {
      const firstDelay = Number(steps[0]?.delay_days || 0);
      const nextSend = new Date(Date.now() + firstDelay * 24 * 60 * 60 * 1000).toISOString();
      const recPayload = toAdd.map((client_id) => ({
        campaign_id: id!,
        client_id,
        status: "pending" as const,
        current_step: 0,
        next_send_at: nextSend,
      }));
      const { error: rerr } = await supabase.from("campaign_recipients").insert(recPayload);
      if (rerr) { setSaving(false); return toast.error(rerr.message); }
    }
    if (toRemove.length) {
      await supabase.from("campaign_recipients")
        .delete()
        .eq("campaign_id", id!)
        .in("client_id", toRemove);
    }

    setSaving(false);
    toast.success(isEdit ? "Campaign updated" : "Campaign created");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            Build a multi-step email sequence and enroll contacts. You can use{" "}
            <code className="text-xs">{"{{business_name}}"}</code> and{" "}
            <code className="text-xs">{"{{contact_name}}"}</code> in the subject and body.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q1 re-engagement" className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wider">Steps</Label>
              <Button size="sm" variant="outline" onClick={addStep} className="gap-1 h-8">
                <Plus className="w-3.5 h-3.5" />Add step
              </Button>
            </div>
            <div className="space-y-3">
              {steps.map((s, i) => (
                <div key={i} className="border border-border rounded-lg p-3 bg-secondary/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Step {i + 1}
                    </span>
                    {steps.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStep(i)}>
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  <div className="grid md:grid-cols-[100px_1fr] gap-2 mb-2">
                    <div>
                      <Label className="text-[10px]">Delay (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={s.delay_days}
                        onChange={(e) => updateStep(i, { delay_days: Number(e.target.value) })}
                        className="bg-background border-border h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Subject</Label>
                      <Input
                        value={s.subject}
                        onChange={(e) => updateStep(i, { subject: e.target.value })}
                        className="bg-background border-border h-9"
                        placeholder="Subject line"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Body</Label>
                    <Textarea
                      value={s.body}
                      onChange={(e) => updateStep(i, { body: e.target.value })}
                      className="bg-background border-border min-h-[110px] font-mono text-xs"
                      placeholder="Hi {{contact_name}}, ..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wider">
                Recipients <span className="text-muted-foreground normal-case ml-1">({selectedClientIds.size} selected)</span>
              </Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="bg-secondary border-border h-8 w-48"
              />
            </div>
            {clients.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
                Upload contacts first in the Contacts tab.
              </div>
            ) : (
              <div className="border border-border rounded-lg max-h-60 overflow-y-auto divide-y divide-border">
                {filteredClients.map((c) => {
                  const selected = selectedClientIds.has(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer text-xs">
                      <Checkbox checked={selected} onCheckedChange={() => toggleClient(c.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.business_name}</div>
                        <div className="text-muted-foreground truncate">
                          {[c.contact_name, c.email].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      {!c.email && <Badge variant="outline" className="text-[9px]">no email</Badge>}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</> : <><Send className="w-4 h-4" />{isEdit ? "Save changes" : "Create campaign"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
