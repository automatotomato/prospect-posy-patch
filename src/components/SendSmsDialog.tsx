import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, AlertCircle } from 'lucide-react';
import { useSmsTemplates, useTwilioFromNumber, renderSmsTemplate } from '@/hooks/useSms';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Prospect } from '@/types/prospect';
import { Link } from 'react-router-dom';

interface SendSmsDialogProps {
  prospect: Prospect;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendSmsDialog({ prospect, open, onOpenChange }: SendSmsDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates = [] } = useSmsTemplates();
  const { data: fromNumber } = useTwilioFromNumber();
  const [templateId, setTemplateId] = useState<string>('blank');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const vars = useMemo(() => ({
    firstName: prospect.contactName?.split(' ')[0] || 'there',
    businessName: prospect.businessName,
    city: prospect.location?.split(',')[0] || '',
  }), [prospect]);

  useEffect(() => {
    if (!open) return;
    const def = templates.find((t) => t.is_default) || templates[0];
    if (def) {
      setTemplateId(def.id);
      setBody(renderSmsTemplate(def.body, vars));
    } else {
      setTemplateId('blank');
      setBody('');
    }
  }, [open, templates, vars]);

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    if (id === 'blank') {
      setBody('');
      return;
    }
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setBody(renderSmsTemplate(tpl.body, vars));
  };

  const segments = Math.max(1, Math.ceil(body.length / 160));

  const handleSend = async () => {
    if (!body.trim()) {
      toast({ title: 'Empty message', variant: 'destructive' });
      return;
    }
    if (!prospect.phone) {
      toast({ title: 'No phone number on file', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          prospectId: prospect.id,
          toPhone: prospect.phone,
          body,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'Text sent', description: `To ${prospect.phone}` });
      qc.invalidateQueries({ queryKey: ['sent_sms'] });
      qc.invalidateQueries({ queryKey: ['today_sms_stats'] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message || 'Could not send text', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Text {prospect.businessName}</DialogTitle>
          <DialogDescription>
            Sending to {prospect.phone || '— no phone —'} {fromNumber ? `from ${fromNumber}` : ''}
          </DialogDescription>
        </DialogHeader>

        {!fromNumber && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              No Twilio "From" number configured.{' '}
              <Link to="/sms-templates" className="underline font-medium">Set it now</Link>.
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Template</Label>
            <Select value={templateId} onValueChange={handleTemplateChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank message</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.is_default && '· default'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Message</Label>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{body.length} chars</Badge>
                <Badge variant="outline" className="text-[10px]">{segments} segment{segments > 1 ? 's' : ''}</Badge>
              </div>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="mt-1 font-mono text-sm"
              placeholder="Type your text..."
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Variables auto-filled: firstName, businessName, city.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !body.trim() || !prospect.phone || !fromNumber}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
