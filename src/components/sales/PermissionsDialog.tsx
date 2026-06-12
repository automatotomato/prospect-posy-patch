import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_KEYS, PERMISSION_LABELS, DEFAULT_REP_PERMISSIONS, type PermissionKey, type Permissions } from "@/hooks/usePermissions";

export function PermissionsDialog({
  open, onOpenChange, member, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: { id: string; email: string; name: string | null; role: string } | null;
  onSaved?: () => void;
}) {
  const [perms, setPerms] = useState<Permissions>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member || !open) return;
    (async () => {
      const { data } = await supabase
        .from("allowed_users")
        .select("permissions")
        .eq("id", member.id)
        .maybeSingle();
      const current = (data?.permissions as Permissions) || {};
      // Seed defaults for any unset keys so checkboxes reflect the default behavior
      const seeded: Permissions = { ...DEFAULT_REP_PERMISSIONS, ...current };
      setPerms(seeded);
    })();
  }, [member, open]);

  if (!member) return null;
  const isAdminMember = member.role === "admin";

  const toggle = (k: PermissionKey) => setPerms((p) => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("allowed_users")
      .update({ permissions: perms as any })
      .eq("id", member.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Permissions updated");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Permissions · {member.name || member.email}</DialogTitle>
          <DialogDescription>
            {isAdminMember
              ? "Admins always have every permission. Toggles below are informational only."
              : "Pick exactly which actions this team member can take."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {PERMISSION_KEYS.map((k) => {
            const meta = PERMISSION_LABELS[k];
            const checked = isAdminMember ? true : !!perms[k];
            return (
              <label
                key={k}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  disabled={isAdminMember}
                  onCheckedChange={() => !isAdminMember && toggle(k)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.description}</div>
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!isAdminMember && (
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save permissions"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
