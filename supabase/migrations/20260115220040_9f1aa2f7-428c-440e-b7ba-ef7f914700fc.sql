-- Update all email templates with warmer, conversation-starting copy

-- Home Services - First Touch
UPDATE email_templates 
SET 
  subject = 'Quick question for {{business_name}}',
  body = 'Hi {{contact_name}},

I noticed {{business_name}} and wanted to reach out. I help home service companies use AI to handle calls, follow up with leads, and keep things running when crews are out on jobs.

Not sure if it''s a fit, but happy to share what''s worked for others in your space.

Call or text me anytime.

Alex Perez
Automate Planet
(702) 863-3200 (call or text)
AutomatePlanet.com',
  updated_at = now()
WHERE name = 'Home Services - First Touch' OR (category = 'home_services' AND name ILIKE '%first%touch%');

-- Home Services - Follow Up
UPDATE email_templates 
SET 
  subject = 'Following up',
  body = 'Hi {{contact_name}},

Wanted to circle back. If you''re ever curious how AI could help with calls or lead follow-up, I''m happy to walk you through it.

No pressure, just a conversation.

Alex Perez
Automate Planet
(702) 863-3200 (call or text)
AutomatePlanet.com',
  updated_at = now()
WHERE name = 'Home Services - Follow Up' OR (category = 'home_services' AND name ILIKE '%follow%up%');

-- Medical/Dental - First Touch
UPDATE email_templates 
SET 
  subject = 'Quick idea for {{business_name}}',
  body = 'Hi {{contact_name}},

I work with medical and dental offices on AI projects, everything from automated scheduling to custom patient dashboards.

Would love to learn more about how {{business_name}} handles things now. Open to a quick chat?

Alex Perez
Automate Planet
(702) 863-3200 (call or text)
AutomatePlanet.com',
  updated_at = now()
WHERE name = 'Medical/Dental - First Touch' OR (category = 'medical_dental' AND name ILIKE '%first%touch%');

-- Medical/Dental - Follow Up
UPDATE email_templates 
SET 
  subject = 'Checking in',
  body = 'Hi {{contact_name}},

Just following up. If front desk workload or after-hours calls ever become a pain point, I''d be happy to share some ideas.

Alex Perez
Automate Planet
(702) 863-3200 (call or text)
AutomatePlanet.com',
  updated_at = now()
WHERE name = 'Medical/Dental - Follow Up' OR (category = 'medical_dental' AND name ILIKE '%follow%up%');

-- Beauty/Wellness - First Touch
UPDATE email_templates 
SET 
  subject = 'Idea for {{business_name}}',
  body = 'Hi {{contact_name}},

I help salons and spas implement AI for booking, follow-ups, and client communication. Curious if that''s something {{business_name}} has explored.

Happy to share what''s worked for others. Call or text anytime.

Alex Perez
Automate Planet
(702) 863-3200 (call or text)
AutomatePlanet.com',
  updated_at = now()
WHERE name = 'Beauty/Wellness - First Touch' OR (category = 'beauty_wellness' AND name ILIKE '%first%touch%');

-- Beauty/Wellness - Follow Up
UPDATE email_templates 
SET 
  subject = 'Quick follow up',
  body = 'Hi {{contact_name}},

Just wanted to check in. If you ever want to explore AI for handling bookings or client follow-ups, I''m around.

Alex Perez
Automate Planet
(702) 863-3200 (call or text)
AutomatePlanet.com',
  updated_at = now()
WHERE name = 'Beauty/Wellness - Follow Up' OR (category = 'beauty_wellness' AND name ILIKE '%follow%up%');

-- Professional Services - First Touch
UPDATE email_templates 
SET 
  subject = 'Quick thought for {{business_name}}',
  body = 'Hi {{contact_name}},

I work with professional service firms on AI projects. That includes answering calls, qualifying leads, and building custom tools and dashboards.

Not sure what you''re working on, but happy to share ideas if helpful.

Alex Perez
Automate Planet
(702) 863-3200 (call or text)
AutomatePlanet.com',
  updated_at = now()
WHERE name = 'Professional Services - First Touch' OR (category = 'professional_services' AND name ILIKE '%first%touch%');

-- Professional Services - Follow Up
UPDATE email_templates 
SET 
  subject = 'Following up',
  body = 'Hi {{contact_name}},

Circling back in case timing is better now. If you''re ever curious about AI for lead handling or internal tools, I''d love to chat.

Alex Perez
Automate Planet
(702) 863-3200 (call or text)
AutomatePlanet.com',
  updated_at = now()
WHERE name = 'Professional Services - Follow Up' OR (category = 'professional_services' AND name ILIKE '%follow%up%');