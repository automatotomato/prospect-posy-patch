import { Building2, MapPin, Clock, Check, X, Send, Eye, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { OutreachQueueItem } from '@/hooks/useOutreachQueue';

interface EmailQueueCardProps {
  item: OutreachQueueItem;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onPreview?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onSend?: () => void;
  onRegenerate?: () => void;
  isLoading?: boolean;
  isRegenerating?: boolean;
}

export function EmailQueueCard({
  item,
  isSelected,
  onSelect,
  onPreview,
  onApprove,
  onReject,
  onSend,
  onRegenerate,
  isLoading,
  isRegenerating,
}: EmailQueueCardProps) {
  const getStatusBadge = () => {
    switch (item.status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending Review</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-600">Approved</Badge>;
      case 'sent':
        return <Badge variant="default">Sent</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{item.status}</Badge>;
    }
  };

  return (
    <Card className={cn(
      "hover:shadow-md transition-shadow",
      isSelected && "border-primary ring-1 ring-primary"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {onSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="mt-1"
            />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h3 className="font-medium truncate">
                    {item.prospects?.business_name || 'Unknown Business'}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{item.prospects?.location || item.to_email}</span>
                </div>
              </div>
              {getStatusBadge()}
            </div>
            
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{item.subject}</p>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {item.body.substring(0, 150)}...
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {formatDistanceToNow(new Date(item.generated_at), { addSuffix: true })}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onPreview}>
                  <Eye className="h-4 w-4" />
                </Button>
                
                {(item.status === 'pending' || item.status === 'approved') && onRegenerate && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onRegenerate}
                    disabled={isLoading || isRegenerating}
                    title="Regenerate email with AI"
                  >
                    <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
                  </Button>
                )}
                
                {item.status === 'pending' && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={onReject}
                      disabled={isLoading || isRegenerating}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={onApprove}
                      disabled={isLoading || isRegenerating}
                      className="text-green-600 hover:text-green-600"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </>
                )}
                
                {item.status === 'approved' && (
                  <Button 
                    size="sm" 
                    onClick={onSend}
                    disabled={isLoading || isRegenerating}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
