import { createContext, useContext, useState } from "react";
import {
  Activity as ActivityIcon, Building2, Check, ChevronRight, Clock, Copy,
  ListChecks, MapPin, MoreVertical, Pencil, RefreshCw, Send, Sparkles, Trash2, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGES, type Lead } from "@/hooks/useSalesLeads";

/* ============ Context ============ */

export type SalesCtx = {
  // data
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  activities: import("@/hooks/useSalesLeads").Activity[];
  loading: boolean;
  load: () => Promise<void> | void;
  logActivity: (leadId: string, type: string, note?: string, metadata?: any) => Promise<void>;
  setStage: (lead: Lead, stage: string, note?: string) => Promise<void>;
  scheduleFollowUp: (lead: Lead, days: number) => Promise<void>;
  removeLead: (id: string) => Promise<any>;
  stats: { total: number; by: Record<string, number>; dueFollowUps: number };
  dueFollowUps: Lead[];
  queuedLeads: Lead[];
  filteredLeads: Lead[];

  // search & filters
  search: string;
  setSearch: (s: string) => void;
  industries: string[];
  industryFilter: string;
  setIndustryFilter: (s: string) => void;

  // drawer
  openLead: Lead | null;
  setOpenLead: (l: Lead | null) => void;
  generate: (lead: Lead) => Promise<any>;
  generatingId: string | null;
  copy: (lead: Lead) => Promise<any>;
  copiedId: string | null;

  // selection / bulk
  selected: Set<string>;
  toggleOne: (id: string) => void;
  clearSelection: () => void;
  selectMany: (ids: string[]) => void;
  bulkDelete: (ids: string[]) => Promise<any>;
  bulkSetStage: (ids: string[], stage: string) => Promise<any>;
  bulkUpdate: (ids: string[], patch: Partial<Lead>) => Promise<any>;
  bulkScheduleFollowUp: (ids: string[], days: number) => Promise<any>;

  // scout
  discovering: boolean;
  discover: () => Promise<any>;
  lastScout: { state: string; inserted: number } | null;

  // scan
  scanOpen: boolean;
  setScanOpen: (v: boolean) => void;
};

export const SalesContext = createContext<SalesCtx | null>(null);
export function useSales(): SalesCtx {
  const v = useContext(SalesContext);
  if (!v) throw new Error("useSales must be used inside SalesLayout");
  return v;
}

/* ============ Static maps & helpers ============ */

export const STAGE_META: Record<string, { dot: string; accent: string; tint: string }> = {
  new:        { dot: "bg-sky-400",     accent: "text-sky-300",     tint: "border-l-sky-500" },
  queued:     { dot: "bg-amber-400",   accent: "text-amber-300",   tint: "border-l-amber-500" },
  contacted:  { dot: "bg-blue-400",    accent: "text-blue-300",    tint: "border-l-blue-500" },
  follow_up:  { dot: "bg-indigo-400",  accent: "text-indigo-300",  tint: "border-l-indigo-500" },
  replied:    { dot: "bg-fuchsia-400", accent: "text-fuchsia-300", tint: "border-l-fuchsia-500" },
  won:        { dot: "bg-emerald-400", accent: "text-emerald-300", tint: "border-l-emerald-500" },
  lost:       { dot: "bg-rose-500",    accent: "text-rose-300",    tint: "border-l-rose-500" },
};

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (Math.abs(diff) < 60) return "now";
  if (diff > 0 && diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff > 0 && diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 0 && diff > -86400 * 14) return `in ${Math.ceil(-diff / 86400)}d`;
  return d.toLocaleDateString();
}

export function StageBadge({ stage }: { stage: string }) {
  const label = STAGES.find((s) => s.id === stage)?.label || stage;
  const m = STAGE_META[stage];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${m?.accent || ""}`}>
      <span className={`stage-dot ${m?.dot || "bg-muted-foreground"}`} />{label}
    </span>
  );
}

export function ActivityIconFor({ type }: { type: string }) {
  if (type.startsWith("stage:")) return <TrendingUp className="w-3 h-3" />;
  if (type === "email_generated") return <Sparkles className="w-3 h-3" />;
  if (type === "follow_up_scheduled") return <Clock className="w-3 h-3" />;
  return <ActivityIcon className="w-3 h-3" />;
}

export function activityLabel(a: { type: string; note: string | null }) {
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

/* ============ KpiTile ============ */
export function KpiTile({ label, value, delta, deltaTone = "primary", progress = 50, highlight }: {
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
        {delta && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${toneClass}`}>{delta}</span>}
      </div>
      <div className={`mt-3 h-1 w-full rounded-full overflow-hidden ${highlight ? "bg-white/20" : "bg-muted/40"}`}>
        <div className={`h-full rounded-full transition-all ${highlight ? "bg-white" : "bg-primary"}`}
          style={{ width: `${Math.max(8, Math.min(100, progress))}%` }} />
      </div>
    </div>
  );
}

/* ============ KanbanLeadCard ============ */
export function KanbanLeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
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
        {lead.city && <span className="flex items-center gap-1 truncate"><MapPin className="w-2.5 h-2.5" />{lead.city}</span>}
        {lead.contact_count > 0 && <span className="flex items-center gap-1"><Send className="w-2.5 h-2.5" />{lead.contact_count}</span>}
        {lead.email_body && <span className="flex items-center gap-1 text-primary"><Sparkles className="w-2.5 h-2.5" />Drafted</span>}
      </div>
    </button>
  );
}

