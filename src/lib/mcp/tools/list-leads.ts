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
  name: "list_sales_leads",
  title: "List sales leads",
  description:
    "List sales leads. Optionally filter by stage (new, queued, contacted, responded, qualified, won, lost), industry, or a search string that matches business_name/contact_name/email. Ordered by most recently created.",
  inputSchema: {
    stage: z.string().optional().describe("Lead stage/status filter"),
    industry: z.string().optional().describe("Industry filter (exact match)"),
    search: z.string().optional().describe("Substring search on business_name, contact_name, or email"),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ stage, industry, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb.from("sales_leads").select("*").order("created_at", { ascending: false }).limit(limit ?? 50);
    if (stage) q = q.eq("status", stage);
    if (industry) q = q.eq("industry", industry);
    if (search) q = q.or(`business_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} leads.` }],
      structuredContent: { leads: data ?? [] },
    };
  },
});
