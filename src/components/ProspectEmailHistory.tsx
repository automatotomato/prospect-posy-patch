import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Mail, ChevronDown, Eye, MousePointerClick, MessageSquare, Clock, Send } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProspectEmailHistoryProps {
  prospectId: string;
}

export function ProspectEmailHistory({ prospectId }: ProspectEmailHistoryProps) {
  const { data: sentEmails = [], isLoading: sentLoading } = useQuery({
    queryKey: ['prospect-sent-emails', prospectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sent_emails')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: queuedEmails = [], isLoading: queuedLoading } = useQuery({
    queryKey: ['prospect-queued-emails', prospectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_queue')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('generated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = sentLoading || queuedLoading;
  const totalCount = sentEmails.length + queuedEmails.length;

  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Emails</h3>
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Emails (0)</h3>
        <Card className="p-3">
          <p className="text-sm text-muted-foreground">No emails sent yet.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Emails ({totalCount})
      </h3>
      <div className="space-y-2">
        {/* Queued/Pending emails */}
        {queuedEmails.filter(e => e.status !== 'sent').map((email) => (
          <Collapsible key={`q-${email.id}`}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger className="w-full p-3 flex items-start gap-3 text-left hover:bg-muted/50 transition-colors">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{email.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {email.status === 'scheduled' ? 'Scheduled' : 'Pending'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {email.generated_at && format(new Date(email.generated_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground mb-1">To: {email.to_email}</p>
                  <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-48 overflow-y-auto">
                    {email.body}
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}

        {/* Sent emails */}
        {sentEmails.map((email) => (
          <Collapsible key={`s-${email.id}`}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger className="w-full p-3 flex items-start gap-3 text-left hover:bg-muted/50 transition-colors">
                <Send className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{email.subject}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      Sent
                    </Badge>
                    {email.open_count > 0 && (
                      <Badge variant="outline" className={cn("text-[10px] gap-0.5", "text-emerald-600 border-emerald-200")}>
                        <Eye className="w-2.5 h-2.5" />
                        {email.open_count}
                      </Badge>
                    )}
                    {email.click_count > 0 && (
                      <Badge variant="outline" className={cn("text-[10px] gap-0.5", "text-blue-600 border-blue-200")}>
                        <MousePointerClick className="w-2.5 h-2.5" />
                        {email.click_count}
                      </Badge>
                    )}
                    {email.replied_at && (
                      <Badge variant="outline" className={cn("text-[10px] gap-0.5", "text-amber-600 border-amber-200")}>
                        <MessageSquare className="w-2.5 h-2.5" />
                        Replied
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(email.sent_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground mb-1">To: {email.to_email}</p>
                  <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-48 overflow-y-auto">
                    {email.body || 'No body stored.'}
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
