import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MessageSquare, Send, Edit, X, Loader2 } from 'lucide-react';
import { useReplyIntents, useUpdateReplyIntent, type ReplyIntent } from '@/hooks/useReplyIntents';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const INTENT_CONFIG: Record<string, { label: string; cls: string }> = {
  interested:           { label: 'Interested',         cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  objection_price:      { label: 'Price objection',    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  objection_timing:     { label: 'Timing objection',   cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  objection_authority:  { label: 'Wrong contact',      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  objection_fit:        { label: 'Not a fit',          cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  referral:             { label: 'Referral',           cls: 'bg-primary/10 text-primary border-primary/30' },
  question:             { label: 'Question',           cls: 'bg-secondary text-secondary-foreground' },
};

export function RepliesWaitingWidget() {
  const { data: intents, isLoading } = useReplyIntents();
  const updateIntent = useUpdateReplyIntent();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ReplyIntent | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleSend = async (intent: ReplyIntent, subject: string, body: string) => {
    if (!intent.prospects?.email) {
      toast({ title: 'No email address', variant: 'destructive' });
      return;
    }
    setSendingId(intent.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: intent.prospects.email,
          subject,
          body,
          prospect_id: intent.prospect_id,
          email_type: 'reply',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await updateIntent.mutateAsync({ id: intent.id, status: 'used' });
      toast({ title: 'Reply sent', description: `To ${intent.prospects.business_name}` });
      setEditing(null);
    } catch (e) {
      toast({
        title: 'Failed to send',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSendingId(null);
    }
  };

  const openEdit = (intent: ReplyIntent) => {
    setEditing(intent);
    setEditSubject(intent.suggested_subject || '');
    setEditBody(intent.suggested_body || '');
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4 text-primary" />
            Replies Waiting
            {intents && <span className="text-xs text-muted-foreground ml-auto">{intents.length}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
          {isLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : intents && intents.length > 0 ? (
            intents.map((intent) => {
              const cfg = INTENT_CONFIG[intent.intent] || { label: intent.intent, cls: 'bg-muted' };
              return (
                <div key={intent.id} className="p-3 rounded-lg border border-border/50 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm truncate">
                        {intent.prospects?.business_name || 'Unknown'}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(intent.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>{cfg.label}</Badge>
                  </div>
                  {intent.inbound_body && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2">"{intent.inbound_body}"</p>
                  )}
                  {intent.suggested_body && (
                    <div className="text-xs bg-muted/40 rounded p-2 line-clamp-3">{intent.suggested_body}</div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {intent.suggested_body && intent.prospects?.email && (
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() => handleSend(intent, intent.suggested_subject || '', intent.suggested_body || '')}
                        disabled={sendingId === intent.id}
                      >
                        {sendingId === intent.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><Send className="w-3 h-3 mr-1" />Send draft</>}
                      </Button>
                    )}
                    {intent.suggested_body && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(intent)}>
                        <Edit className="w-3 h-3 mr-1" />Edit
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => updateIntent.mutate({ id: intent.id, status: 'dismissed' })}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No replies waiting. AI will draft responses as they come in.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit & send reply</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Subject" />
            <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={8} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => editing && handleSend(editing, editSubject, editBody)}
              disabled={sendingId !== null || !editSubject || !editBody}
            >
              {sendingId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
