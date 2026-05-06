import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { SendSmsDialog } from '@/components/SendSmsDialog';
import { Prospect } from '@/types/prospect';
import { Link } from 'react-router-dom';

export function SmsQueueWidget() {
  const { data: leads = [] } = useQuery({
    queryKey: ['sms_queue'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: prospects, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('do_not_contact', false)
        .eq('unsubscribed', false)
        .not('phone', 'is', null)
        .in('status', ['new', 'called', 'responded'])
        .order('lead_score', { ascending: false })
        .limit(30);
      if (error) throw error;
      if (!prospects?.length) return [];

      const ids = prospects.map((p: any) => p.id);
      const { data: recent } = await supabase
        .from('sent_sms' as any)
        .select('prospect_id, sent_at')
        .in('prospect_id', ids)
        .gte('sent_at', sevenDaysAgo.toISOString());
      const recentIds = new Set((recent || []).map((r: any) => r.prospect_id));

      return prospects.filter((p: any) => !recentIds.has(p.id)).slice(0, 8);
    },
    refetchInterval: 60000,
  });

  const [active, setActive] = useState<Prospect | null>(null);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h3 className="font-display font-semibold text-sm">Texts to Send</h3>
          <Badge variant="secondary" className="text-[10px]">{leads.length}</Badge>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
          <Link to="/sms-templates">Templates<ArrowRight className="w-3 h-3" /></Link>
        </Button>
      </div>

      {leads.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">All caught up. No texts pending.</p>
      ) : (
        <div className="space-y-1.5">
          {leads.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.business_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{p.phone} · {p.location}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => setActive({
                  id: p.id,
                  businessName: p.business_name,
                  contactName: p.contact_name,
                  phone: p.phone,
                  email: p.email,
                  location: p.location,
                  status: p.status,
                  source: p.source,
                  assignedTo: p.assigned_to,
                  createdAt: new Date(p.created_at),
                  notes: p.notes || '',
                  movedToQuoting: p.moved_to_quoting,
                  tasks: [],
                } as Prospect)}
              >
                <MessageSquare className="w-3 h-3 mr-1" /> Text
              </Button>
            </div>
          ))}
        </div>
      )}

      {active && (
        <SendSmsDialog
          prospect={active}
          open={!!active}
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
    </Card>
  );
}
