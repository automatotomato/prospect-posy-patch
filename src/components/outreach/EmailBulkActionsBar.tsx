import { useState } from 'react';
import { X, Check, Send, CheckSquare, Loader2, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface EmailBulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  currentTab: string;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onApproveAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  onSendAll: () => Promise<void>;
  onDripSend?: () => Promise<void>;
  isLoading: boolean;
  dripIntervalMinutes?: number;
}

export function EmailBulkActionsBar({
  selectedCount,
  totalCount,
  currentTab,
  onClearSelection,
  onSelectAll,
  onApproveAll,
  onRejectAll,
  onSendAll,
  onDripSend,
  isLoading,
  dripIntervalMinutes = 5,
}: EmailBulkActionsBarProps) {
  const [sendMode, setSendMode] = useState<'drip' | 'immediate'>('drip');
  
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount && totalCount > 0;
  
  // Calculate drip time estimate
  const totalMinutes = (selectedCount - 1) * dripIntervalMinutes + 1;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeEstimate = hours > 0 
    ? `${hours}h ${minutes}m` 
    : `${minutes} min`;

  const handleSend = async () => {
    if (sendMode === 'drip' && onDripSend) {
      await onDripSend();
    } else {
      await onSendAll();
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-background border border-border rounded-lg shadow-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="outline"
          size="sm"
          onClick={onSelectAll}
          disabled={allSelected}
        >
          <CheckSquare className="h-4 w-4 mr-1" />
          Select All ({totalCount})
        </Button>

        <div className="h-4 w-px bg-border" />

        {currentTab === 'pending' && (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="text-destructive hover:text-destructive"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-1" />
                  )}
                  Reject All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject {selectedCount} emails?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark all selected emails as rejected. They won't be sent.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRejectAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Reject All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Approve All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve {selectedCount} emails?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark all selected emails as approved and ready to send.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onApproveAll}>
                    Approve All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {currentTab === 'approved' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Send {selectedCount} Emails
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Send {selectedCount} emails</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose how you'd like to send these emails.
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <RadioGroup
                value={sendMode}
                onValueChange={(value) => setSendMode(value as 'drip' | 'immediate')}
                className="space-y-3 py-4"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="drip" id="drip" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="drip" className="flex items-center gap-2 cursor-pointer font-medium">
                      <Clock className="h-4 w-4 text-primary" />
                      Drip Send (Recommended)
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send 1 email every {dripIntervalMinutes} minutes to avoid spam filters.
                    </p>
                    <p className="text-sm text-primary mt-1 font-medium">
                      Total time: ~{timeEstimate}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="immediate" id="immediate" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="immediate" className="flex items-center gap-2 cursor-pointer font-medium">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Send Immediately
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send all emails at once. May trigger spam filters for large batches.
                    </p>
                  </div>
                </div>
              </RadioGroup>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSend}>
                  {sendMode === 'drip' ? (
                    <>
                      <Clock className="h-4 w-4 mr-1" />
                      Schedule Drip Send
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Send Now
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
