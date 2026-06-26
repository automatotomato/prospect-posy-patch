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

const APP_URL = "https://zcconsultants.automateplanet.com";

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

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is admin
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
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

    // Upsert allowed_users + team_members (so admin can assign leads before they accept)
    const { error: auErr } = await admin
      .from("allowed_users")
      .upsert({ email, name, role, invited_by: user.id }, { onConflict: "email" });
    if (auErr) throw auErr;

    const { error: tmErr } = await admin
      .from("team_members")
      .upsert(
        { email, name, role: role === "admin" ? "manager" : "agent" },
        { onConflict: "email" }
      );
    if (tmErr) throw tmErr;

    // Ensure an auth user exists so they can set a password. Generate a one-time
    // recovery link they'll use to land on /sales/set-password.
    const redirectTo = `${APP_URL}/sales/set-password`;
    let actionLink: string | null = null;
    let userExists = false;

    // Try to find existing user
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);

    if (!existing) {
      // Create user with random password; they'll set their own via recovery link
      const tempPw = crypto.randomUUID() + "Aa1!";
      const { error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPw,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (createErr) {
        console.error("createUser error", createErr);
      }
    } else {
      userExists = true;
    }

    // Generate recovery link (works for both new and existing users)
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (linkErr) {
      console.error("generateLink error", linkErr);
    } else {
      actionLink = linkData?.properties?.action_link || null;
    }

    // Send branded invite email via Resend
    let emailSent = false;
    if (RESEND_API_KEY && actionLink) {
      const safeLink = actionLink.replace(/&/g, "&amp;");
      const html = `
        <div style="font-family: 'Outfit', Arial, sans-serif; background:#fff; padding:32px 28px; max-width:560px; margin:0 auto; color:#0f172a;">
          <p style="font-size:16px; font-weight:bold; color:hsl(199,89%,35%); margin:0 0 20px;">Z &amp; C Consultants</p>
          <h1 style="font-size:22px; margin:0 0 16px;">${userExists ? "Reset your password" : "You've been invited to the Sales CRM"}</h1>
          <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 24px;">
            ${name}, ${userExists
              ? "use the secure link below to set a new password and sign in."
              : `you've been added as a <strong>${role === "admin" ? "Admin" : "Sales Rep"}</strong> on the Z &amp; C Consultants sales platform. Click below to create your password and sign in.`}
          </p>
          <a href="${safeLink}"
             style="display:inline-block; background:hsl(199,89%,35%); color:#fff; font-weight:600; font-size:14px;
                    border-radius:10px; padding:12px 24px; text-decoration:none;">
            ${userExists ? "Set new password" : "Set up your password"}
          </a>
          <p style="font-size:12px; color:#94a3b8; margin:32px 0 0;">
            This link expires shortly for security. If you didn't expect this email, you can ignore it.
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
            from: "Z & C Consultants <marketing@z-cconsultants.com>",
            to: [email],
            subject: userExists
              ? "Reset your Z & C Consultants password"
              : "You've been invited to Z & C Consultants Sales",
            html,
          }),
        });
        emailSent = r.ok;
        if (!r.ok) console.error("Resend error", await r.text());
      } catch (e) {
        console.error("Email send failed", e);
      }
    }

    return new Response(JSON.stringify({ success: true, emailSent, hasLink: !!actionLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("invite-team-member error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
