import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentRole } from "@/hooks/useCurrentRole";

export type Assignable = { user_id: string; label: string };

export function useAssignableMembers() {
  const [members, setMembers] = useState<Assignable[]>([]);
  useEffect(() => {
    (async () => {
      // allowed_users has email + name; team_members has the linked user_id we need.
      const { data: au } = await supabase.from("allowed_users").select("email, name");
      const { data: tm } = await supabase.from("team_members").select("user_id, email, name");
      if (!tm) return;
      const byEmail = new Map((au || []).map((a) => [a.email.toLowerCase(), a]));
      const list: Assignable[] = (tm || [])
        .filter((m) => !!m.user_id)
        .map((m) => {
          const a = byEmail.get(m.email.toLowerCase());
          return { user_id: m.user_id as string, label: a?.name || m.name || m.email };
        });
      setMembers(list);
    })();
  }, []);
  return members;
}

export function AssigneeSelect({
  value, onChange, placeholder = "Unassigned", className,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const members = useAssignableMembers();
  const { data: role } = useCurrentRole();
  const isAdmin = !!role?.isAdmin;

  const currentLabel = useMemo(() => {
    if (!value) return placeholder;
    return members.find((m) => m.user_id === value)?.label || "Assigned";
  }, [value, members, placeholder]);

  if (!isAdmin) {
    return (
      <div className={className || "h-8 text-xs px-2 flex items-center rounded-md bg-secondary border border-border text-muted-foreground"}>
        {currentLabel}
      </div>
    );
  }

  return (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
      <SelectTrigger className={className || "h-8 text-xs bg-secondary border-border"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Unassigned</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.user_id} value={m.user_id}>{m.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
