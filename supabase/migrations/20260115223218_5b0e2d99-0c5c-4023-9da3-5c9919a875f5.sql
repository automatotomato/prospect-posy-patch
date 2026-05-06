
-- Insert new "Met In Person" follow-up template
INSERT INTO email_templates (name, subject, body, category, is_default)
VALUES (
  'Met In Person - Follow Up',
  'Great meeting you',
  E'{{contact_name}},\n\nGreat meeting you today. As promised, here''s my info.\n\nI''m the founder of Automate Planet. We build AI systems for service businesses:\n\n• AI Phone Agents that answer calls 24/7 and book appointments\n• AI Sales Agents that follow up with leads automatically\n• Custom websites and business dashboards\n\nIf any of that sounds useful down the road, I''d love to help.\n\nCheck us out: AutomatePlanet.com\n\nAlex Perez\nFounder, Automate Planet\n(702) 863-3200 (call or text)\nAutomatePlanet.com',
  'Met In Person',
  true
);
