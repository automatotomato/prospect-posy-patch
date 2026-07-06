import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LeadOrigin = "mine" | "ai";
export type LeadType = "direct" | "general";

export type Lead = {
  id: string;
  business_name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  status: string;
  stage: string;
  email_subject: string | null;
  email_body: string | null;
  email_generated_at: string | null;
  queued_at: string | null;
  last_contacted_at: string | null;
  follow_up_at: string | null;
  contact_count: number;
  last_activity_at: string | null;
  created_at: string;
  assigned_to: string | null;
  origin: LeadOrigin | null;
  lead_type: LeadType | null;
  source: string | null;
};

// Generic mailbox prefixes — used as a client-side fallback to compute lead_type
// if a row was inserted before the backfill (defense in depth).
const GENERIC_PREFIXES = new Set([
  "info","sales","hello","contact","support","admin","office","hr",
  "marketing","billing","careers","team","help","no-reply","noreply",
  "accounts","accounting","service","services","enquiries","inquiries",
  "general","reception","front-desk","frontdesk","feedback","press","media",
]);

export function computeLeadType(email: string | null | undefined): LeadType {
  if (!email) return "general";
  const local = email.trim().toLowerCase().split("@")[0] || "";
  return GENERIC_PREFIXES.has(local) ? "general" : "direct";
}

export function effectiveLeadType(l: Pick<Lead, "lead_type" | "email">): LeadType {
  return l.lead_type ?? computeLeadType(l.email);
}

export function effectiveOrigin(l: Pick<Lead, "origin" | "source">): LeadOrigin {
  if (l.origin) return l.origin;
  return l.source === "my_contacts" || l.source === "upload" || l.source === "scan" || l.source === "business_card" ? "mine" : "ai";
}


export type Activity = {
  id: string;
  lead_id: string;
  owner_id: string;
  type: string;
  note: string | null;
  metadata: any;
  created_at: string;
};

// Single source of truth for "has this lead been worked yet?"
export function wasContacted(l: Pick<Lead, "contact_count" | "last_contacted_at" | "stage">): boolean {
  if ((l.contact_count || 0) > 0) return true;
  if (l.last_contacted_at) return true;
  return ["contacted", "follow_up", "replied", "won", "lost"].includes(l.stage);
}

// Presentation-only: if the lead has been emailed/contacted but its DB stage is still "new",
// show it as "contacted" so the badge doesn't lie.
export function displayStageOf(l: Pick<Lead, "contact_count" | "last_contacted_at" | "stage">): string {
  if (l.stage === "new" && wasContacted(l)) return "contacted";
  return l.stage;
}

export const STAGES = [
  { id: "new", label: "New" },
  { id: "queued", label: "Queued" },
  { id: "contacted", label: "Contacted" },
  { id: "follow_up", label: "Follow-up" },
  { id: "replied", label: "Replied" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;

export function useSalesLeads(userId: string | undefined) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Paginate sales_leads to bypass the 1000-row default limit
    const pageSize = 1000;
    let offset = 0;
    let all: Lead[] = [];
    let leadsError: any = null;
    while (true) {
      const { data, error } = await supabase
        .from("sales_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) { leadsError = error; break; }
      const rows = (data as Lead[]) || [];
      all = all.concat(rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    // Paginate activities so counts on Activity page reflect reality (not a 200-row cap)
    let aOffset = 0;
    let allActs: Activity[] = [];
    let actErr: any = null;
    while (true) {
      const { data, error } = await supabase
        .from("sales_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .range(aOffset, aOffset + pageSize - 1);
      if (error) { actErr = error; break; }
      const rows = (data as Activity[]) || [];
      allActs = allActs.concat(rows);
      if (rows.length < pageSize) break;
      aOffset += pageSize;
    }
    if (leadsError) toast.error(leadsError.message); else setLeads(all);
    if (actErr) toast.error(actErr.message); else setActivities(allActs);
    setLoading(false);
  }, []);

  useEffect(() => { if (userId) load(); }, [userId, load]);

  const logActivity = useCallback(async (lead_id: string, type: string, note?: string, metadata?: any) => {
    if (!userId) return;
    const { data, error } = await supabase.from("sales_activities").insert({
      lead_id, owner_id: userId, type, note: note ?? null, metadata: metadata ?? null,
    }).select().single();
    if (error) toast.error(error.message);
    else if (data) setActivities((p) => [data as Activity, ...p]);
  }, [userId]);

  const updateLead = useCallback(async (id: string, patch: Partial<Lead>) => {
    const { data, error } = await supabase.from("sales_leads").update({
      ...patch, last_activity_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (error) { toast.error(error.message); return null; }
    setLeads((p) => p.map((l) => (l.id === id ? (data as Lead) : l)));
    return data as Lead;
  }, []);

  const setStage = useCallback(async (lead: Lead, stage: string, extraNote?: string) => {
    const now = new Date().toISOString();
    const patch: Partial<Lead> = { stage };
    if (stage === "queued") patch.queued_at = now;
    if (stage === "contacted") {
      patch.last_contacted_at = now;
      patch.contact_count = (lead.contact_count || 0) + 1;
      // auto-schedule a 4-day follow-up if not already past it
      const fu = new Date(); fu.setDate(fu.getDate() + 4);
      patch.follow_up_at = fu.toISOString();
    }
    if (stage === "replied" || stage === "won" || stage === "lost") {
      patch.follow_up_at = null;
    }
    await updateLead(lead.id, patch);
    await logActivity(lead.id, `stage:${stage}`, extraNote);
  }, [updateLead, logActivity]);

  const scheduleFollowUp = useCallback(async (lead: Lead, days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    await updateLead(lead.id, { follow_up_at: d.toISOString(), stage: "follow_up" });
    await logActivity(lead.id, "follow_up_scheduled", `In ${days} days`, { days });
  }, [updateLead, logActivity]);

  const removeLead = useCallback(async (id: string) => {
    const { error } = await supabase.from("sales_leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setLeads((p) => p.filter((l) => l.id !== id));
  }, []);

  const stats = useMemo(() => {
    const by: Record<string, number> = {};
    STAGES.forEach((s) => (by[s.id] = 0));
    leads.forEach((l) => { by[l.stage] = (by[l.stage] || 0) + 1; });
    const now = Date.now();
    const dueFollowUps = leads.filter((l) => l.follow_up_at && new Date(l.follow_up_at).getTime() <= now && !["replied","won","lost"].includes(l.stage)).length;
    const contactedEver = leads.filter(wasContacted).length;
    const notContacted = leads.length - contactedEver;
    const inSequence = leads.filter((l) => (l.contact_count || 0) > 0 || !!l.last_contacted_at).length;
    return { by, total: leads.length, dueFollowUps, contactedEver, notContacted, inSequence };
  }, [leads]);

  return { leads, setLeads, activities, loading, load, logActivity, updateLead, setStage, scheduleFollowUp, removeLead, stats };
}
