import { Bot, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow } from 'date-fns';
import { AgentRun } from '@/hooks/useOutreachQueue';
import { ScheduleSettings } from '@/hooks/useAgentSettings';

interface AgentStatusCardProps {
  lastRun?: AgentRun;
  schedule?: ScheduleSettings;
  isRunning?: boolean;
  onRunNow?: () => void;
}

export function AgentStatusCard({ lastRun, schedule, isRunning, onRunNow }: AgentStatusCardProps) {
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNextRunTime = () => {
    if (!schedule?.enabled) return 'Disabled';
    
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(schedule.hour, schedule.minute, 0, 0);
    
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    return `Tomorrow at ${format(nextRun, 'h:mm a')} ${schedule.timezone}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Outreach Agent
        </CardTitle>
        <Badge variant={schedule?.enabled ? 'default' : 'secondary'}>
          {schedule?.enabled ? 'Active' : 'Paused'}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {lastRun && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {getStatusIcon(lastRun.status || undefined)}
                <span className="text-muted-foreground">Last run</span>
              </div>
              <span>
                {formatDistanceToNow(new Date(lastRun.created_at), { addSuffix: true })}
              </span>
            </div>
          )}
          
          {lastRun && lastRun.status === 'completed' && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="font-semibold">{lastRun.businesses_found || 0}</div>
                <div className="text-xs text-muted-foreground">Found</div>
              </div>
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="font-semibold">{lastRun.emails_generated || 0}</div>
                <div className="text-xs text-muted-foreground">Emails</div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Next run</span>
            </div>
            <span className="text-xs">{getNextRunTime()}</span>
          </div>
          
          <Button 
            onClick={onRunNow} 
            disabled={isRunning}
            className="w-full"
            size="sm"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              'Run Now'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
