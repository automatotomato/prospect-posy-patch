import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Download } from "lucide-react";
import { useSales } from "./_shared";

type Win = {
  id: string;
  lead_id: string;
  owner_id: string | null;
  closed_by: string | null;
  amount: number;
  currency: string;
  deal_notes: string | null;
  won_at: string;
};

const fmtMoney = (n: number, c = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n || 0);

export default function Wins() {
  const { leads, setOpenLead, isAdmin } = useSales();
  const [wins, setWins] = useState<Win[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("sales_wins" as any).select("*").order("won_at", { ascending: false });
    setWins(((data as any) || []) as Win[]);
    const ids = Array.from(new Set(((data as any) || []).flatMap((w: any) => [w.owner_id, w.closed_by]).filter(Boolean)));
    if (ids.length) {
      const { data: tm } = await supabase.from("team_members").select("user_id, name, email").in("user_id", ids as string[]);
      const map: Record<string, string> = {};
      (tm || []).forEach((m: any) => (map[m.user_id] = m.name || m.email));
      setMembers(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).getTime();
    let mCount = 0, mSum = 0, qCount = 0, qSum = 0, aSum = 0;
    for (const w of wins) {
      const t = new Date(w.won_at).getTime();
      aSum += Number(w.amount || 0);
      if (t >= monthStart) { mCount++; mSum += Number(w.amount || 0); }
      if (t >= qStart) { qCount++; qSum += Number(w.amount || 0); }
    }
    return { mCount, mSum, qCount, qSum, total: wins.length, aSum };
  }, [wins]);

  const exportCsv = () => {
    const rows = [["Lead", "Industry", "City", "State", "Amount", "Currency", "Owner", "Closed by", "Notes", "Won at"]];
    for (const w of wins) {
      const lead = leads.find((l) => l.id === w.lead_id);
      rows.push([
        lead?.business_name || "",
        lead?.industry || "",
        lead?.city || "",
        lead?.state || "",
        String(w.amount ?? 0),
        w.currency,
        (w.owner_id && members[w.owner_id]) || "",
        (w.closed_by && members[w.closed_by]) || "",
        (w.deal_notes || "").replace(/\n/g, " "),
        new Date(w.won_at).toISOString(),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `wins-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">This month</div>
          <div className="font-display text-2xl font-bold mt-1">{totals.mCount}</div>
          <div className="text-xs text-muted-foreground mt-1">{fmtMoney(totals.mSum)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">This quarter</div>
          <div className="font-display text-2xl font-bold mt-1">{totals.qCount}</div>
          <div className="text-xs text-muted-foreground mt-1">{fmtMoney(totals.qSum)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">All time wins</div>
          <div className="font-display text-2xl font-bold mt-1">{totals.total}</div>
          <div className="text-xs text-muted-foreground mt-1">{fmtMoney(totals.aSum)} closed</div>
        </Card>
        <Card className="p-4 flex flex-col justify-between">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Export</div>
          <Button size="sm" variant="outline" className="gap-2 mt-2" onClick={exportCsv} disabled={!wins.length}>
            <Download className="w-3.5 h-3.5" />CSV
          </Button>
        </Card>
      </section>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading wins…</p>
        ) : wins.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Trophy className="w-6 h-6 mx-auto mb-2 opacity-60" />
            No wins logged yet. Move a lead to <b>Won</b> to track the deal here.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {wins.map((w) => {
              const lead = leads.find((l) => l.id === w.lead_id);
              return (
                <li
                  key={w.id}
                  className="px-5 py-4 hover:bg-muted/30 cursor-pointer flex items-center gap-4 transition-colors"
                  onClick={() => lead && setOpenLead(lead)}
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{lead?.business_name || "(lead removed)"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[lead?.industry, lead?.city, lead?.state].filter(Boolean).join(" · ") || "—"}
                      {w.deal_notes && <> · {w.deal_notes}</>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-400 tabular-nums">{fmtMoney(Number(w.amount), w.currency)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(w.won_at).toLocaleDateString()}
                    </div>
                  </div>
                  {(w.closed_by || w.owner_id) && (
                    <Badge variant="secondary" className="hidden md:inline-flex">
                      {members[w.closed_by || ""] || members[w.owner_id || ""] || "—"}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">You see wins you closed or own. Admins see all.</p>
      )}
    </div>
  );
}
