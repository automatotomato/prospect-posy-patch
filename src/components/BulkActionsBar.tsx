import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  X, 
  CheckSquare, 
  Mail, 
  ChevronDown, 
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { ProspectStatus, Prospect } from '@/types/prospect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BulkActionsBarProps {
  selectedIds: string[];
  prospects: Prospect[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  onStatusChange: (ids: string[], status: ProspectStatus) => Promise<void>;
  totalCount: number;
}

const statusLabels: Record<ProspectStatus, string> = {
  new: 'New',
  called: 'Called',
  contacted: 'Contacted',
  responded: 'Responded',
  qualified: 'Qualified',
  quoted: 'Quoted',
  closed: 'Closed',
};

export function BulkActionsBar({
  selectedIds,
  prospects,
  onClearSelection,
  onSelectAll,
  onStatusChange,
  totalCount,
}: BulkActionsBarProps) {
  const { toast } = useToast();
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailType, setEmailType] = useState('introduction');
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  const selectedProspects = prospects.filter(p => selectedIds.includes(p.id));
  const prospectsWithEmail = selectedProspects.filter(p => p.email && p.email.includes('@'));

  const handleStatusChange = async (status: ProspectStatus) => {
    setIsChangingStatus(true);
    try {
      await onStatusChange(selectedIds, status);
      toast({
        title: "Status updated",
        description: `Changed ${selectedIds.length} prospects to ${statusLabels[status]}.`,
      });
      onClearSelection();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status.",
        variant: "destructive",
      });
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleBatchEmail = async () => {
    if (prospectsWithEmail.length === 0) {
      toast({
        title: "No emails",
        description: "None of the selected prospects have email addresses.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmails(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-send-emails', {
        body: {
          prospects: prospectsWithEmail.map(p => ({
            id: p.id,
            businessName: p.businessName,
            contactName: p.contactName,
            email: p.email,
            location: p.location,
            vehicleCount: p.vehicleCount,
            notes: p.notes,
          })),
          emailType,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Emails sent!",
          description: `Sent ${data.summary.sent} of ${data.summary.total} emails.`,
        });
        setShowEmailDialog(false);
        onClearSelection();
      }
    } catch (error) {
      console.error('Batch email error:', error);
      toast({
        title: "Email failed",
        description: "Could not send batch emails.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmails(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-semibold">
            {selectedIds.length} selected
          </Badge>
          <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-7 px-2">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
          className="text-xs h-7"
        >
          <CheckSquare className="w-4 h-4 mr-1" />
          Select all ({totalCount})
        </Button>

        <div className="h-6 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isChangingStatus} className="h-8">
              {isChangingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Change Status
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {Object.entries(statusLabels).map(([status, label]) => (
              <DropdownMenuItem
                key={status}
                onClick={() => handleStatusChange(status as ProspectStatus)}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="default"
          size="sm"
          onClick={() => setShowEmailDialog(true)}
          className="h-8"
        >
          <Mail className="w-4 h-4 mr-2" />
          Send Emails
        </Button>
      </div>

      {/* Batch Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send Batch Emails
            </DialogTitle>
            <DialogDescription>
              Send emails to {prospectsWithEmail.length} prospects with email addresses.
              {prospectsWithEmail.length < selectedIds.length && (
                <span className="text-muted-foreground">
                  {' '}({selectedIds.length - prospectsWithEmail.length} without emails will be skipped)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Type</Label>
              <Select value={emailType} onValueChange={setEmailType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="introduction">Introduction</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBatchEmail} disabled={isSendingEmails || prospectsWithEmail.length === 0}>
              {isSendingEmails ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send {prospectsWithEmail.length} Emails
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
