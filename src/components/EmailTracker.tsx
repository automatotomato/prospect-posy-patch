import { Mail, Eye, MousePointerClick, MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProspectEmailStats } from '@/hooks/useProspectEmailStats';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  prospectId: string;
  /** Compact = small inline pills (kanban card). Full = large stat strip. */
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Visual email tracker for a single prospect.
 * Shows sent / opened / clicked / replied with semantic colors.
 */
export function EmailTracker({ prospectId, variant = 'compact', className }: Props) {
  const { data: stats, isLoading } = useProspectEmailStats(prospectId);

  if (isLoading || !stats) return null;
  if (stats.sent === 0 && variant === 'compact') return null;

  if (variant === 'compact') {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('inline-flex items-center gap-1', className)}>
              <Pill icon={<Mail className="w-3 h-3" />} value={stats.sent} cls="bg-primary/10 text-primary border-primary/20" />
              {stats.opened > 0 && (
                <Pill icon={<Eye className="w-3 h-3" />} value={stats.opened} cls="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" />
              )}
              {stats.clicked > 0 && (
                <Pill icon={<MousePointerClick className="w-3 h-3" />} value={stats.clicked} cls="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" />
              )}
              {stats.replied > 0 && (
                <Pill icon={<MessageSquare className="w-3 h-3" />} value={stats.replied} cls="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="font-medium mb-1">Email activity</div>
            <div>{stats.sent} sent · {stats.opened} opened ({stats.openRate}%)</div>
            <div>{stats.clicked} clicked · {stats.replied} replied</div>
            {stats.lastSentAt && (
              <div className="text-muted-foreground mt-1">
                Last sent {formatDistanceToNow(new Date(stats.lastSentAt), { addSuffix: true })}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // FULL variant — stat strip
  const cells = [
    { icon: Mail, label: 'Sent', value: stats.sent, cls: 'text-primary' },
    { icon: Eye, label: `Opened${stats.sent ? ` · ${stats.openRate}%` : ''}`, value: stats.opened, cls: 'text-emerald-500' },
    { icon: MousePointerClick, label: `Clicked${stats.sent ? ` · ${stats.clickRate}%` : ''}`, value: stats.clicked, cls: 'text-violet-500' },
    { icon: MessageSquare, label: 'Replied', value: stats.replied, cls: 'text-amber-500' },
  ];

  return (
    <div className={cn('grid grid-cols-4 gap-2', className)}>
      {cells.map((c) => (
        <div key={c.label} className="rounded-lg border border-border/60 bg-card p-2.5">
          <div className={cn('flex items-center gap-1.5', c.cls)}>
            <c.icon className="w-3.5 h-3.5" />
            <span className="text-xl font-semibold tabular-nums text-foreground">{c.value}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
            {c.label}
          </div>
        </div>
      ))}
      {stats.lastSentAt && (
        <div className="col-span-4 text-[11px] text-muted-foreground -mt-1">
          Last sent {formatDistanceToNow(new Date(stats.lastSentAt), { addSuffix: true })}
          {stats.bounced > 0 && (
            <span className="ml-2 text-destructive">· {stats.bounced} bounced</span>
          )}
        </div>
      )}
    </div>
  );
}

function Pill({ icon, value, cls }: { icon: React.ReactNode; value: number; cls: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0 text-[10px] font-medium tabular-nums', cls)}>
      {icon}
      {value}
    </span>
  );
}
