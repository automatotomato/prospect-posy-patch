import type { ScoreBreakdown } from '@/types/prospect';

const TARGET_INDUSTRIES = [
  'home services', 'home_services', 'medical', 'healthcare', 'legal', 'law',
  'auto', 'automotive', 'agency', 'saas', 'gov', 'government',
  'plumbing', 'hvac', 'electrical', 'roofing', 'dental', 'veterinary',
];

const GENERIC_EMAIL_PREFIXES = ['info@', 'contact@', 'sales@', 'support@', 'hello@', 'admin@', 'office@'];

export interface ScoringInput {
  status: string;
  industry?: string | null;
  vehicleCount?: number | null;
  notes?: string | null;
  email?: string | null;
  phone?: string | null;
  doNotContact?: boolean;
  unsubscribed?: boolean;
  // engagement aggregates
  totalOpens: number;
  totalClicks: number;
  hasReplied: boolean;
  lastReplyAt?: Date | null;
  lastInteractionAt?: Date | null;
  // negative
  lastEmailBounced?: boolean;
  zeroOpenSendsCount: number;
}

export function calculateLeadScore(input: ScoringInput): ScoreBreakdown {
  // Force-zero for DNC / unsubscribed
  if (input.doNotContact || input.unsubscribed) {
    return { engagement: 0, intentFit: 0, recency: 0, stageProgress: 0, negative: -100, total: 0, bucket: 'cold' };
  }

  // Engagement (max 40)
  const opens = Math.min(input.totalOpens * 5, 15);
  const clicks = Math.min(input.totalClicks * 10, 20);
  const replied = input.hasReplied ? 25 : 0;
  const recentReply = input.lastReplyAt && (Date.now() - input.lastReplyAt.getTime() < 7 * 86400000) ? 5 : 0;
  const engagement = Math.min(opens + clicks + replied + recentReply, 40);

  // Intent / Fit (max 25)
  let intentFit = 0;
  const ind = (input.industry || '').toLowerCase();
  if (TARGET_INDUSTRIES.some(t => ind.includes(t))) intentFit += 10;
  const hiringSignal = (input.notes || '').toLowerCase().match(/hir(e|ing)|recruit|now hiring|join our team/);
  if ((input.vehicleCount && input.vehicleCount >= 3) || hiringSignal) intentFit += 5;
  if (input.email && !GENERIC_EMAIL_PREFIXES.some(p => input.email!.toLowerCase().startsWith(p))) intentFit += 5;
  if (input.phone) intentFit += 5;
  intentFit = Math.min(intentFit, 25);

  // Recency (max 20)
  let recency = 0;
  if (input.lastInteractionAt) {
    const ageMs = Date.now() - input.lastInteractionAt.getTime();
    const ageDays = ageMs / 86400000;
    if (ageDays < 1) recency = 20;
    else if (ageDays < 3) recency = 12;
    else if (ageDays < 7) recency = 6;
  }

  // Stage Progress (max 15)
  const stageMap: Record<string, number> = {
    new: 0, contacted: 3, responded: 6, qualified: 10, quoted: 15, closed: 0,
  };
  const stageProgress = stageMap[input.status] ?? 0;

  // Negative
  let negative = 0;
  if (input.lastEmailBounced) negative -= 10;
  if (input.zeroOpenSendsCount >= 3) negative -= 10;

  const total = Math.max(0, Math.min(100, engagement + intentFit + recency + stageProgress + negative));
  const bucket: 'hot' | 'warm' | 'cold' = total >= 70 ? 'hot' : total >= 40 ? 'warm' : 'cold';

  return { engagement, intentFit, recency, stageProgress, negative, total, bucket };
}
