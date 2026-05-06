import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Eye, MessageSquare, MousePointerClick } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { CallLog } from '@/hooks/useCallLogs';
import { SentEmail } from '@/hooks/useSentEmails';

interface TimelineEntry {
  id: string;
  date: Date;
  type: 'call' | 'email_sent' | 'email_opened' | 'email_replied' | 'email_clicked';
  title: string;
  subtitle?: string;
  meta?: string;
}

interface UnifiedActivityTimelineProps {
  callLogs: CallLog[];
  sentEmails: SentEmail[];
  isLoading?: boolean;
}

export function UnifiedActivityTimeline({ callLogs, sentEmails, isLoading }: UnifiedActivityTimelineProps) {
  const entries = useMemo(() => {
    const items: TimelineEntry[] = [];

    // Add call logs
    for (const call of callLogs) {
      items.push({
        id: `call-${call.id}`,
        date: new Date(call.called_at),
        type: 'call',
        title: `Call — ${call.outcome.replace(/_/g, ' ')}`,
        subtitle: call.notes || undefined,
        meta: call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : undefined,
      });
    }

    // Add sent emails
    for (const email of sentEmails) {
      items.push({
        id: `email-${email.id}`,
        date: new Date(email.sent_at),
        type: 'email_sent',
        title: email.subject,
        subtitle: email.to_email,
      });

      if (email.opened_at) {
        items.push({
          id: `opened-${email.id}`,
          date: new Date(email.opened_at),
          type: 'email_opened',
          title: `Opened: ${email.subject}`,
          meta: `${email.open_count} open${email.open_count !== 1 ? 's' : ''}`,
        });
      }

      if (email.replied_at) {
        items.push({
          id: `replied-${email.id}`,
          date: new Date(email.replied_at),
          type: 'email_replied',
          title: `Reply received: ${email.subject}`,
        });
      }

      if (email.clicked_at) {
        items.push({
          id: `clicked-${email.id}`,
          date: new Date(email.clicked_at),
          type: 'email_clicked',
          title: `Link clicked: ${email.subject}`,
          meta: `${email.click_count} click${email.click_count !== 1 ? 's' : ''}`,
        });
      }
    }

    // Sort newest first
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items;
  }, [callLogs, sentEmails]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm">No activity yet</p>
        <p className="text-xs mt-1">Calls and emails will appear here</p>
      </div>
    );
  }

  const iconMap = {
    call: Phone,
    email_sent: Mail,
    email_opened: Eye,
    email_replied: MessageSquare,
    email_clicked: MousePointerClick,
  };

  const colorMap = {
    call: 'text-blue-500 bg-blue-500/10',
    email_sent: 'text-muted-foreground bg-muted',
    email_opened: 'text-amber-500 bg-amber-500/10',
    email_replied: 'text-primary bg-primary/10',
    email_clicked: 'text-emerald-500 bg-emerald-500/10',
  };

  return (
    <div className="space-y-1.5">
      {entries.slice(0, 15).map((entry) => {
        const Icon = iconMap[entry.type];
        return (
          <div key={entry.id} className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-muted/30 transition-colors">
            <div className={cn("p-1.5 rounded-md shrink-0 mt-0.5", colorMap[entry.type])}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm break-words">{entry.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(entry.date, { addSuffix: true })}
                </span>
                {entry.meta && (
                  <span className="text-[11px] text-muted-foreground">• {entry.meta}</span>
                )}
              </div>
              {entry.subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{entry.subtitle}</p>
              )}
            </div>
          </div>
        );
      })}
      {entries.length > 15 && (
        <p className="text-xs text-muted-foreground text-center py-1">
          + {entries.length - 15} more activities
        </p>
      )}
    </div>
  );
}
