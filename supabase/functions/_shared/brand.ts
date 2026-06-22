// Centralized brand constants for Z & C Consultants outreach.
// Keep all sender identity, phone, and value-prop copy here so a single edit
// propagates to every email-generating edge function.

export const BRAND = {
  companyName: "Z & C Consultants",
  shortName: "Z&C",
  tagline: "Business intelligence, data analytics, and process automation for operations-heavy teams.",
  // Sender
  senderName: "Z & C Consultants",
  senderEmail: "marketing@z-cconsultants.com",
  senderDomain: "z-cconsultants.com",
  replyTo: "marketing@z-cconsultants.com",
  fromHeader: "Z & C Consultants <marketing@z-cconsultants.com>",
  // Contact
  phone: "+1 (214) 997-4331",
  email: "marketing@z-cconsultants.com",
  // Microsoft Bookings link — appended to every outgoing email
  bookingUrl:
    "https://bookings.cloud.microsoft/bookwithme/user/5e48f0cf6fc141e5a0d1b8819513b0cd%40z-cconsultants.com/meetingtype/iSl5McWqYUOXTns8FaHuUQ2?anonymous&ismsaljsauthenabled",
  // What we do (used in every AI prompt)
  whatWeDo: "Z & C Consultants is a small-to-mid-sized consulting firm specializing in business intelligence, data analytics, Power BI development, process automation, and custom software development. We help operations-heavy teams (manufacturing, warehouses, logistics, transportation, inventory) get out of fragile spreadsheets and into dashboards, automations, and lightweight custom tools that actually scale.",
  // Signature block
  signature: "Z & C Consultants\nmarketing@z-cconsultants.com | +1 (214) 997-4331",
  // CTA — phone + email + booking link
  cta: "Reply, call/text +1 (214) 997-4331, or grab a 15-min slot directly on my calendar.",
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
