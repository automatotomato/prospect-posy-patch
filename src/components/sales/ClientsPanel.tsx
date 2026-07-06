import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Plus, Trash2, RefreshCw, Search, Users, Mail, Phone, Pencil, Ban, MailX, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export type ClientType = "current" | "previous" | "prospect";

export type Client = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  location: string | null;
  tags: string[] | null;
  client_type: ClientType;
  do_not_contact: boolean;
  unsubscribed: boolean;
  created_at: string;
};

export async function fetchAllClients(
  orderColumn: "created_at" | "business_name" = "created_at",
  ascending = false,
): Promise<{ data: Client[]; error: any }> {
  const pageSize = 1000;
  let offset = 0;
  let all: Client[] = [];

  const seen = new Set<string>();

  while (true) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order(orderColumn, { ascending })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) return { data: all, error };

    const rows = (data as Client[]) || [];
    // De-dupe across pages in case rows shift between range queries.
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      all.push(r);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return { data: all, error: null };
}

const REQUIRED_HEADERS = ["business_name"];
const KNOWN_HEADERS = [
  "business_name", "contact_name", "email", "phone",
  "website", "industry", "location", "notes", "tags", "client_type",
];

export const TYPE_LABEL: Record<ClientType, string> = {
  current: "Current customer",
  previous: "Previous customer",
  prospect: "Prospect",
};
export const TYPE_BADGE: Record<ClientType, string> = {
  current: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  previous: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  prospect: "bg-sky-500/10 text-sky-400 border-sky-500/30",
};

function normalizeClientType(v?: string): ClientType {
  const s = (v || "").toLowerCase().trim();
  if (s === "previous" || s === "past" || s === "former") return "previous";
  if (s === "prospect" || s === "lead" || s === "new") return "prospect";
  return "current";
}

function parseCSV(text: string): { rows: Record<string, string>[]; headers: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], headers: [] };
  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (c === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
  return { rows, headers };
}

