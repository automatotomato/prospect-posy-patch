import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, Trash2, Save, Building2, MapPin, MessageSquare, Users, X, Mail, Clock, RotateCcw, Eye } from "lucide-react";
import {
  DEFAULT_SEQUENCE,
  loadSequence,
  saveSequence,
  renderVars,
  TouchpointEditor,
  type Touchpoint,
} from "@/components/sales/FollowUpSequencePanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PermissionsDialog } from "@/components/sales/PermissionsDialog";
import { ShieldCheck } from "lucide-react";

type Template = { id: string; name: string; subject: string; body: string; category: string | null; is_default: boolean };
type Member = { id: string; email: string; name: string | null; role: string; accepted_at: string | null };


export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Discovery
  const [verticals, setVerticals] = useState<string[]>([]);
  const [excludedVerticals, setExcludedVerticals] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [targetCount, setTargetCount] = useState(50);
  const [newVertical, setNewVertical] = useState("");
  const [newExcluded, setNewExcluded] = useState("");
  const [newLocation, setNewLocation] = useState("");

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);

  // Team
  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "sales_rep">("sales_rep");

  // Sequence (live messages we actually send)
  const [sequence, setSequence] = useState<Touchpoint[]>(() => loadSequence());
  const [editingStep, setEditingStep] = useState<Touchpoint | null>(null);
  const [previewStepId, setPreviewStepId] = useState<string | null>(null);
  const [permsMember, setPermsMember] = useState<Member | null>(null);


  useEffect(() => { saveSequence(sequence); }, [sequence]);

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
    setIsAdmin(!!roleRow);

    const { data: discovery } = await supabase.from("agent_settings").select("setting_value").eq("setting_key", "discovery").maybeSingle();
    if (discovery?.setting_value) {
      const v = discovery.setting_value as any;
      setVerticals(v.verticals || []);
      setExcludedVerticals(v.excludedVerticals || []);
      setLocations(v.locations || []);
      setTargetCount(v.targetCount || 50);
    }

    const { data: tpls } = await supabase.from("email_templates").select("*").order("created_at", { ascending: false });
    setTemplates((tpls as Template[]) || []);

    const { data: mems } = await supabase.from("allowed_users").select("id, email, name, role, accepted_at").order("invited_at", { ascending: false });
    setMembers((mems as Member[]) || []);
    setLoading(false);
  }

  async function saveDiscovery() {
    const { error } = await supabase.from("agent_settings").update({
      setting_value: { verticals, excludedVerticals, locations, targetCount, rotateCities: true } as any,
    }).eq("setting_key", "discovery");
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Discovery settings saved" });
  }

  async function saveTemplate() {
    if (!editing) return;
    if (!editing.name || !editing.subject || !editing.body) {
      return toast({ title: "All fields required", variant: "destructive" });
    }
    if (editing.id) {
      const { error } = await supabase.from("email_templates").update({
        name: editing.name, subject: editing.subject, body: editing.body, category: editing.category,
      }).eq("id", editing.id);
      if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("email_templates").insert({
        name: editing.name, subject: editing.subject, body: editing.body, category: editing.category, is_default: false,
      });
      if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
    toast({ title: "Template saved" });
    setEditing(null);
    void loadAll();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Template deleted" });
    void loadAll();
  }

  async function addMember() {
    if (!newMemberEmail.trim()) return toast({ title: "Email required", variant: "destructive" });
    const { error } = await supabase.from("allowed_users").insert({
      email: newMemberEmail.trim().toLowerCase(),
      name: newMemberName.trim() || null,
      role: newMemberRole as any,
      invited_by: user!.id,
    });
    if (error) return toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    toast({ title: "Team member invited", description: "They can sign in with this email." });
    setNewMemberEmail(""); setNewMemberName(""); setNewMemberRole("sales_rep");
    void loadAll();
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this team member?")) return;
    const { error } = await supabase.from("allowed_users").delete().eq("id", id);
    if (error) return toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    toast({ title: "Member removed" });
    void loadAll();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/sales")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
          <div>
            <h1 className="font-display text-lg font-semibold">Settings</h1>
            <p className="text-xs text-muted-foreground">Configure discovery, messaging, and team access</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-8">
        <Tabs defaultValue="discovery" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-xl">
            <TabsTrigger value="discovery"><Building2 className="w-4 h-4 mr-2" />Discovery</TabsTrigger>
            <TabsTrigger value="messaging"><MessageSquare className="w-4 h-4 mr-2" />Messaging</TabsTrigger>
            <TabsTrigger value="team"><Users className="w-4 h-4 mr-2" />Team</TabsTrigger>
          </TabsList>

          {/* DISCOVERY */}
          <TabsContent value="discovery" className="space-y-6">
            <Card className="p-6 space-y-6">
              <div>
                <h2 className="font-display text-base font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Verticals</h2>
                <p className="text-xs text-muted-foreground mt-1">Industries to target during lead discovery</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {verticals.map((v) => (
                    <Badge key={v} variant="secondary" className="gap-1.5 py-1.5 px-3">
                      {v}
                      {isAdmin && <button onClick={() => setVerticals(verticals.filter(x => x !== v))}><X className="w-3 h-3" /></button>}
                    </Badge>
                  ))}
                  {verticals.length === 0 && <span className="text-xs text-muted-foreground">No verticals yet</span>}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-4">
                    <Input placeholder="e.g. manufacturing" value={newVertical} onChange={e => setNewVertical(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newVertical.trim()) { setVerticals([...verticals, newVertical.trim()]); setNewVertical(""); } }} />
                    <Button onClick={() => { if (newVertical.trim()) { setVerticals([...verticals, newVertical.trim()]); setNewVertical(""); } }}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-6">
                <h2 className="font-display text-base font-semibold flex items-center gap-2"><X className="w-4 h-4 text-destructive" />Excluded verticals</h2>
                <p className="text-xs text-muted-foreground mt-1">Industries to skip during discovery — businesses unlikely to need Power BI, MS Fabric, or data automation work (e.g. landscaping, construction, salons). Matches any business name, type, or vertical containing these keywords.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {excludedVerticals.map((v) => (
                    <Badge key={v} variant="outline" className="gap-1.5 py-1.5 px-3 border-destructive/40 text-destructive">
                      {v}
                      {isAdmin && <button onClick={() => setExcludedVerticals(excludedVerticals.filter(x => x !== v))}><X className="w-3 h-3" /></button>}
                    </Badge>
                  ))}
                  {excludedVerticals.length === 0 && <span className="text-xs text-muted-foreground">No exclusions yet</span>}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-4">
                    <Input placeholder="e.g. landscaping, construction, salon" value={newExcluded} onChange={e => setNewExcluded(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newExcluded.trim()) { setExcludedVerticals([...excludedVerticals, newExcluded.trim().toLowerCase()]); setNewExcluded(""); } }} />
                    <Button variant="outline" onClick={() => { if (newExcluded.trim()) { setExcludedVerticals([...excludedVerticals, newExcluded.trim().toLowerCase()]); setNewExcluded(""); } }}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-6">
                <h2 className="font-display text-base font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Locations</h2>
                <p className="text-xs text-muted-foreground mt-1">Cities to rotate through</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {locations.map((l) => (
                    <Badge key={l} variant="secondary" className="gap-1.5 py-1.5 px-3">
                      {l}
                      {isAdmin && <button onClick={() => setLocations(locations.filter(x => x !== l))}><X className="w-3 h-3" /></button>}
                    </Badge>
                  ))}
                  {locations.length === 0 && <span className="text-xs text-muted-foreground">No locations yet</span>}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-4">
                    <Input placeholder="e.g. Las Vegas, NV" value={newLocation} onChange={e => setNewLocation(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newLocation.trim()) { setLocations([...locations, newLocation.trim()]); setNewLocation(""); } }} />
                    <Button onClick={() => { if (newLocation.trim()) { setLocations([...locations, newLocation.trim()]); setNewLocation(""); } }}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-6 grid grid-cols-2 gap-4 max-w-md">
                <div>
                  <Label htmlFor="targetCount">Target leads per run</Label>
                  <Input id="targetCount" type="number" min={1} max={500} value={targetCount} onChange={e => setTargetCount(Number(e.target.value))} disabled={!isAdmin} />
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button onClick={saveDiscovery}><Save className="w-4 h-4 mr-2" />Save discovery</Button>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* MESSAGING */}
          <TabsContent value="messaging" className="space-y-8">
            {/* Live outreach sequence — the actual messages we send */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-display text-base font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />Outreach sequence
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    These are the exact messages sent to every new lead. Edit any step to fine-tune subject, timing, and wording.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      if (!confirm("Reset all messages to the Z & C defaults?")) return;
                      setSequence(DEFAULT_SEQUENCE);
                      toast({ title: "Sequence reset to defaults" });
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const nextStep = sequence.length + 1;
                      const t: Touchpoint = {
                        id: `step-${Date.now()}`,
                        step: nextStep,
                        channel: "email",
                        delayDays: 4 * nextStep,
                        angle: "New angle",
                        subject: "New follow-up subject",
                        body: "Hi {{first_name}},\n\n— Z & C Consultants",
                      };
                      setSequence([...sequence, t]);
                      setEditingStep(t);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />Add step
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {sequence.map((t, i) => (
                  <Card key={t.id} className="p-5 hover:border-primary/30 transition-colors">
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
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">
                          {t.body}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setPreviewStepId(t.id)} title="Preview">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingStep(t)}>Edit</Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => {
                            if (!confirm(`Remove step ${t.step}?`)) return;
                            setSequence(sequence.filter(s => s.id !== t.id).map((s, idx) => ({ ...s, step: idx + 1 })));
                            toast({ title: "Step removed" });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Edit dialog */}
              <Dialog open={!!editingStep} onOpenChange={(o) => !o && setEditingStep(null)}>
                {editingStep && (
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Step {editingStep.step} — fine-tune message</DialogTitle>
                    </DialogHeader>
                    <TouchpointEditor
                      t={editingStep}
                      onChange={(t) => {
                        setEditingStep(t);
                        setSequence((prev) => prev.map((s) => (s.id === t.id ? t : s)));
                      }}
                      onSave={() => {
                        toast({ title: `Step ${editingStep.step} saved` });
                        setEditingStep(null);
                      }}
                    />
                  </DialogContent>
                )}
              </Dialog>

              {/* Preview dialog */}
              <Dialog open={!!previewStepId} onOpenChange={(o) => !o && setPreviewStepId(null)}>
                {previewStepId && (() => {
                  const t = sequence.find((s) => s.id === previewStepId);
                  if (!t) return null;
                  const sample = { business_name: "Acme Logistics", city: "Dallas" };
                  return (
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Preview · Step {t.step} — {t.angle}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-3 border-b border-border">
                          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">ZC</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">Z &amp; C Consultants</div>
                            <div className="text-[11px] text-muted-foreground">management@z-cconsultants.com → lead@acme-logistics.com</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</div>
                          <div className="text-base font-semibold mt-1">{renderVars(t.subject, sample)}</div>
                        </div>
                        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
                          {renderVars(t.body, sample)}
                        </pre>
                      </div>
                    </DialogContent>
                  );
                })()}
              </Dialog>
            </div>

            {/* Saved templates library (separate from active sequence) */}
            <div className="space-y-4 border-t border-border pt-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-display text-base font-semibold">Saved template library</h2>
                  <p className="text-xs text-muted-foreground">Optional snippets you can reuse when drafting one-off emails.</p>
                </div>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setEditing({ id: "", name: "", subject: "", body: "", category: "outreach", is_default: false })}>
                    <Plus className="w-4 h-4 mr-2" />New template
                  </Button>
                )}
              </div>

              {editing && (
                <Card className="p-6 space-y-4 border-primary/30">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">{editing.id ? "Edit template" : "New template"}</h3>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Cold intro v1" />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input value={editing.category || ""} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="outreach / follow-up" />
                    </div>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Input value={editing.subject} onChange={e => setEditing({ ...editing, subject: e.target.value })} placeholder="Quick idea for {{company}}" />
                  </div>
                  <div>
                    <Label>Body</Label>
                    <Textarea rows={10} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} placeholder="Hi {{first_name}}, ..." />
                    <p className="text-[11px] text-muted-foreground mt-1">Variables: <code>{"{{first_name}}"}</code>, <code>{"{{company}}"}</code>, <code>{"{{city}}"}</code></p>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={saveTemplate}><Save className="w-4 h-4 mr-2" />Save template</Button>
                  </div>
                </Card>
              )}

              <div className="space-y-3">
                {templates.length === 0 && (
                  <Card className="p-6 text-center text-xs text-muted-foreground">No saved templates yet.</Card>
                )}
                {templates.map(t => (
                  <Card key={t.id} className="p-5 flex items-start justify-between gap-4 hover:border-primary/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold">{t.name}</h3>
                        {t.category && <Badge variant="outline" className="text-[10px]">{t.category}</Badge>}
                        {t.is_default && <Badge className="text-[10px]">Default</Badge>}
                      </div>
                      <p className="text-sm font-medium mt-1">{t.subject}</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{t.body}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setEditing(t)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteTemplate(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* TEAM */}
          <TabsContent value="team" className="space-y-6">
            {isAdmin && (
              <Card className="p-6 space-y-4">
                <div>
                  <h2 className="font-display text-base font-semibold">Invite team member</h2>
                  <p className="text-xs text-muted-foreground">They can sign in with this email using the 8-digit code flow.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input placeholder="Full name" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} />
                  <Input placeholder="email@company.com" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} className="md:col-span-2" />
                  <select
                    value={newMemberRole}
                    onChange={e => setNewMemberRole(e.target.value as any)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="sales_rep">Sales rep</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <Button onClick={addMember}><Plus className="w-4 h-4 mr-2" />Add member</Button>
                </div>
              </Card>
            )}

            <Card className="divide-y divide-border">
              <div className="p-4 grid grid-cols-12 gap-4 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <div className="col-span-4">Name</div>
                <div className="col-span-4">Email</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2 text-right">Status</div>
              </div>
              {members.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No team members yet.</div>}
              {members.map(m => (
                <div key={m.id} className="p-4 grid grid-cols-12 gap-4 items-center text-sm hover:bg-muted/40 transition-colors">
                  <div className="col-span-4 font-medium">{m.name || "—"}</div>
                  <div className="col-span-4 text-muted-foreground truncate">{m.email}</div>
                  <div className="col-span-2"><Badge variant="outline" className="text-[10px]">{m.role}</Badge></div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <Badge variant={m.accepted_at ? "default" : "secondary"} className="text-[10px]">
                      {m.accepted_at ? "Active" : "Pending"}
                    </Badge>
                    {isAdmin && (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setPermsMember(m)}
                        className="h-7 gap-1"
                        title="Edit permissions"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Permissions</span>
                      </Button>
                    )}
                    {isAdmin && (
                      <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>

        <PermissionsDialog
          open={!!permsMember}
          onOpenChange={(v) => { if (!v) setPermsMember(null); }}
          member={permsMember}
          onSaved={() => void loadAll()}
        />
      </main>

    </div>
  );
}
