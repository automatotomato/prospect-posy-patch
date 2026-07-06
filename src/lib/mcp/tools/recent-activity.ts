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
  name: "list_recent_activities",
  title: "List recent sales activities",
  description: "List the most recent sales activities across all leads (calls, emails, notes, status changes).",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 25)"),
    type: z.string().optional().describe("Filter by activity type (e.g. call, email, note)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, type }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("sales_activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Returned ${data?.length ?? 0} activities.` }],
      structuredContent: { activities: data ?? [] },
    };
  },
});
