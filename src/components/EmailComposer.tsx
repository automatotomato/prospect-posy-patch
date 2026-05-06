import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, Wand2, Edit3, Clock, CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEmailTemplates, EmailTemplate } from '@/hooks/useEmailTemplates';
import { format } from 'date-fns';

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId?: string;
  prospectEmail?: string;
  prospectName?: string;
  businessData?: {
    businessName?: string;
    contactName?: string;
    location?: string;
    vehicleCount?: number;
    vehicleTypes?: string[];
    services?: string;
    notes?: string;
  };
}

export function EmailComposer({ 
  open, 
  onOpenChange, 
  prospectId,
  prospectEmail,
  prospectName,
  businessData 
}: EmailComposerProps) {
  const { toast } = useToast();
  const [to, setTo] = useState(prospectEmail || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailType, setEmailType] = useState<'introduction' | 'followup' | 'quote' | 'renewal' | 'metinperson' | 'postcall' | 'campaign_500_free' | 'towing' | 'proposal'>('introduction');
  
  // Scheduling state
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  
  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const { data: templates = [] } = useEmailTemplates();

  // Reset to when email changes
  useEffect(() => {
    if (prospectEmail) {
      setTo(prospectEmail);
    }
  }, [prospectEmail]);

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    let newSubject = template.subject;
    let newBody = template.body;

    // Replace variables
    const replacements: Record<string, string> = {
      '{{businessName}}': businessData?.businessName || prospectName || 'your company',
      '{{contactName}}': businessData?.contactName || 'there',
      '{{location}}': businessData?.location || 'your area',
      '{{vehicleCount}}': businessData?.vehicleCount?.toString() || 'your',
    };

    Object.entries(replacements).forEach(([key, value]) => {
      newSubject = newSubject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
      newBody = newBody.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    setSubject(newSubject);
    setBody(newBody);
    setSelectedTemplateId(templateId);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: { 
          businessData: businessData || { businessName: prospectName },
          emailType 
        }
      });

      if (error) throw error;

      if (data?.data) {
        setSubject(data.data.subject || '');
        setBody(data.data.body || '');
        toast({
          title: "Email generated",
          description: "You can now edit the email before sending.",
        });
      }
    } catch (error) {
      console.error('Generate error:', error);
      toast({
        title: "Generation failed",
        description: "Could not generate email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields before sending.",
        variant: "destructive",
      });
      return;
    }

    if (scheduleForLater) {
      if (!scheduledDate || !scheduledTime) {
        toast({
          title: "Missing schedule",
          description: "Please select a date and time for scheduling.",
          variant: "destructive",
        });
        return;
      }

      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);
      if (scheduledFor <= new Date()) {
        toast({
          title: "Invalid time",
          description: "Scheduled time must be in the future.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSending(true);
    try {
      if (scheduleForLater) {
        const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
        
        const { error } = await supabase.functions.invoke('schedule-email', {
          body: {
            to,
            subject,
            body,
            prospectId,
            emailType,
            scheduledFor,
          }
        });

        if (error) throw error;

        toast({
          title: "Email scheduled!",
          description: `Email will be sent on ${format(new Date(scheduledFor), 'PPp')}`,
        });
      } else {
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            to,
            subject,
            body,
            prospectId,
            emailType,
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: "Email sent!",
          description: `Email sent to ${to}`,
        });
      }
      
      onOpenChange(false);
      // Reset form
      setSubject('');
      setBody('');
      setScheduleForLater(false);
      setScheduledDate('');
      setScheduledTime('09:00');
      setSelectedTemplateId('');
    } catch (error) {
      console.error('Send error:', error);
      const message = error instanceof Error ? error.message : 'Could not send email. Please try again.';
      toast({
        title: "Failed to send",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Get minimum date (today) for the date picker
  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Compose Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email Type Selector */}
          <div className="space-y-2">
            <Label>Email Type</Label>
            <div className="flex flex-wrap gap-2">
              {(['introduction', 'followup', 'quote', 'renewal', 'metinperson', 'postcall', 'campaign_500_free', 'towing', 'proposal'] as const).map((type) => (
                <Button
                  key={type}
                  variant={emailType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEmailType(type)}
                  className="capitalize"
                >
                  {type === 'followup' ? 'Follow-up' : type === 'metinperson' ? 'Met In Person' : type === 'postcall' ? 'Post Call' : type === 'campaign_500_free' ? '🎯 Campaign' : type === 'towing' ? '🚛 Towing' : type === 'proposal' ? '📄 Proposal' : type}
                </Button>
              ))}
            </div>
          </div>

          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Use Template</Label>
              <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* To Field */}
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

          {/* Generate Button */}
          <Button 
            variant="secondary" 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate with AI
              </>
            )}
          </Button>

          {/* Subject Field */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body Field */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Write or generate your email..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="font-mono text-sm resize-none"
            />
          </div>

          {/* Schedule Option */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="scheduleForLater"
                checked={scheduleForLater}
                onCheckedChange={(checked) => setScheduleForLater(checked === true)}
              />
              <label
                htmlFor="scheduleForLater"
                className="text-sm font-medium flex items-center gap-2 cursor-pointer"
              >
                <CalendarClock className="w-4 h-4" />
                Schedule for later
              </label>
            </div>

            {scheduleForLater && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={today}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preview Card */}
          {body && (
            <Card className="p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className="text-sm whitespace-pre-wrap">{body}</div>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || !to || !subject || !body}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {scheduleForLater ? 'Scheduling...' : 'Sending...'}
              </>
            ) : scheduleForLater ? (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Schedule Email
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
