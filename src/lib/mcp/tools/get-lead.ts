import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_lead_details",
  title: "Get lead details",
  description: "Fetch a single sales lead with its recent activities (calls, emails, notes).",
  inputSchema: {
    lead_id: z.string().uuid().describe("Sales lead UUID"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const [lead, activities] = await Promise.all([
      sb.from("sales_leads").select("*").eq("id", lead_id).maybeSingle(),
      sb.from("sales_activities").select("*").eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (lead.error) return { content: [{ type: "text", text: lead.error.message }], isError: true };
    if (!lead.data) return { content: [{ type: "text", text: "Lead not found" }], isError: true };
    return {
      content: [{ type: "text", text: `${lead.data.business_name} — ${activities.data?.length ?? 0} activities.` }],
      structuredContent: { lead: lead.data, activities: activities.data ?? [] },
    };
  },
});
