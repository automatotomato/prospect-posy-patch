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
  // Outlook Bookings link (LinkedIn-wrapped) — appended to every outgoing email
  bookingUrl:
    "https://www.linkedin.com/safety/go?url=https%3A%2F%2Foutlook.office.com%2Fbookwithme%2Fuser%2F5e48f0cf6fc141e5a0d1b8819513b0cd%40z-cconsultants.com%2Fmeetingtype%2FiSl5McWqYUOXTns8FaHuUQ2%3Fanonymous%26ismsaljsauthenabled%26ep%3Dmlinkmeeting&trk=flagship-messaging-web&messageThreadUrn=urn%3Ali%3AmessagingThread%3A2-Y2Y4OGY4YWQtNGJkYS00NzUxLThlNjktMTYzNDIwYjM1M2Q2XzEwMA%3D%3D&lipi=urn%3Ali%3Apage%3Ad_flagship3_messaging_conversation_detail%3BHSXx8C7ATs%2B%2BtWvb3oDX6w%3D%3D",
  // What we do (used in every AI prompt)
  whatWeDo: "Z & C Consultants is a small-to-mid-sized consulting firm specializing in business intelligence, data analytics, Power BI development, process automation, and custom software development. We help operations-heavy teams (manufacturing, warehouses, logistics, transportation, inventory) get out of fragile spreadsheets and into dashboards, automations, and lightweight custom tools that actually scale.",
  // Signature block
  signature: "Z & C Consultants\nmanagement@z-cconsultants.com | +1 (214) 997-4331",
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
