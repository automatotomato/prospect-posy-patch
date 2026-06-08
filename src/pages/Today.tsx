import { useEffect } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { HotLeadsWidget } from '@/components/today/HotLeadsWidget';
import { RepliesWaitingWidget } from '@/components/today/RepliesWaitingWidget';
import { FollowUpsDueWidget } from '@/components/today/FollowUpsDueWidget';
import { DemosTodayWidget } from '@/components/today/DemosTodayWidget';
import { DailyGoalCard } from '@/components/today/DailyGoalCard';
import { CallQueueWidget } from '@/components/today/CallQueueWidget';
import { SmsQueueWidget } from '@/components/today/SmsQueueWidget';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowUpsDue, useTodayDemos } from '@/hooks/useTodayData';
import { useReplyIntents } from '@/hooks/useReplyIntents';
import { useTodayCallStats } from '@/hooks/useDailyActivity';
import { useTodayEmailStats, useTodaySmsStats } from '@/hooks/useChannelStats';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Phone, Mail, MessageSquare, RefreshCw, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function Today() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: callStats } = useTodayCallStats();
  const { data: emailStats } = useTodayEmailStats();
  const { data: smsStats } = useTodaySmsStats();
  const { data: due } = useFollowUpsDue();
  const { data: replies } = useReplyIntents();
  const { data: demos } = useTodayDemos();

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('prospects')
        .select('id', { count: 'exact', head: true })
        .gt('lead_score', 0);
      if (!cancelled && (count === 0 || count === null)) {
        supabase.functions.invoke('recalculate-lead-scores', { body: {} }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRecalc = async () => {
    toast({ title: 'Recalculating scores...' });
    const { error } = await supabase.functions.invoke('recalculate-lead-scores', { body: {} });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else toast({ title: 'Scores updated' });
  };

  const channels = [
    { icon: Phone, label: 'Calls', value: callStats?.total ?? 0, goal: callStats?.goal ?? 50, cls: 'text-primary', barCls: 'bg-primary', bg: 'bg-primary/10' },
    { icon: Mail, label: 'Emails', value: emailStats?.total ?? 0, goal: 30, cls: 'text-emerald-500', barCls: 'bg-emerald-500', bg: 'bg-emerald-500/10' },
    { icon: MessageSquare, label: 'Texts', value: smsStats?.total ?? 0, goal: 20, cls: 'text-amber-500', barCls: 'bg-amber-500', bg: 'bg-amber-500/10' },
  ];

  const inboxCount = (replies?.length ?? 0) + (due?.length ?? 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold">
              {greeting}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, MMM d')} · 50 dials, every reply answered
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleRecalc} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" />Recalculate scores
            </Button>
            <Button size="sm" variant="ghost" asChild className="gap-1">
              <Link to="/pipeline">Pipeline<ArrowRight className="w-3.5 h-3.5" /></Link>
            </Button>
          </div>
        </div>

        <DailyGoalCard />

        {/* Tri-channel KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {channels.map((c) => {
            const pct = Math.min(100, Math.round((c.value / c.goal) * 100));
            return (
              <Card key={c.label} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('p-2 rounded-lg', c.bg, c.cls)}>
                      <c.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">{c.label} today</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{c.value} / {c.goal}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">{c.value}</span>
                  <span className="text-xs text-muted-foreground">{pct}% of daily goal</span>
                </div>
                <div className="h-1.5 mt-3 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full transition-all', c.barCls)} style={{ width: `${pct}%` }} />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Inbox row */}
        <Card className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-medium">Inbox</div>
              <div className="text-[11px] text-muted-foreground">
                {replies?.length ?? 0} replies · {due?.length ?? 0} follow-ups due · {demos?.length ?? 0} demos
              </div>
            </div>
          </div>
          <span className="text-2xl font-semibold tabular-nums">{inboxCount}</span>
        </Card>

        {/* Primary action queues */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CallQueueWidget />
          <SmsQueueWidget />
          <RepliesWaitingWidget />
        </div>

        {/* Secondary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <HotLeadsWidget />
          <FollowUpsDueWidget />
          <DemosTodayWidget />
        </div>
      </main>
    </div>
  );
}
