import { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  LogOut, Sparkles, Search, Clock, Users, Activity as ActivityIcon,
  LayoutDashboard, Kanban, Settings as SettingsIcon, Bell, Building2, HelpCircle, Menu,
  Mail, ChevronDown, ShieldCheck,
} from "lucide-react";
import { useSalesLeads, type Lead, STAGES } from "@/hooks/useSalesLeads";
import { ScanCardDialog } from "@/components/sales/ScanCardDialog";
import { SalesContext, BulkBar, LeadDrawer } from "./_shared";
import { usePermissions } from "@/hooks/usePermissions";


export default function SalesLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { leads, setLeads, activities, loading, load, logActivity, setStage, scheduleFollowUp, removeLead, stats } =
    useSalesLeads(user?.id);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());

  const bulkDelete = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} lead${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    const { error } = await supabase.from("sales_leads").delete().in("id", ids);
    if (error) return toast.error(error.message);
    setLeads((p) => p.filter((l) => !ids.includes(l.id)));
    clearSelection();
    toast.success(`Deleted ${ids.length} leads`);
  };

  const bulkSetStage = async (ids: string[], stage: string) => {
    if (!ids.length) return;
    const patch: any = { stage, last_activity_at: new Date().toISOString() };
    if (stage === "queued") patch.queued_at = new Date().toISOString();
    const { data, error } = await supabase.from("sales_leads").update(patch).in("id", ids).select();
    if (error) return toast.error(error.message);
    const map = new Map((data as Lead[]).map((d) => [d.id, d]));
    setLeads((p) => p.map((l) => map.get(l.id) || l));
    clearSelection();
    toast.success(`Moved ${ids.length} leads to ${STAGES.find((s) => s.id === stage)?.label || stage}`);
  };

  const bulkUpdate = async (ids: string[], patch: Partial<Lead>) => {
    if (!ids.length) return;
    const fullPatch: any = { ...patch, last_activity_at: new Date().toISOString() };
    const { data, error } = await supabase.from("sales_leads").update(fullPatch).in("id", ids).select();
    if (error) return toast.error(error.message);
    const map = new Map((data as Lead[]).map((d) => [d.id, d]));
    setLeads((p) => p.map((l) => map.get(l.id) || l));
    toast.success(`Updated ${ids.length} lead${ids.length > 1 ? "s" : ""}`);
  };

  const bulkScheduleFollowUp = async (ids: string[], days: number) => {
    if (!ids.length) return;
    const d = new Date(); d.setDate(d.getDate() + days);
    await bulkUpdate(ids, { follow_up_at: d.toISOString(), stage: "follow_up" });
  };

  const bulkAssign = async (ids: string[], userId: string | null) => {
    if (!ids.length) return;
    const { data, error } = await supabase.from("sales_leads").update({
      assigned_to: userId, last_activity_at: new Date().toISOString(),
    }).in("id", ids).select();
    if (error) return toast.error(error.message);
    const map = new Map((data as Lead[]).map((d) => [d.id, d]));
    setLeads((p) => p.map((l) => map.get(l.id) || l));
    toast.success(userId ? `Assigned ${ids.length} lead${ids.length > 1 ? "s" : ""}` : `Unassigned ${ids.length} lead${ids.length > 1 ? "s" : ""}`);
    clearSelection();
  };

  const selectMany = (ids: string[]) => setSelected(new Set(ids));

  const { can, isAdmin } = usePermissions();
  const [pendingApprovals, setPendingApprovals] = useState(0);


  const [discovering, setDiscovering] = useState(false);
  const [lastScout, setLastScout] = useState<{ state: string; inserted: number } | null>(null);
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(true);

  useEffect(() => { if (!user) navigate("/sales/login", { replace: true }); }, [user, navigate]);

  useEffect(() => {
    if (openLead) {
      const fresh = leads.find((l) => l.id === openLead.id);
      if (fresh && fresh !== openLead) setOpenLead(fresh);
      if (!fresh) setOpenLead(null);
    }
  }, [leads, openLead]);

  const discover = async () => {
    setDiscovering(true);
    toast.info("Scout running — this can take 1–2 minutes…");
    const { data, error } = await supabase.functions.invoke("sales-scout-leads", { body: {} });
    setDiscovering(false);
    if (error) return toast.error(error.message);
    const inserted = data?.inserted ?? 0;
    const state = data?.state ?? "";
    setLastScout({ state, inserted });
    toast.success(`Scouted ${inserted} new ${state} leads with verified emails`);
    if (data?.leads?.length) {
      for (const l of data.leads) logActivity(l.id, "discovered", `${l.industry} · ${l.city}, ${state}`);
    }
    load();
  };

  const generate = async (lead: Lead) => {
    setGeneratingId(lead.id);
    const { data, error } = await supabase.functions.invoke("sales-generate-email", { body: { lead_id: lead.id } });
    setGeneratingId(null);
    if (error) return toast.error(error.message);
    if (data?.lead) { await logActivity(lead.id, "email_generated"); load(); toast.success("Email drafted"); }
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

  const industries = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => { if (l.industry) set.add(l.industry); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const matchesFilters = (l: Lead) => {
    if (industryFilter !== "all" && (l.industry || "") !== industryFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.business_name.toLowerCase().includes(q) ||
      (l.city || "").toLowerCase().includes(q) ||
      (l.industry || "").toLowerCase().includes(q)
    );
  };

  const queuedLeads = useMemo(() => leads.filter((l) => l.stage === "queued" && matchesFilters(l)), [leads, search, industryFilter]);
  const filteredLeads = useMemo(() => leads.filter(matchesFilters), [leads, search, industryFilter]);

  const initials = (user?.email || "ZC").slice(0, 2).toUpperCase();

  const onLeadsRoute = pathname.startsWith("/sales/leads");

  const sidebarContent = (
    <>
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

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <SideNav to="/sales" end icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" onClick={() => setMobileNavOpen(false)} />
        <SideNav to="/sales/pipeline" icon={<Kanban className="w-4 h-4" />} label="Pipeline" onClick={() => setMobileNavOpen(false)} />

        <button
          onClick={() => setLeadsOpen((v) => !v)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            onLeadsRoute ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="flex-1 text-left">Leads</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${leadsOpen ? "rotate-180" : ""}`} />
        </button>
        {leadsOpen && (
          <div className="ml-7 mt-1 space-y-1 border-l border-border pl-3">
            <SideNav to="/sales/leads" end label="All Leads" onClick={() => setMobileNavOpen(false)} subtle />
            <SideNav to="/sales/leads/queue" label="Queue" badge={queuedLeads.length || undefined} onClick={() => setMobileNavOpen(false)} subtle />
            <SideNav to="/sales/leads/contacts" label="My Contacts" onClick={() => setMobileNavOpen(false)} subtle />
          </div>
        )}

        <SideNav to="/sales/activity" icon={<ActivityIcon className="w-4 h-4" />} label="Activity" onClick={() => setMobileNavOpen(false)} />
        <SideNav to="/sales/followups" icon={<Clock className="w-4 h-4" />} label="Follow-ups" badge={dueFollowUps.length || undefined} onClick={() => setMobileNavOpen(false)} />
        <SideNav to="/sales/campaigns" icon={<Mail className="w-4 h-4" />} label="Campaigns" onClick={() => setMobileNavOpen(false)} />
        <SideNav to="/sales/how-it-works" icon={<HelpCircle className="w-4 h-4" />} label="How It Works" onClick={() => setMobileNavOpen(false)} />
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={() => { navigate("/sales/settings"); setMobileNavOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <SettingsIcon className="w-4 h-4" />Settings
        </button>
        <button
          onClick={() => { signOut(); navigate("/sales/login"); }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <LogOut className="w-4 h-4" />Sign out
        </button>
      </div>
    </>
  );

  const ctxValue = {
    leads, setLeads, activities, loading, load, logActivity, setStage, scheduleFollowUp, removeLead, stats,
    dueFollowUps, queuedLeads, filteredLeads,
    search, setSearch,
    industries, industryFilter, setIndustryFilter,
    openLead, setOpenLead, generate, generatingId, copy, copiedId,
    selected, toggleOne, clearSelection, selectMany, bulkDelete, bulkSetStage, bulkUpdate, bulkScheduleFollowUp,
    discovering, discover, lastScout,
    scanOpen, setScanOpen,
  };

  // Page title from route
  const pageTitle = (() => {
    if (pathname === "/sales") return "Dashboard";
    if (pathname.startsWith("/sales/pipeline")) return "Pipeline";
    if (pathname === "/sales/leads") return "All Leads";
    if (pathname.startsWith("/sales/leads/queue")) return "Queue";
    if (pathname.startsWith("/sales/leads/contacts")) return "My Contacts";
    if (pathname.startsWith("/sales/activity")) return "Activity";
    if (pathname.startsWith("/sales/followups")) return "Follow-ups";
    if (pathname.startsWith("/sales/campaigns")) return "Campaigns";
    if (pathname.startsWith("/sales/how-it-works")) return "How It Works";
    return "Sales";
  })();

  return (
    <SalesContext.Provider value={ctxValue}>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        <aside className="hidden md:flex w-64 shrink-0 border-r border-border bg-sidebar flex-col">
          {sidebarContent}
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar flex flex-col">{sidebarContent}</SheetContent>
        </Sheet>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md px-4 md:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setMobileNavOpen(true)} className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground" aria-label="Open menu">
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="font-display text-base md:text-lg font-semibold leading-tight truncate">{pageTitle}</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">Live outbound activity</span>
                  <span className="sm:hidden">Live</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
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
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold border border-border shrink-0">
                {initials}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
            <Outlet />
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

        <ScanCardDialog open={scanOpen} onOpenChange={setScanOpen} onCreated={() => load()} />

        <BulkBar />
      </div>
    </SalesContext.Provider>
  );
}

function SideNav({
  to, end, icon, label, badge, onClick, subtle,
}: {
  to: string; end?: boolean; icon?: React.ReactNode; label: string; badge?: number; onClick?: () => void; subtle?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 px-3 py-2 rounded-lg ${subtle ? "text-xs" : "text-sm"} font-medium transition-all ${
          isActive
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
        }`
      }
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge ? <span className="text-[10px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded">{badge}</span> : null}
    </NavLink>
  );
}
