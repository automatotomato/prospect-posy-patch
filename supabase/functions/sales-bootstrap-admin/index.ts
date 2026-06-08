import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ADMIN_EMAIL = "management@z-cconsultants.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const password = Deno.env.get("SALES_ADMIN_PASSWORD");
  if (!password) {
    return new Response(JSON.stringify({ error: "SALES_ADMIN_PASSWORD not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceKey);

  // Find existing user
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const existing = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);

  let userId: string;
  if (existing) {
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password, email_confirm: true,
    });
    if (updErr) return new Response(JSON.stringify({ error: updErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL, password, email_confirm: true,
    });
    if (createErr) return new Response(JSON.stringify({ error: createErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    userId = created.user.id;
  }

  return new Response(JSON.stringify({ ok: true, userId, email: ADMIN_EMAIL }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
