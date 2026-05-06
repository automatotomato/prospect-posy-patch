import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Send, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QuickEmailGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultContext?: string;
  prospectId?: string;
  businessName?: string;
}

export function QuickEmailGenerator({
  open,
  onOpenChange,
  defaultTo = '',
  defaultContext = '',
  prospectId,
  businessName,
}: QuickEmailGeneratorProps) {
  const [to, setTo] = useState(defaultTo);
  const [briefInput, setBriefInput] = useState(defaultContext);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [hasGenerated, setHasGenerated] = useState(false);

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTo(defaultTo);
      setBriefInput(defaultContext);
      setSubject('');
      setBody('');
      setHasGenerated(false);
      setScheduleForLater(false);
    }
    onOpenChange(newOpen);
  };

  const handleGenerate = async () => {
    if (!briefInput.trim()) {
      toast.error('Please describe what you want to say');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('quick-generate-email', {
        body: {
          briefDescription: briefInput,
          recipientEmail: to,
          businessName: businessName,
        },
      });

      if (error) throw error;

      setSubject(data.subject);
      setBody(data.body);
      setHasGenerated(true);
      toast.success('Email generated!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate email');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error('Please enter a recipient email');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error('Please generate an email first');
      return;
    }

    setIsSending(true);
    try {
      if (scheduleForLater && scheduleDate) {
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        const scheduledFor = new Date(scheduleDate);
        scheduledFor.setHours(hours, minutes, 0, 0);

        const { error } = await supabase.functions.invoke('schedule-email', {
          body: {
            to,
            subject,
            body,
            scheduledFor: scheduledFor.toISOString(),
            prospectId,
            emailType: 'quick_compose',
          },
        });

        if (error) throw error;
        toast.success(`Email scheduled for ${format(scheduledFor, 'PPP p')}`);
      } else {
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            to,
            subject,
            body,
            prospectId,
            emailType: 'quick_compose',
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success('Email sent!');
      }

      handleOpenChange(false);
    } catch (error) {
      console.error('Send error:', error);
      const message = error instanceof Error ? error.message : 'Failed to send email';
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Quick Email Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient */}
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {/* Brief Input */}
          <div className="space-y-2">
            <Label htmlFor="brief">What do you want to say?</Label>
            <Textarea
              id="brief"
              placeholder="e.g., follow up on the quote I sent, check in after our call, introduce our services..."
              value={briefInput}
              onChange={(e) => setBriefInput(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Just describe it briefly — AI will expand it into a professional email
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !briefInput.trim()}
            className="w-full"
            variant={hasGenerated ? 'outline' : 'default'}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : hasGenerated ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Email
              </>
            )}
          </Button>

          {/* Generated Email Preview */}
          {hasGenerated && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

          {/* Schedule Option */}
          {hasGenerated && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="schedule">Schedule for later</Label>
                  <p className="text-xs text-muted-foreground">
                    Send at a specific date and time
                  </p>
                </div>
                <Switch
                  id="schedule"
                  checked={scheduleForLater}
                  onCheckedChange={setScheduleForLater}
                />
              </div>

              {scheduleForLater && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'justify-start text-left font-normal flex-1',
                          !scheduleDate && 'text-muted-foreground'
                        )}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {scheduleDate ? format(scheduleDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduleDate}
                        onSelect={setScheduleDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full sm:w-32"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {hasGenerated && (
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {scheduleForLater ? 'Scheduling...' : 'Sending...'}
                </>
              ) : scheduleForLater ? (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Schedule
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Now
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
