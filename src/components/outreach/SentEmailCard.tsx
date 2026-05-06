import { Building2, Mail, Eye, MousePointerClick, Clock, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';

interface SentEmail {
  id: string;
  to_email: string;
  subject: string;
  body: string | null;
  sent_at: string;
  open_count: number;
  click_count: number;
  opened_at: string | null;
  clicked_at: string | null;
  status: string;
  replied_at: string | null;
  reply_text?: string | null;
  prospects?: {
    business_name: string;
    location: string;
  } | null;
}

interface SentEmailCardProps {
  email: SentEmail;
  onClick?: () => void;
}

export function SentEmailCard({ email, onClick }: SentEmailCardProps) {
  const hasEngagement = email.open_count > 0 || email.click_count > 0;
  const isHotLead = email.status === 'replied' || !!email.replied_at;

  return (
    <Card 
      className={`hover:shadow-md transition-shadow cursor-pointer ${isHotLead ? 'border-orange-500/40 bg-orange-50/30 dark:bg-orange-950/10' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-medium truncate">
                {email.prospects?.business_name || email.to_email}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{email.to_email}</span>
            </div>
          </div>
          
          {isHotLead ? (
            <Badge variant="default" className="bg-orange-600 hover:bg-orange-700">🔥 Replied</Badge>
          ) : hasEngagement ? (
            <Badge variant="default" className="bg-green-600">Engaged</Badge>
          ) : (
            <Badge variant="secondary">Delivered</Badge>
          )}
        </div>
        
        <p className="text-sm font-medium truncate mb-2">{email.subject}</p>

        {/* Reply preview for hot leads */}
        {isHotLead && email.reply_text && (
          <div className="mb-3 p-2.5 rounded-md bg-orange-100/60 dark:bg-orange-900/20 border border-orange-200/60 dark:border-orange-800/30">
            <div className="flex items-start gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-800 dark:text-orange-300 line-clamp-2">
                "{email.reply_text}"
              </p>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{email.open_count}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MousePointerClick className="h-4 w-4" />
              <span>{email.click_count}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(email.sent_at), { addSuffix: true })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}