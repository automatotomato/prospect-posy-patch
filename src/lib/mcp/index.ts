/// <reference path="./env.d.ts" />
import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listLeads from "./tools/list-leads";
import getLead from "./tools/get-lead";
import dashboardStats from "./tools/dashboard-stats";
import recentActivity from "./tools/recent-activity";
import addLeadNote from "./tools/add-lead-note";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "zc-consultants-mcp",
  title: "Z&C Consultants Sales MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Z&C Consultants outbound sales workspace. Use these to look up sales leads, review recent activity, check dashboard stats, and add notes on behalf of the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listLeads, getLead, dashboardStats, recentActivity, addLeadNote],
});
