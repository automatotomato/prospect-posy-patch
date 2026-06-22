import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, RefreshCw, Save, Search, Mail } from "lucide-react";
import { toast } from "sonner";

type LeadDraft = {
  id: string;
  business_name: string;
  email: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  stage: string | null;
  email_subject: string | null;
  email_body: string | null;
  email_generated_at: string | null;
};

export function AIDraftsPanel() {
  const [leads, setLeads] = useState<LeadDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales_leads")
      .select("id,business_name,email,industry,city,state,stage,email_subject,email_body,email_generated_at")
      .not("email_subject", "is", null)
      .order("email_generated_at", { ascending: false })
      .limit(500);
    if (error) { toast.error(error.message); setLoading(false); return; }
    setLeads((data || []) as LeadDraft[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.business_name, l.email, l.industry, l.city, l.state, l.email_subject].some(
        (f) => (f || "").toLowerCase().includes(q)
      )
    );
  }, [leads, search]);

  const active = useMemo(() => leads.find((l) => l.id === activeId) || null, [leads, activeId]);

  useEffect(() => {
    if (active) {
      setSubject(active.email_subject || "");
      setBody(active.email_body || "");
    }
  }, [activeId]);

  const save = async () => {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("sales_leads")
      .update({ email_subject: subject, email_body: body })
      .eq("id", active.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Draft updated");
    setLeads((prev) => prev.map((l) => l.id === active.id ? { ...l, email_subject: subject, email_body: body } : l));
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 md:px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm">AI-Drafted Emails</h3>
            <p className="text-xs text-muted-foreground">
              Review and edit emails the AI prepared for your leads
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drafts…"
              className="bg-secondary border-border h-9 pl-8 w-56"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center">
          <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No AI drafts yet</p>
          <p className="text-xs text-muted-foreground mt-1">Run the lead scout to generate personalized drafts.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[320px_1fr]">
          <ScrollArea className="h-[520px] border-r border-border">
            <ul className="divide-y divide-border">
              {filtered.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setActiveId(l.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-secondary/50 transition ${activeId === l.id ? "bg-secondary" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{l.business_name}</span>
                      {l.stage && <Badge variant="outline" className="text-[10px] shrink-0">{l.stage}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{l.email_subject}</p>
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                      {[l.industry, l.city, l.state].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>

          {active ? (
            <div className="p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{active.business_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{active.email}</p>
                </div>
                <Button size="sm" onClick={save} disabled={saving} className="gap-2">
                  <Save className="w-3.5 h-3.5" />{saving ? "Saving…" : "Save"}
                </Button>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  className="bg-secondary border-border font-mono text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Select a draft to edit
            </div>
          )}
        </div>
      )}
    </div>
  );
}
