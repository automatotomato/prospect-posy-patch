
-- Painpoint-driven follow-up rules
-- Each rule is anchored to a specific angle from the painpoint library

-- Step 1: no_response → Angle 1 (wasted ad spend)
UPDATE public.follow_up_rules
SET name = 'Painpoint #1 - Wasted Ad Spend',
    ai_context = 'ANGLE: Wasted ad spend. Open with the moment: they''re paying Google or Facebook to make the phone ring, then the call hits voicemail. Use a real number: $40-$200 per missed service call. One sentence painpoint, one sentence reframe (our AI picks up in under a second), one CTA line. Owner-language: ad, call, voicemail, lost. No "follow up" words.'
WHERE id = '4eaeb2e4-9d11-4252-964b-6bc5b69dc453';

-- Step 1: opened_not_clicked → Angle 2 (lost to next listing)
UPDATE public.follow_up_rules
SET name = 'Opened - Lost To Next Listing',
    ai_context = 'ANGLE: Lost to the next listing. They opened it, didn''t act. Open with: homeowners don''t leave voicemails anymore, they scroll to the next name on Google and call them. First to answer wins the job. Reframe: our AI is that first answer, 24/7, in under a second. Owner-language: Google, next on the list, competitor.'
WHERE id = '74f4be13-0677-4c99-929f-5f46275196f2';

-- Step 1: not_opened → Angle 6 (speed-to-lead)
UPDATE public.follow_up_rules
SET name = 'Not Opened - Speed To Lead',
    ai_context = 'ANGLE: Speed-to-lead math. Brand new subject (3-5 words, lowercase, curious, no "demo/AI/free"). Lead with the stat: the first business to answer wins ~50% of the time, voicemail tag wins almost none. Then the offer in one line. 2-3 sentences total. Don''t reference the prior email.'
WHERE id = '6728b819-a9f5-47d3-9ae7-a648d5f3cb6d';

-- Step 1: clicked → Angle 10 (risk-free reversal, warm)
UPDATE public.follow_up_rules
SET name = 'Clicked - Risk Free Demo Line',
    ai_context = 'ANGLE: Risk-free reversal, warm. They clicked, they''re curious. Acknowledge briefly without being weird. Offer: we set up a real phone number tied to THEIR business, they call it, hear it work, decide from there. No credit card, no commitment. CTA: call or text Alex (702) 863-3200 or book the Calendly link to get the line live today.'
WHERE id = '844d9f81-5f1b-4be3-8a7a-35c7e9c19966';

-- Step 2: no_response → Angle 3 (after-hours leak)
UPDATE public.follow_up_rules
SET name = 'Painpoint #2 - After Hours Leak',
    ai_context = 'ANGLE: After-hours and weekend leak. Open with the stat: 60-70% of service calls come outside 9-5. If the office is closed, that''s pure revenue walking to a competitor with a 24/7 line. Reframe: our AI never closes, never sleeps. One CTA. Owner-language: after hours, weekends, evenings, walking away.'
WHERE id = '45bbf142-8d21-4f3e-ac83-37a79867913c';

-- Step 3: no_response → Angle 4 (VA / call-center cost reframe)
UPDATE public.follow_up_rules
SET name = 'Painpoint #3 - VA Cost Reframe',
    ai_context = 'ANGLE: VA / call-center cost reframe. Open with the math: a VA runs $1,500-$3,000/mo and STILL misses calls when they''re on lunch or another line. Our AI is a fraction of that, never sick, never on break, handles unlimited calls at the same time. Always include a dollar number. Owner-language: payroll, lunch break, sick day.'
WHERE id = '014ac21d-4e7d-4dcc-bb92-e3d790f545e4';

-- Step 4: no_response → Angle 5 (crew on truck) + win story
UPDATE public.follow_up_rules
SET name = 'Painpoint #4 - Crew On The Truck',
    ai_context = 'ANGLE: Crew on the truck = phone unanswered. Open with the moment: when your guys are on a job, on a roof, under a sink, in a truck, the phone rings and rings. Add a 1-2 sentence customer-win story for a similar business (use generic "a shop like yours"). Our AI books the next job while they finish this one. Owner-language: crew, truck, job, jobsite.'
WHERE id = '504fde59-c157-46cf-a51a-2b3ed353a7a9';

-- Step 5: no_response → Angle 7 or 8 (industry-aware: storm surge OR Spanish-speaking)
UPDATE public.follow_up_rules
SET name = 'Painpoint #5 - Surge Or Languages',
    ai_context = 'ANGLE: Pick the better fit based on industry. For trades (HVAC, roofing, plumbing, pest, electrical): storm/seasonal surge — when weather hits, call volume 5x''s, your team can''t 5x, our AI handles the surge and books the jobs. For high-immigrant metros or service businesses: Spanish-speaking customers — if they hit an English voicemail they hang up and call the next shop, our AI handles 72 languages live. Pick ONE angle, don''t mention both.'
WHERE id = 'd4338836-7dbd-40b6-beea-b42ef9c928fa';

-- Step 6: no_response → Friendly breakup
UPDATE public.follow_up_rules
SET name = 'Painpoint #6 - Friendly Breakup',
    ai_context = 'ANGLE: Friendly breakup. You won''t fill their inbox anymore, door is open. Leave the cell: call or text Alex (702) 863-3200 anytime. Mention the risk-free demo line is always available, no credit card. Warm, no guilt. 3-4 sentences max. No P.S. needed if it gets repetitive.'
WHERE id = 'c0b08acb-2acf-4d5f-a878-4093341c4e98';