export function ClientsPanel() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());

  const load = async () => {
    setLoading(true);
    const { data, error } = await fetchAllClients("created_at", false);
    if (error) toast.error(error.message);
    setClients(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const industries = Array.from(new Set(clients.map((c) => c.industry).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));

  const filtered = clients.filter((c) => {
    if (industryFilter !== "all" && (c.industry || "") !== industryFilter) return false;
    if (typeFilter !== "all" && c.client_type !== typeFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [c.business_name, c.contact_name, c.email, c.phone, c.industry, c.location]
      .some((f) => (f || "").toLowerCase().includes(q));
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Contact removed");
    setClients((prev) => prev.filter((c) => c.id !== id));
    setSelected((p) => { const n = new Set(p); n.delete(id); return n; });
  };

  const ids = Array.from(selected);
  const bulkDelete = async () => {
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} contact${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    const { error } = await supabase.from("clients").delete().in("id", ids);
    if (error) return toast.error(error.message);
    setClients((p) => p.filter((c) => !ids.includes(c.id)));
    clearSelection();
    toast.success(`Deleted ${ids.length} contacts`);
  };
  const bulkPatch = async (patch: Partial<Client>) => {
    if (!ids.length) return;
    const { data, error } = await supabase.from("clients").update(patch).in("id", ids).select();
    if (error) return toast.error(error.message);
    const map = new Map((data as Client[]).map((d) => [d.id, d]));
    setClients((p) => p.map((c) => map.get(c.id) || c));
    toast.success(`Updated ${ids.length} contact${ids.length > 1 ? "s" : ""}`);
  };

  const sendToPipeline = async (targets: Client[]) => {
    const withEmail = targets.filter((c) => c.email && !c.do_not_contact && !c.unsubscribed);
    const skipped = targets.length - withEmail.length;
    if (withEmail.length === 0) {
      return toast.error("No eligible contacts — each lead needs an email and must not be DNC/unsubscribed.");
    }
    const { data: userResp } = await supabase.auth.getUser();
    const ownerId = userResp.user?.id;
    if (!ownerId) return toast.error("Not signed in");

    const emails = withEmail.map((c) => c.email!.toLowerCase());
    const { data: existing } = await supabase
      .from("sales_leads")
      .select("email")
      .in("email", emails);
    const existingSet = new Set((existing || []).map((r: any) => (r.email || "").toLowerCase()));

    const rows = withEmail
      .filter((c) => !existingSet.has(c.email!.toLowerCase()))
      .map((c) => {
        const [city, state] = (c.location || "").split(",").map((s) => s.trim());
        return {
          owner_id: ownerId,
          business_name: c.business_name,
          email: c.email,
          phone: c.phone,
          city: city || null,
          state: state || null,
          industry: c.industry,
          source: "my_contacts",
          status: "new",
          stage: "new",
        };
      });

    const duplicates = withEmail.length - rows.length;
    if (rows.length === 0) {
      return toast.message("Already in pipeline", {
        description: `${duplicates} contact${duplicates > 1 ? "s are" : " is"} already a lead.`,
      });
    }

    const { error } = await supabase.from("sales_leads").insert(rows);
    if (error) return toast.error(error.message);

    const parts = [`${rows.length} sent to pipeline`];
    if (duplicates) parts.push(`${duplicates} already there`);
    if (skipped) parts.push(`${skipped} skipped (no email / DNC)`);
    toast.success(parts.join(" • "));
    clearSelection();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-sm">My Contacts</h3>
              <p className="text-xs text-muted-foreground">
                {clients.length} {clients.length === 1 ? "contact" : "contacts"} uploaded
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />Add one
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-2">
              <Upload className="w-4 h-4" />Upload CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={load} className="gap-2">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts..."
              className="pl-9 bg-secondary border-border h-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[200px] h-10 bg-secondary border-border">
              <SelectValue placeholder="Contact type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="current">Current customers</SelectItem>
              <SelectItem value="previous">Previous customers</SelectItem>
              <SelectItem value="prospect">Prospects</SelectItem>
            </SelectContent>
          </Select>
          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="w-full md:w-[200px] h-10 bg-secondary border-border">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All industries</SelectItem>
              {industries.map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(industryFilter !== "all" || typeFilter !== "all") && (
            <button onClick={() => { setIndustryFilter("all"); setTypeFilter("all"); }} className="text-xs text-muted-foreground hover:text-foreground underline self-center">
              Clear
            </button>
          )}
        </div>


        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No contacts yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload a CSV to get started.
            </p>
          </div>
        ) : (
          <>
            <div className="px-4 md:px-5 py-2.5 border-b border-border flex items-center gap-3 bg-muted/20 text-xs">
              <Checkbox
                checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))
                  ? true
                  : filtered.some((c) => selected.has(c.id)) ? "indeterminate" : false}
                onCheckedChange={(v) => {
                  if (v) setSelected(new Set([...Array.from(selected), ...filtered.map((c) => c.id)]));
                  else clearSelection();
                }}
                aria-label="Select all"
              />
              <span className="text-muted-foreground">
                {selected.size > 0 ? `${selected.size} selected` : `Select all ${filtered.length}`}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <li key={c.id} className={`px-4 md:px-5 py-3 flex items-center gap-3 hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(c.id)}
                      aria-label="Select contact"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{c.business_name}</span>
                        <Badge variant="outline" className={`text-[10px] ${TYPE_BADGE[c.client_type] || TYPE_BADGE.current}`}>
                          {TYPE_LABEL[c.client_type] || "Current customer"}
                        </Badge>
                        {c.industry && <Badge variant="secondary" className="text-[10px]">{c.industry}</Badge>}
                        {c.do_not_contact && <Badge variant="destructive" className="text-[10px]">DNC</Badge>}
                        {c.unsubscribed && <Badge variant="outline" className="text-[10px]">Unsubscribed</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                        {c.contact_name && <span>{c.contact_name}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                        {c.location && <span>{c.location}</span>}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendToPipeline([c])}
                      disabled={!c.email || c.do_not_contact || c.unsubscribed}
                      className="shrink-0 h-8 gap-1"
                      title={!c.email ? "Needs an email" : c.do_not_contact ? "Marked DNC" : c.unsubscribed ? "Unsubscribed" : "Send to pipeline"}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">To pipeline</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)} className="shrink-0">
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-full shadow-2xl shadow-primary/20 px-4 py-2.5 flex items-center gap-2 md:gap-3 flex-wrap max-w-[95vw]">
          <Badge variant="secondary" className="font-semibold">{selected.size} selected</Badge>
          <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground" aria-label="Clear">×</button>
          <div className="h-5 w-px bg-border" />
          <Button
            size="sm"
            className="h-8 gap-1"
            onClick={() => sendToPipeline(clients.filter((c) => selected.has(c.id)))}
          >
            <Send className="w-3.5 h-3.5" />Send to pipeline
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditOpen(true)}>
            <Pencil className="w-3.5 h-3.5" />Edit
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => bulkPatch({ do_not_contact: true })}>
            <Ban className="w-3.5 h-3.5" />Mark DNC
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => bulkPatch({ unsubscribed: true })}>
            <MailX className="w-3.5 h-3.5" />Unsubscribe
          </Button>
          <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={bulkDelete}>
            <Trash2 className="w-3.5 h-3.5" />Delete
          </Button>
        </div>
      )}

      <BulkEditClientsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        count={ids.length}
        onSave={async (patch) => { await bulkPatch(patch); setEditOpen(false); }}
      />

      <UploadCsvDialog open={uploadOpen} onOpenChange={setUploadOpen} onDone={load} />
      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} onDone={load} />

    </div>
  );
}

function UploadCsvDialog({ open, onOpenChange, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = (text: string) => {
    setCsvText(text);
    const { rows, headers } = parseCSV(text);
    setHeaders(headers);
    setPreview(rows.slice(0, 5));
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    parse(text);
  };

  const reset = () => {
    setCsvText(""); setPreview([]); setHeaders([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    const { rows } = parseCSV(csvText);
    if (rows.length === 0) return toast.error("No rows found");
    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length) return toast.error(`Missing required column: ${missing.join(", ")}`);

    const payload = rows
      .filter((r) => (r.business_name || "").trim().length > 0)
      .map((r) => ({
        business_name: r.business_name?.trim(),
        contact_name: r.contact_name?.trim() || null,
        email: r.email?.trim() || null,
        phone: r.phone?.trim() || null,
        website: r.website?.trim() || null,
        industry: r.industry?.trim() || null,
        location: r.location?.trim() || null,
        notes: r.notes?.trim() || null,
        tags: r.tags ? r.tags.split(/[;|]/).map((t) => t.trim()).filter(Boolean) : null,
        client_type: normalizeClientType(r.client_type),
      }));

    if (payload.length === 0) return toast.error("No valid rows (business_name required)");

    setUploading(true);
    // Insert in chunks to avoid request size limits
    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error } = await supabase.from("clients").insert(chunk);
      if (error) {
        setUploading(false);
        return toast.error(error.message);
      }
      inserted += chunk.length;
    }
    setUploading(false);
    toast.success(`Imported ${inserted} contacts`);
    reset();
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload contacts (CSV)</DialogTitle>
          <DialogDescription>
            Required column: <code className="text-xs">business_name</code>. Optional:{" "}
            <code className="text-xs">{KNOWN_HEADERS.slice(1).join(", ")}</code>. Use <code className="text-xs">;</code> or <code className="text-xs">|</code> to separate tags.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Choose a CSV file</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="bg-secondary border-border mt-1"
            />
          </div>

          <div className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">or paste</div>

          <Textarea
            value={csvText}
            onChange={(e) => parse(e.target.value)}
            placeholder="business_name,contact_name,email,phone..."
            className="bg-secondary border-border font-mono text-xs h-32"
          />

          {preview.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 flex items-center justify-between gap-2 border-b border-border">
                <span className="text-[10px] uppercase tracking-wider font-semibold">
                  Preview — first {preview.length} of {parseCSV(csvText).rows.length} rows
                </span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {headers.map((h) => (
                    <span
                      key={h}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        KNOWN_HEADERS.includes(h)
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground border border-border line-through"
                      }`}
                      title={KNOWN_HEADERS.includes(h) ? "Will be imported" : "Ignored — not a known field"}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      {headers.map((h) => (
                        <th
                          key={h}
                          className={`text-left px-3 py-2 font-semibold whitespace-nowrap border-b border-border ${
                            KNOWN_HEADERS.includes(h) ? "text-foreground" : "text-muted-foreground/60"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                        {headers.map((h) => (
                          <td
                            key={h}
                            className={`px-3 py-1.5 align-top ${
                              KNOWN_HEADERS.includes(h) ? "" : "text-muted-foreground/60"
                            }`}
                          >
                            <div className="max-w-[200px] truncate" title={row[h]}>
                              {row[h] || <span className="text-muted-foreground/40">—</span>}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>


        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={uploading || preview.length === 0} className="gap-2">
            {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" />Importing…</> : <><Upload className="w-4 h-4" />Import</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddClientDialog({ open, onOpenChange, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void;
}) {
  const [form, setForm] = useState({
    business_name: "", contact_name: "", email: "", phone: "", industry: "", location: "", notes: "",
    client_type: "current" as ClientType,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.business_name.trim()) return toast.error("Business name is required");
    setSaving(true);
    const { error } = await supabase.from("clients").insert({
      business_name: form.business_name.trim(),
      contact_name: form.contact_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      industry: form.industry.trim() || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      client_type: form.client_type,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Contact added");
    setForm({ business_name: "", contact_name: "", email: "", phone: "", industry: "", location: "", notes: "", client_type: "current" });
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Business name *</Label>
            <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Contact name</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs">Industry</Label>
              <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Contact type</Label>
              <Select value={form.client_type} onValueChange={(v) => setForm({ ...form, client_type: v as ClientType })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current customer</SelectItem>
                  <SelectItem value="previous">Previous customer</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-secondary border-border" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkEditClientsDialog({
  open, onOpenChange, count, onSave,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; count: number;
  onSave: (patch: Partial<Client>) => Promise<void> | void;
}) {
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [clientType, setClientType] = useState<string>("");
  const [dnc, setDnc] = useState<string>("");
  const [unsub, setUnsub] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setIndustry(""); setLocation(""); setClientType(""); setDnc(""); setUnsub(""); };

  const submit = async () => {
    const patch: Partial<Client> = {};
    if (industry.trim()) patch.industry = industry.trim();
    if (location.trim()) patch.location = location.trim();
    if (clientType) patch.client_type = clientType as ClientType;
    if (dnc) patch.do_not_contact = dnc === "true";
    if (unsub) patch.unsubscribed = unsub === "true";
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
          <DialogTitle>Edit {count} contact{count > 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>Only fields you fill in will be updated.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Contact type</Label>
            <Select value={clientType} onValueChange={setClientType}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Keep" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current customer</SelectItem>
                <SelectItem value="previous">Previous customer</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Industry</Label>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Plumbing" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, ST" className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Do not contact</Label>
              <Select value={dnc} onValueChange={setDnc}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Keep" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Mark DNC</SelectItem>
                  <SelectItem value="false">Clear DNC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Unsubscribed</Label>
              <Select value={unsub} onValueChange={setUnsub}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Keep" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Mark unsubscribed</SelectItem>
                  <SelectItem value="false">Re-subscribe</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
