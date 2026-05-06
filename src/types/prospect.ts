export type ProspectStatus = 'new' | 'called' | 'contacted' | 'responded' | 'qualified' | 'quoted' | 'closed';

export type LeadSource = 'field_photo' | 'email' | 'referral' | 'website' | 'cold_call' | 'csv_import';

export interface ScoreBreakdown {
  engagement: number;
  intentFit: number;
  recency: number;
  stageProgress: number;
  negative: number;
  total: number;
  bucket: 'hot' | 'warm' | 'cold';
}

export interface Prospect {
  id: string;
  businessName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  location: string;
  vehicleCount?: number;
  vehicleTypes?: string[];
  notes: string;
  status: ProspectStatus;
  source: LeadSource;
  assignedTo: string;
  createdAt: Date;
  nextFollowUp?: Date;
  imageUrl?: string;
  movedToQuoting: boolean;
  tasks: Task[];
  doNotContact?: boolean;
  doNotContactReason?: string;
  website?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  yelpUrl?: string;
  industry?: string;
  leadScore?: number;
  scoreBreakdown?: ScoreBreakdown;
  scoreUpdatedAt?: Date;
}

export interface Task {
  id: string;
  type: 'call' | 'email' | 'text' | 'follow_up';
  description: string;
  dueDate: Date;
  completed: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'agent' | 'va' | 'manager';
  avatar?: string;
}
