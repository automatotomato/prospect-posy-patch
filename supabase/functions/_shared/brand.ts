// Centralized brand constants for Z & C Consultants outreach.
// Keep all sender identity, phone, and value-prop copy here so a single edit
// propagates to every email-generating edge function.

export const BRAND = {
  companyName: "Z & C Consultants",
  shortName: "Z&C",
  tagline: "Business intelligence, data analytics, and process automation for operations-heavy teams.",
  // Sender
  senderName: "Z & C Consultants",
  senderEmail: "management@z-cconsultants.com",
  senderDomain: "z-cconsultants.com",
  replyTo: "management@z-cconsultants.com",
  fromHeader: "Z & C Consultants <management@z-cconsultants.com>",
  // Contact
  phone: "+1 (214) 997-4331",
  email: "management@z-cconsultants.com",
  // What we do (used in every AI prompt)
  whatWeDo: "Z & C Consultants is a small-to-mid-sized consulting firm specializing in business intelligence, data analytics, Power BI development, process automation, and custom software development. We help operations-heavy teams (manufacturing, warehouses, logistics, transportation, inventory) get out of fragile spreadsheets and into dashboards, automations, and lightweight custom tools that actually scale.",
  // Signature block (no Calendly per user preference)
  signature: "Z & C Consultants\nmanagement@z-cconsultants.com | +1 (214) 997-4331",
  // CTA — phone + email only, no calendar link
  cta: "Reply to this email or call/text +1 (214) 997-4331 if you'd like to compare notes on what is currently slowing your team down.",
  // Targeting
  targetVerticals: [
    "manufacturing",
    "warehouse",
    "logistics",
    "transportation",
    "freight",
    "distribution",
    "wholesale",
    "3PL",
    "inventory management",
    "supply chain",
  ],
  excludedKeywords: [
    "health", "hospital", "clinic", "dental", "medical", "pharma", "pharmacy",
    "insurance", "insurer", "wellness", "chiropract", "physician", "doctor",
    "veterinary", "nursing", "rehab", "therapy", "cosmetic", "dermatol",
  ],
};
