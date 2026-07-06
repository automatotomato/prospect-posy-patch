/// <reference path="../env.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_dashboard_stats",
  title: "Get dashboard stats",
  description: "Summary of sales leads by stage plus counts of activities in the last 7 days.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: leads, error } = await sb.from("sales_leads").select("status");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const byStage: Record<string, number> = {};
    for (const r of leads ?? []) byStage[r.status ?? "unknown"] = (byStage[r.status ?? "unknown"] ?? 0) + 1;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentActivities } = await sb
      .from("sales_activities")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);
    const total = leads?.length ?? 0;
    return {
      content: [{ type: "text", text: `Total leads: ${total}. Activities (7d): ${recentActivities ?? 0}.` }],
      structuredContent: { total_leads: total, by_stage: byStage, activities_last_7_days: recentActivities ?? 0 },
    };
  },
});
