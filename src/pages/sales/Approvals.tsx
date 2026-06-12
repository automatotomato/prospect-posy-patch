import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Approval = {
  id: string;
  lead_id: string;
  requested_by: string;
  subject: string;
  body: string;
  status: string;
  decision_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};
type LeadLite = { id: string; business_name: string; industry: string | null; city: string | null; state: string | null; email: string | null };

export default function Approvals() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useCurrentRole();
  const [items, setItems] = useState<Approval[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadLite>>({});
  const [requesters, setRequesters] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const load = async () => {
    const { data, error } = await supabase
      .from("email_approvals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    const list = (data || []) as Approval[];
    setItems(list);
    const leadIds = Array.from(new Set(list.map((i) => i.lead_id)));
    if (leadIds.length) {
      const { data: ld } = await supabase
        .from("sales_leads")
        .select("id, business_name, industry, city, state, email")
        .in("id", leadIds);
      const map: Record<string, LeadLite> = {};
      (ld || []).forEach((l: any) => (map[l.id] = l));
      setLeads(map);
    }
    const userIds = Array.from(new Set(list.map((i) => i.requested_by)));
    if (userIds.length) {
      const { data: tm } = await supabase.from("team_members").select("user_id, name, email").in("user_id", userIds);
      const map: Record<string, string> = {};
      (tm || []).forEach((m: any) => (map[m.user_id] = m.name || m.email));
      setRequesters(map);
    }
  };

  useEffect(() => { if (user && role?.isAdmin) load(); }, [user, role?.isAdmin]);

  if (!roleLoading && !role?.isAdmin) return <Navigate to="/sales" replace />;

  const editFor = (a: Approval) => edits[a.id] || { subject: a.subject, body: a.body };
  const setEdit = (id: string, patch: Partial<{ subject: string; body: string }>) =>
    setEdits((p) => ({ ...p, [id]: { ...editFor({ id, subject: "", body: "" } as any), ...p[id], ...patch }));

  const approve = async (a: Approval) => {
    const e = editFor(a);
    setBusy(a.id);
    // Persist any edits to the lead and mark contacted
    await supabase.from("sales_leads").update({
      email_subject: e.subject,
      email_body: e.body,
      email_generated_at: new Date().toISOString(),
      stage: "contacted",
      last_contacted_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    }).eq("id", a.lead_id);

    await supabase.from("sales_activities").insert({
      lead_id: a.lead_id, owner_id: user!.id, type: "email_approved",
      note: `Approved draft from ${requesters[a.requested_by] || "rep"}`,
    });

    const { error } = await supabase.from("email_approvals").update({
      status: "sent",
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
      subject: e.subject,
      body: e.body,
    }).eq("id", a.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Approved & logged as sent");
    load();
  };

  const reject = async (a: Approval) => {
    const note = prompt("Reason for rejection (optional)") || null;
    setBusy(a.id);
    const { error } = await supabase.from("email_approvals").update({
      status: "rejected",
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
      decision_note: note,
    }).eq("id", a.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    load();
  };

  const pending = items.filter((i) => i.status === "pending");
  const history = items.filter((i) => i.status !== "pending");
  const list = tab === "pending" ? pending : history;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button size="sm" variant={tab === "pending" ? "default" : "outline"} onClick={() => setTab("pending")}>
          Pending {pending.length > 0 && <Badge variant="secondary" className="ml-2">{pending.length}</Badge>}
        </Button>
        <Button size="sm" variant={tab === "history" ? "default" : "outline"} onClick={() => setTab("history")}>
          History
        </Button>
      </div>

      {list.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Mail className="w-6 h-6 mx-auto mb-2 opacity-60" />
          {tab === "pending" ? "No email drafts waiting for approval." : "No reviewed drafts yet."}
        </Card>
      )}

      {list.map((a) => {
        const lead = leads[a.lead_id];
        const e = editFor(a);
        return (
          <Card key={a.id} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-display font-semibold">
                  {lead?.business_name || "Lead removed"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[lead?.industry, lead?.city, lead?.state].filter(Boolean).join(" · ") || "—"}
                  {lead?.email && <> · {lead.email}</>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Requested by <span className="text-foreground">{requesters[a.requested_by] || "rep"}</span>
                  {" · "}{new Date(a.created_at).toLocaleString()}
                </div>
              </div>
              <Badge
                variant={a.status === "pending" ? "secondary" : a.status === "sent" ? "default" : "outline"}
                className="capitalize"
              >
                {a.status}
              </Badge>
            </div>

            {a.status === "pending" ? (
              <>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
                  <Input value={e.subject} onChange={(ev) => setEdit(a.id, { subject: ev.target.value })} className="bg-secondary border-border mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Body</label>
                  <Textarea rows={10} value={e.body} onChange={(ev) => setEdit(a.id, { body: ev.target.value })} className="bg-secondary border-border mt-1 font-mono text-sm" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => reject(a)} disabled={busy === a.id}>
                    <X className="w-4 h-4 mr-1" />Reject
                  </Button>
                  <Button onClick={() => approve(a)} disabled={busy === a.id}>
                    {busy === a.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Approve & send
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold">{a.subject}</div>
                <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground border border-border rounded-lg p-3 bg-secondary/40">{a.body}</pre>
                {a.decision_note && (
                  <p className="text-xs text-muted-foreground italic">Note: {a.decision_note}</p>
                )}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
