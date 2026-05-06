export interface ExtractedLeadData {
  businessName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  vehicleCount: number | null;
  vehicleTypes: string[] | null;
  services: string | null;
  notes: string | null;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  preview: string;
}
