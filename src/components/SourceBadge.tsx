import { Badge } from '@/components/ui/badge';
import { LeadSource } from '@/types/prospect';
import { Camera, Mail, Users, Globe, Phone, FileSpreadsheet } from 'lucide-react';

interface SourceBadgeProps {
  source: LeadSource;
}

const sourceConfig: Record<LeadSource, { label: string; icon: React.ReactNode }> = {
  field_photo: { label: 'Field Photo', icon: <Camera className="w-3 h-3" /> },
  email: { label: 'Email', icon: <Mail className="w-3 h-3" /> },
  referral: { label: 'Referral', icon: <Users className="w-3 h-3" /> },
  website: { label: 'Website', icon: <Globe className="w-3 h-3" /> },
  cold_call: { label: 'Cold Call', icon: <Phone className="w-3 h-3" /> },
  csv_import: { label: 'CSV Import', icon: <FileSpreadsheet className="w-3 h-3" /> },
};

export function SourceBadge({ source }: SourceBadgeProps) {
  const config = sourceConfig[source];
  return (
    <Badge variant="source" className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}
