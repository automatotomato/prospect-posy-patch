import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_INDUSTRIES = [
  'home services','home_services','medical','healthcare','legal','law',
  'auto','automotive','agency','saas','gov','government',
  'plumbing','hvac','electrical','roofing','dental','veterinary',
];
const GENERIC = ['info@','contact@','sales@','support@','hello@','admin@','office@'];

interface ScoreInput {
  status: string;
  industry?: string | null;
  vehicleCount?: number | null;
  notes?: string | null;
  email?: string | null;
  phone?: string | null;
  doNotContact?: boolean;
  unsubscribed?: boolean;
  totalOpens: number;
  totalClicks: number;
  hasReplied: boolean;
  lastReplyAt?: Date | null;
  lastInteractionAt?: Date | null;
  lastEmailBounced?: boolean;
  zeroOpenSendsCount: number;
}

function calculateScore(input: ScoreInput) {
  if (input.doNotContact || input.unsubscribed) {
    return { engagement: 0, intentFit: 0, recency: 0, stageProgress: 0, negative: -100, total: 0, bucket: 'cold' as const };
  }
  const opens = Math.min(input.totalOpens * 5, 15);
  const clicks = Math.min(input.totalClicks * 10, 20);
  const replied = input.hasReplied ? 25 : 0;
  const recentReply = input.lastReplyAt && (Date.now() - input.lastReplyAt.getTime() < 7 * 86400000) ? 5 : 0;
  const engagement = Math.min(opens + clicks + replied + recentReply, 40);

  let intentFit = 0;
  const ind = (input.industry || '').toLowerCase();
  if (TARGET_INDUSTRIES.some(t => ind.includes(t))) intentFit += 10;
  const hiringSignal = (input.notes || '').toLowerCase().match(/hir(e|ing)|recruit|now hiring|join our team/);
  if ((input.vehicleCount && input.vehicleCount >= 3) || hiringSignal) intentFit += 5;
  if (input.email && !GENERIC.some(p => input.email!.toLowerCase().startsWith(p))) intentFit += 5;
  if (input.phone) intentFit += 5;
  intentFit = Math.min(intentFit, 25);

  let recency = 0;
  if (input.lastInteractionAt) {
    const ageDays = (Date.now() - input.lastInteractionAt.getTime()) / 86400000;
    if (ageDays < 1) recency = 20;
    else if (ageDays < 3) recency = 12;
    else if (ageDays < 7) recency = 6;
  }

  const stageMap: Record<string, number> = { new: 0, contacted: 3, responded: 6, qualified: 10, quoted: 15, closed: 0 };
  const stageProgress = stageMap[input.status] ?? 0;

  let negative = 0;
  if (input.lastEmailBounced) negative -= 10;
  if (input.zeroOpenSendsCount >= 3) negative -= 10;

  const total = Math.max(0, Math.min(100, engagement + intentFit + recency + stageProgress + negative));
  const bucket = total >= 70 ? 'hot' : total >= 40 ? 'warm' : 'cold';
  return { engagement, intentFit, recency, stageProgress, negative, total, bucket };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    let prospectIds: string[] | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body?.prospect_ids)) prospectIds = body.prospect_ids;
    } catch { /* no body */ }

    // Fetch prospects (paginated)
    let query = supabase.from('prospects').select('id, status, industry, vehicle_count, notes, email, phone, do_not_contact, unsubscribed');
    if (prospectIds && prospectIds.length > 0) query = query.in('id', prospectIds);
    const { data: prospects, error: pErr } = await query;
    if (pErr) throw pErr;

    let updated = 0;
    for (const p of prospects || []) {
      // Aggregate engagement per prospect
      const { data: emails } = await supabase
        .from('sent_emails')
        .select('open_count, click_count, replied_at, status, sent_at')
        .eq('prospect_id', p.id)
        .order('sent_at', { ascending: false });

      const totalOpens = (emails || []).reduce((s, e: any) => s + (e.open_count || 0), 0);
      const totalClicks = (emails || []).reduce((s, e: any) => s + (e.click_count || 0), 0);
      const replies = (emails || []).filter((e: any) => e.replied_at);
      const hasReplied = replies.length > 0;
      const lastReplyAt = hasReplied ? new Date(replies[0].replied_at) : null;
      const lastEmailBounced = (emails || [])[0]?.status === 'bounced';
      const zeroOpenSendsCount = (emails || []).filter((e: any) => (e.open_count || 0) === 0).length;
      const lastInteractionAt = (emails || [])[0]?.sent_at ? new Date((emails || [])[0].sent_at) : null;

      const score = calculateScore({
        status: p.status,
        industry: p.industry,
        vehicleCount: p.vehicle_count,
        notes: p.notes,
        email: p.email,
        phone: p.phone,
        doNotContact: p.do_not_contact,
        unsubscribed: p.unsubscribed,
        totalOpens,
        totalClicks,
        hasReplied,
        lastReplyAt,
        lastInteractionAt,
        lastEmailBounced,
        zeroOpenSendsCount,
      });

      await supabase
        .from('prospects')
        .update({
          lead_score: score.total,
          score_updated_at: new Date().toISOString(),
          score_breakdown: score,
        })
        .eq('id', p.id);
      updated++;
    }

    return new Response(JSON.stringify({ success: true, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error('recalculate-lead-scores error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
