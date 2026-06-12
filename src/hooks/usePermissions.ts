import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentRole } from "@/hooks/useCurrentRole";

export const PERMISSION_KEYS = [
  "view_leads",
  "edit_leads",
  "draft_emails",
  "send_emails",
  "send_sms",
  "log_calls",
  "manage_campaigns",
  "import_contacts",
  "delete_leads",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string }> = {
  view_leads:       { label: "View leads",        description: "See leads assigned to them" },
  edit_leads:       { label: "Edit leads",        description: "Update lead details, stage, notes" },
  draft_emails:     { label: "Draft emails",      description: "Generate AI email drafts" },
  send_emails:      { label: "Send emails",       description: "Send without admin approval (otherwise drafts go to the approval queue)" },
  send_sms:         { label: "Send SMS",          description: "Text message leads" },
  log_calls:        { label: "Log calls",         description: "Record call activity" },
  manage_campaigns: { label: "Manage campaigns",  description: "Create or edit outreach campaigns" },
  import_contacts:  { label: "Import contacts",   description: "Upload CSVs of contacts" },
  delete_leads:     { label: "Delete leads",      description: "Remove leads from the system" },
};

export const DEFAULT_REP_PERMISSIONS: Record<PermissionKey, boolean> = {
  view_leads: true,
  edit_leads: true,
  draft_emails: true,
  send_emails: false,
  send_sms: false,
  log_calls: true,
  manage_campaigns: false,
  import_contacts: false,
  delete_leads: false,
};

export type Permissions = Partial<Record<PermissionKey, boolean>>;

export function usePermissions() {
  const { user } = useAuth();
  const { data: role } = useCurrentRole();
  const [perms, setPerms] = useState<Permissions>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.email) { setPerms({}); setLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from("allowed_users")
        .select("permissions")
        .eq("email", user.email!.toLowerCase())
        .maybeSingle();
      if (!active) return;
      setPerms((data?.permissions as Permissions) || {});
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [user?.email]);

  const isAdmin = !!role?.isAdmin;
  const can = (key: PermissionKey) => isAdmin || perms[key] === true;
  return { can, isAdmin, perms, loaded };
}
