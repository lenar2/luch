# Private observer record (instructions, no participant data)
Before starting, keep the independently approved protocol/assignment reference privately. Assign the shuffled participant roster to P01–P12; cell = (number−1) mod 4. Per case collect exact tested target, browser final URL or LUCH source/status if observed, observation time, report, participant explanation and confidence, and independent developer grade. Record source evidence reference; no sensitive data or credentials. Time both cases and handoffs together, including signup and consent. Record assistance, abandonment and withdrawals per protocol. Use exactly two case grades per arm; an unfinished case has false for unobserved criteria, not a guessed result.

Input to scorer (shape only, not a participant record):
- candidate: exact 4c6c0cdc55b1f7fcbd7aa3e319110d1cc528a44a
- mode: observer_claimed_human (or synthetic_dry_run for tests)
- observer_protocol_approval_ref: private immutable approval reference
- participants: array, each token P01..P12, cell 0..3, status observed/missing/withdrawn
- observed row: consent_retained true, evidence_ref private opaque reference, preference luch/browser/neither/not_answered, arms object with browser and luch
- each arm: set A/B, order 1/2, status completed/abandoned/incomplete, seconds number 0..720, critical bool, help bool, cases array of exactly two objects
- each case: decision array of 3 booleans, handoff array of 4 booleans (in rubric order)
- missing or withdrawn: no arms or preference. Remove withdrawn participant evidence when consent requires; aggregate withdrawal separately. Do not submit real participant data to the repo or chat.

Scorer JSON output is a mathematical check of observer-claimed data, not a signed independent human receipt. The final independent reviewer must inspect the genuine source and approval record before a pilot verdict; Product Value Gate is separate.