/* ============ LeadTable ============ */
export function LeadTable({
  leads, loading, emptyText, onOpen, showColumn, selected, onToggle,
}: {
  leads: Lead[]; loading: boolean; emptyText: string; onOpen: (l: Lead) => void;
  showColumn: "follow_up" | "queued" | "updated";
  selected?: Set<string>; onToggle?: (id: string) => void;
}) {
  const { selectMany, clearSelection } = useSales();
  if (loading) return <p className="text-sm text-muted-foreground p-6">Loading…</p>;
  if (leads.length === 0)
    return <div className="bg-card border border-border rounded-2xl p-8 text-sm text-muted-foreground text-center">{emptyText}</div>;
  const allSelected = !!selected && leads.length > 0 && leads.every((l) => selected.has(l.id));
  const someSelected = !!selected && leads.some((l) => selected.has(l.id)) && !allSelected;
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {onToggle && (
        <div className="px-5 py-2.5 border-b border-border flex items-center gap-3 bg-muted/20 text-xs">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(v) => {
              if (v) selectMany(Array.from(new Set([...(selected ? Array.from(selected) : []), ...leads.map((l) => l.id)])));
              else clearSelection();
            }}
            aria-label="Select all"
          />
          <span className="text-muted-foreground">
            {selected && selected.size > 0 ? `${selected.size} selected` : `Select all ${leads.length}`}
          </span>
        </div>
      )}
      <div className="divide-y divide-border">
        {leads.map((l) => {
          const isSelected = selected?.has(l.id);
          return (
            <div key={l.id}
              className={`w-full px-5 py-3 hover:bg-muted/30 flex items-center gap-4 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
              {onToggle && (
                <Checkbox
                  checked={!!isSelected}
                  onCheckedChange={() => onToggle(l.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select lead"
                />
              )}
              <button onClick={() => onOpen(l)} className="flex items-center gap-4 text-left flex-1 min-w-0">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Lead Drawer ============ */
export function LeadDrawer({
  lead, onClose, activities, onGenerate, generating, onCopy, copied, onStage, onFollowUp, onDelete,
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

/* ============ Bulk action bar ============ */
export function BulkBar() {
  const { selected, clearSelection, bulkDelete, bulkSetStage, bulkUpdate, bulkScheduleFollowUp } = useSales();
  const [editOpen, setEditOpen] = useState(false);
  if (selected.size === 0) return null;
  const ids = Array.from(selected);
  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-full shadow-2xl shadow-primary/20 px-4 py-2.5 flex items-center gap-2 md:gap-3 flex-wrap max-w-[95vw]">
        <Badge variant="secondary" className="font-semibold">{selected.size} selected</Badge>
        <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground" aria-label="Clear">×</button>
        <div className="h-5 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8">Stage <MoreVertical className="w-3 h-3 ml-1" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Move {selected.size} to…</DropdownMenuLabel>
            {STAGES.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => bulkSetStage(ids, s.id)}>{s.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1"><Clock className="w-3.5 h-3.5" />Follow-up</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Schedule for {selected.size}</DropdownMenuLabel>
            {[1, 3, 7, 14, 30].map((d) => (
              <DropdownMenuItem key={d} onClick={() => bulkScheduleFollowUp(ids, d)}>In {d} day{d > 1 ? "s" : ""}</DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => bulkUpdate(ids, { follow_up_at: null })}>Clear follow-up</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditOpen(true)}>
          <Pencil className="w-3.5 h-3.5" />Edit
        </Button>
        <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={() => bulkDelete(ids)}>
          <Trash2 className="w-3.5 h-3.5" />Delete
        </Button>
      </div>

      <BulkEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        count={ids.length}
        onSave={async (patch) => { await bulkUpdate(ids, patch); setEditOpen(false); }}
      />
    </>
  );
}

function BulkEditDialog({
  open, onOpenChange, count, onSave,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; count: number;
  onSave: (patch: Partial<Lead>) => Promise<void> | void;
}) {
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [stage, setStage] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setIndustry(""); setCity(""); setState(""); setStage(""); };

  const submit = async () => {
    const patch: Partial<Lead> = {};
    if (industry.trim()) patch.industry = industry.trim();
    if (city.trim()) patch.city = city.trim();
    if (state.trim()) patch.state = state.trim().toUpperCase();
    if (stage) patch.stage = stage;
    if (Object.keys(patch).length === 0) { onOpenChange(false); return; }
    setSaving(true);
    await onSave(patch);
    setSaving(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {count} lead{count > 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>Only fields you fill in will be updated. Leave blank to keep existing values.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Industry</Label>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Towing" className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Las Vegas" className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs">State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="NV" maxLength={2} className="bg-secondary border-border" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Keep current" /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : `Update ${count}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Industry filter ============ */
export function IndustryFilter({
  value, onChange, industries, count, label = "Industry",
}: {
  value: string; onChange: (v: string) => void; industries: string[]; count?: number; label?: string;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[220px] h-9 bg-card border-border text-sm">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All industries</SelectItem>
          {industries.map((i) => (
            <SelectItem key={i} value={i}>{i}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== "all" && (
        <button onClick={() => onChange("all")} className="text-xs text-muted-foreground hover:text-foreground underline">
          Clear
        </button>
      )}
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">{count} {count === 1 ? "result" : "results"}</span>
      )}
    </div>
  );
}

