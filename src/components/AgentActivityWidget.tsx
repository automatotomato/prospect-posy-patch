import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Building2, Mail, Clock } from 'lucide-react';
import { AgentRun } from '@/hooks/useOutreachQueue';

interface AgentActivityWidgetProps {
  agentRuns: AgentRun[];
  pendingEmailCount: number;
  isRunning: boolean;
}

export function AgentActivityWidget({ agentRuns, pendingEmailCount, isRunning }: AgentActivityWidgetProps) {
  const [nextRunCountdown, setNextRunCountdown] = useState('');

  const latestRun = agentRuns[0];
  const isAgentActive = isRunning || latestRun?.status === 'running';

  // Today's stats
  const today = new Date().toISOString().split('T')[0];
  const todayRuns = agentRuns.filter(r => r.run_date === today);
  const businessesFoundToday = todayRuns.reduce((sum, r) => sum + (r.businesses_found || 0), 0);
  const emailsQueuedToday = todayRuns.reduce((sum, r) => sum + (r.emails_generated || 0), 0);

  // Recent runs (last 3 completed)
  const recentRuns = agentRuns.filter(r => r.status === 'completed').slice(0, 3);

  // Countdown timer to next 30-min mark
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const mins = now.getMinutes();
      const nextHalf = mins < 30 ? 30 : 60;
      const remaining = nextHalf - mins;
      setNextRunCountdown(`${remaining}m`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-card to-card/80">
      <CardContent className="p-4 space-y-3">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5 ${isAgentActive ? '' : ''}`}>
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isAgentActive ? 'animate-ping bg-green-400' : ''}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isAgentActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
            </span>
            <span className="font-semibold text-sm">
              {isAgentActive ? 'Agent Active' : 'Agent Idle'}
            </span>
            {latestRun?.search_location && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {latestRun.search_location}
              </span>
            )}
          </div>
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="w-3 h-3" />
            Next: {nextRunCountdown}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span className="text-xs">Found Today</span>
            </div>
            <div className="text-lg font-bold">{businessesFoundToday}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Mail className="w-3.5 h-3.5" />
              <span className="text-xs">Emails Queued</span>
            </div>
            <div className="text-lg font-bold">{emailsQueuedToday}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Mail className="w-3.5 h-3.5" />
              <span className="text-xs">Pending Review</span>
            </div>
            <div className="text-lg font-bold">{pendingEmailCount}</div>
          </div>
        </div>

        {/* Recent runs */}
        {recentRuns.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground font-medium">Recent Runs</span>
            {recentRuns.map(run => (
              <div key={run.id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {run.search_location || 'Unknown'}
                  <span className="text-foreground font-medium">({run.businesses_found} found)</span>
                </span>
                <span>{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
