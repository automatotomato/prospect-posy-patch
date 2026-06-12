import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export function LogWinDialog({
  open, onOpenChange, leadId, leadName, ownerId, onLogged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  leadName: string;
  ownerId: string | null;
  onLogged?: () => void;
}) {
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // load existing win, if any
      (async () => {
        const { data } = await supabase
          .from("sales_wins" as any).select("amount, deal_notes").eq("lead_id", leadId).maybeSingle();
        if (data) {
          setAmount(String((data as any).amount ?? ""));
          setNotes((data as any).deal_notes ?? "");
        } else {
          setAmount(""); setNotes("");
        }
      })();
    }
  }, [open, leadId]);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) { setSaving(false); return; }
    const numericAmount = Number(amount.replace(/[^0-9.]/g, "")) || 0;
    const { error } = await supabase
      .from("sales_wins" as any)
      .upsert({
        lead_id: leadId,
        owner_id: ownerId,
        closed_by: userId,
        amount: numericAmount,
        currency: "USD",
        deal_notes: notes || null,
        won_at: new Date().toISOString(),
      }, { onConflict: "lead_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Win logged");
    onOpenChange(false);
    onLogged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" /> Log win — {leadName}
          </DialogTitle>
          <DialogDescription>
            Track which deals closed through this project. Amount and notes are optional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Deal amount (USD)</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-secondary border-border"
            />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What scope? Engagement type? Key contact?"
              className="bg-secondary border-border"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Skip</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save win"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
