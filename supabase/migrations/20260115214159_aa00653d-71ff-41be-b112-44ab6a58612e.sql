-- Insert default Automate Planet email templates for each industry category

-- Home Services Templates
INSERT INTO email_templates (name, subject, body, category, is_default)
VALUES 
(
  'Home Services - First Touch',
  'Quick question about missed calls',
  'Hi {{contact_name}},

I work with home service companies that were losing leads to missed calls and slow follow-up.

Now they answer every call instantly, book appointments automatically, and never miss a lead after hours.

Would a 10-minute demo be worth your time? Just reply or call (844) 932-3917.

Alex Perez
Automate Planet
(844) 932-3917',
  'Home Services',
  true
),
(
  'Home Services - Follow Up',
  'Following up on after-hours calls',
  'Hi {{contact_name}},

Wanted to follow up. Many home service businesses miss 30-40% of calls when crews are on jobs or after hours.

Our AI receptionist answers instantly, captures lead info, and books appointments without interrupting your team.

Worth a quick call? (844) 932-3917

Alex Perez
Automate Planet',
  'Home Services',
  false
),

-- Medical/Dental Templates
(
  'Medical/Dental - First Touch',
  'Reducing front desk interruptions',
  'Hi {{contact_name}},

Medical offices we work with were losing patients to hold times and missed calls during busy periods.

Now an AI receptionist handles routine scheduling and questions instantly, so staff can focus on patients in the office.

Would a short demo help? Reply or call (844) 932-3917.

Alex Perez
Automate Planet
(844) 932-3917',
  'Medical/Dental',
  true
),
(
  'Medical/Dental - Follow Up',
  'Quick follow up on patient scheduling',
  'Hi {{contact_name}},

Following up on my note about reducing front desk overload.

Clinics using our AI receptionist book more appointments, answer after-hours calls, and give staff fewer interruptions during patient care.

Happy to show you how it works. (844) 932-3917

Alex Perez
Automate Planet',
  'Medical/Dental',
  false
),

-- Beauty/Wellness Templates
(
  'Beauty/Wellness - First Touch',
  'Never miss a booking request',
  'Hi {{contact_name}},

Salons and spas we work with were missing appointment requests when stylists were with clients or after closing.

Now every call gets answered, appointments get booked automatically, and no lead slips through.

Would a quick demo be helpful? Reply or call (844) 932-3917.

Alex Perez
Automate Planet
(844) 932-3917',
  'Beauty/Wellness',
  true
),
(
  'Beauty/Wellness - Follow Up',
  'Following up on appointment booking',
  'Hi {{contact_name}},

Wanted to follow up. When stylists are busy with clients, calls go to voicemail and bookings get lost.

Our AI receptionist answers instantly, books appointments, and sends confirmations without interrupting anyone.

Worth 10 minutes to see it? (844) 932-3917

Alex Perez
Automate Planet',
  'Beauty/Wellness',
  false
),

-- Professional Services Templates
(
  'Professional Services - First Touch',
  'Capturing leads after hours',
  'Hi {{contact_name}},

Professional service firms we work with were losing potential clients to slow response times and missed calls.

Now leads get qualified instantly, consultations get booked automatically, and no inquiry goes unanswered.

Would a short demo be worth your time? Reply or call (844) 932-3917.

Alex Perez
Automate Planet
(844) 932-3917',
  'Professional Services',
  true
),
(
  'Professional Services - Follow Up',
  'Quick follow up on lead response time',
  'Hi {{contact_name}},

Following up on my note. When prospects call and reach voicemail, they often call the next firm on their list.

Our AI answers instantly, qualifies the inquiry, and books a consultation while the lead is still warm.

Happy to show you. (844) 932-3917

Alex Perez
Automate Planet',
  'Professional Services',
  false
);
