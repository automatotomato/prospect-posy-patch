import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Briefcase, LogOut, Sparkles, Copy, Check, RefreshCw, Search, Trash2 } from "lucide-react";

type Lead = {
  id: string;
  business_name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  status: string;
  email_subject: string | null;
  email_body: string | null;
  email_generated_at: string | null;
};

const VERTICALS = [
  "manufacturing",
  "warehouse",
  "logistics company",
  "transportation company",
  "freight broker",
  "distribution center",
  "wholesale supplier",
  "3PL",
];

export default function SalesDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [vertical, setVertical] = useState(VERTICALS[0]);
  const [city, setCity] = useState("Las Vegas, NV");
  const [count, setCount] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/sales/login", { replace: true });
      return;
    }
    loadLeads();
  }, [user]);

  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setLeads((data as Lead[]) || []);
    setLoading(false);
  };

  const discover = async () => {
    setDiscovering(true);
    const { data, error } = await supabase.functions.invoke("sales-discover-leads", {
      body: { vertical, city, count },
    });
    setDiscovering(false);
    if (error) return toast.error(error.message);
    toast.success(`Found ${data?.inserted ?? 0} new leads`);
    loadLeads();
  };

  const generate = async (id: string) => {
    setGeneratingId(id);
    const { data, error } = await supabase.functions.invoke("sales-generate-email", {
      body: { lead_id: id },
    });
    setGeneratingId(null);
    if (error) return toast.error(error.message);
    if (data?.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
      toast.success("Email drafted");
    }
  };

  const copy = async (lead: Lead) => {
    const text = `Subject: ${lead.email_subject}\n\n${lead.email_body}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const markSent = async (id: string) => {
    const { error } = await supabase.from("sales_leads").update({ status: "sent" }).eq("id", id);
    if (error) return toast.error(error.message);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "sent" } : l)));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("sales_leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Outbound Sales</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/sales/login"); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discover new leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vertical</Label>
                <Select value={vertical} onValueChange={setVertical}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VERTICALS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, ST" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Count</Label>
                <Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} />
              </div>
              <div className="flex items-end">
                <Button onClick={discover} disabled={discovering} className="w-full">
                  {discovering ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Searching</> : <><Search className="w-4 h-4 mr-2" />Discover</>}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Excludes healthcare, medical, dental, pharma, and any insurance verticals.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Leads
              <span className="text-xs font-normal text-muted-foreground">{leads.length} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads yet. Discover some above.</p>
            ) : (
              <div className="divide-y">
                {leads.map((lead) => (
                  <div key={lead.id} className="py-3">
                    <div className="flex items-start justify-between gap-3 cursor-pointer"
                         onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{lead.business_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[lead.industry, lead.city, lead.state].filter(Boolean).join(" · ")}
                          {lead.website && <> · <a href={lead.website} target="_blank" rel="noreferrer" className="underline" onClick={(e) => e.stopPropagation()}>site</a></>}
                          {lead.phone && <> · {lead.phone}</>}
                        </div>
                      </div>
                      <Badge variant={lead.status === "sent" ? "default" : lead.status === "drafted" ? "secondary" : "outline"}>
                        {lead.status}
                      </Badge>
                    </div>

                    {expandedId === lead.id && (
                      <div className="mt-3 pl-2 border-l-2 border-muted space-y-3">
                        {lead.email_body ? (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">Subject</div>
                            <div className="text-sm font-medium">{lead.email_subject}</div>
                            <div className="text-xs text-muted-foreground mt-2">Body</div>
                            <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/40 p-3 rounded">{lead.email_body}</pre>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No email drafted yet.</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => generate(lead.id)} disabled={generatingId === lead.id}>
                            {generatingId === lead.id ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Drafting</> : <><Sparkles className="w-3 h-3 mr-1" />{lead.email_body ? "Regenerate" : "Generate email"}</>}
                          </Button>
                          {lead.email_body && (
                            <Button size="sm" variant="outline" onClick={() => copy(lead)}>
                              {copiedId === lead.id ? <><Check className="w-3 h-3 mr-1" />Copied</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                            </Button>
                          )}
                          {lead.email_body && lead.status !== "sent" && (
                            <Button size="sm" variant="outline" onClick={() => markSent(lead.id)}>Mark sent</Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => remove(lead.id)} className="text-destructive">
                            <Trash2 className="w-3 h-3 mr-1" />Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
