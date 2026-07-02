import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const nowIso = new Date().toISOString();
    const results: Record<string, number> = {};

    // 1) Leads that DO have touches but are still stage='new' → 'contacted'
    const { data: toContacted, error: e1 } = await supabase
      .from('sales_leads')
      .select('id')
      .eq('stage', 'new')
      .or('contact_count.gt.0,last_contacted_at.not.is.null');
    if (e1) throw e1;
    if (toContacted && toContacted.length) {
      const ids = toContacted.map((r: any) => r.id);
      const { error } = await supabase
        .from('sales_leads')
        .update({ stage: 'contacted', last_activity_at: nowIso })
        .in('id', ids);
      if (error) throw error;
    }
    results.moved_to_contacted = toContacted?.length ?? 0;

    // 2) Leads that are stage='new' with NO touches → 'queued'
    const { data: toQueued, error: e2 } = await supabase
      .from('sales_leads')
      .select('id')
      .eq('stage', 'new')
      .eq('contact_count', 0)
      .is('last_contacted_at', null);
    if (e2) throw e2;
    if (toQueued && toQueued.length) {
      const ids = toQueued.map((r: any) => r.id);
      const { error } = await supabase
        .from('sales_leads')
        .update({ stage: 'queued', queued_at: nowIso, last_activity_at: nowIso })
        .in('id', ids);
      if (error) throw error;
    }
    results.moved_to_queued = toQueued?.length ?? 0;

    // 3) Backfill queued_at for any 'queued' rows missing it
    const { data: missingQueuedAt, error: e3 } = await supabase
      .from('sales_leads')
      .select('id')
      .eq('stage', 'queued')
      .is('queued_at', null);
    if (e3) throw e3;
    if (missingQueuedAt && missingQueuedAt.length) {
      const ids = missingQueuedAt.map((r: any) => r.id);
      const { error } = await supabase
        .from('sales_leads')
        .update({ queued_at: nowIso })
        .in('id', ids);
      if (error) throw error;
    }
    results.backfilled_queued_at = missingQueuedAt?.length ?? 0;

    return new Response(
      JSON.stringify({ ok: true, ran_at: nowIso, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('reconcile-lead-statuses error', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
