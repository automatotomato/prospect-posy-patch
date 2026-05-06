import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitePayload {
  email: string;
  name: string;
  role: "admin" | "sales_rep";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-scoped client to verify caller
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for admin actions
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as InvitePayload;
    const email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "").trim();
    const role = body.role === "admin" ? "admin" : "sales_rep";
    if (!email || !name) {
      return new Response(JSON.stringify({ error: "email and name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert allowed_users
    const { error: auErr } = await admin
      .from("allowed_users")
      .upsert({ email, name, role, invited_by: user.id }, { onConflict: "email" });
    if (auErr) throw auErr;

    // Upsert team_members (so admin can assign leads before they accept)
    const { error: tmErr } = await admin
      .from("team_members")
      .upsert(
        { email, name, role: role === "admin" ? "manager" : "agent" },
        { onConflict: "email" }
      );
    if (tmErr) throw tmErr;

    // Send branded invite email via Resend (if configured)
    let emailSent = false;
    if (RESEND_API_KEY) {
      const appUrl = "https://salesai.automateplanet.com";
      const html = `
        <div style="font-family: 'Outfit', Arial, sans-serif; background:#fff; padding:32px 28px; max-width:560px; margin:0 auto; color:#0f172a;">
          <p style="font-size:16px; font-weight:bold; color:hsl(199,89%,35%); margin:0 0 20px;">⚡ Automate Planet</p>
          <h1 style="font-size:22px; margin:0 0 16px;">You've been invited to the Sales CRM</h1>
          <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 24px;">
            ${name}, you've been added as a <strong>${role === "admin" ? "Admin" : "Sales Rep"}</strong>
            on the Automate Planet sales platform. Click below to sign in — you'll receive a one-time code by email.
          </p>
          <a href="${appUrl}/auth?email=${encodeURIComponent(email)}"
             style="display:inline-block; background:hsl(199,89%,35%); color:#fff; font-weight:600; font-size:14px;
                    border-radius:10px; padding:12px 24px; text-decoration:none;">
            Sign in to your account
          </a>
          <p style="font-size:12px; color:#94a3b8; margin:32px 0 0;">
            If you didn't expect this invite, you can safely ignore this email.
          </p>
        </div>`;
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Automate Planet <notify@notify.salesai.automateplanet.com>",
            to: [email],
            subject: "You've been invited to Automate Planet Sales",
            html,
          }),
        });
        emailSent = r.ok;
        if (!r.ok) console.error("Resend error", await r.text());
      } catch (e) {
        console.error("Email send failed", e);
      }
    }

    return new Response(JSON.stringify({ success: true, emailSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("invite-team-member error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
