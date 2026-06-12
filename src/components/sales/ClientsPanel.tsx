import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Plus, Trash2, RefreshCw, Search, Users, Mail, Phone } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export type Client = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  location: string | null;
  tags: string[] | null;
  do_not_contact: boolean;
  unsubscribed: boolean;
  created_at: string;
};

const REQUIRED_HEADERS = ["business_name"];
const KNOWN_HEADERS = [
  "business_name", "contact_name", "email", "phone",
  "website", "industry", "location", "notes", "tags",
];

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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setClients((data as Client[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = clients.filter((c) => {
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
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts..."
              className="pl-9 bg-secondary border-border h-10"
            />
          </div>
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
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id} className="px-4 md:px-5 py-3 flex items-center gap-3 hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{c.business_name}</span>
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
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)} className="shrink-0">
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Contact added");
    setForm({ business_name: "", contact_name: "", email: "", phone: "", industry: "", location: "", notes: "" });
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
