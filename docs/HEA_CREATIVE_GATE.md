# LUCH — Independent HEA Creative Release Gate v1.0

**7 November 2026 · public human-experience release policy.**
[Canonical Russian](HEA_CREATIVE_GATE.ru.md) · [Review packet](HEA_REVIEW_PACKET.md)

## My bar
I am building LUCH for a different quality of human work with AI. **Working code, correct links, positive self-review and an already published page are not proof of excellent Human Experience.**

A public experience qualifies only when a first-time visitor **understands the real benefit in 10 seconds, wants to try it and sees a truthful first action**. Otherwise: **HOLD**, even when engineering QA passes.

Applies to the site, GitHub entry READMEs, host integration pages, onboarding, images, demos and public marketplace copy.

## G0 · Proof before presentation
Before writing copy or designing visuals, show one real human job: **need → authorized resources → observed work → actual outcome → primary evidence**. No fictional completion marks, fabricated customers, cross-client execution claims or private founder details. A possible use case is called a *scenario*, not evidence. Public product voice is **my first person**, never invented verbatim quotes.

## G1 · Six independent creative scores (0–4)

| Dimension | Visitor experience |
| --- | --- |
| **Clarity** | Know in 10 seconds what LUCH is for |
| **Desire** | Want the outcome for their own task |
| **Difference** | See real connected action beyond an AI answer |
| **Trust** | Distinguish proven work from designed scenarios and future claims |
| **First action** | Find a real, non-circular path to begin |
| **Craft** | Distinct composition, powerful language, visual clarity, accessible experience |

0 = deceptive or harmful; 1 = confusing; 2 = usable but uninspiring; 3 = convincing; 4 = remarkable with concrete observed reasons. **Pass: all six ≥3; Desire and Difference must be 4.** No averaging failures. The author cannot independently approve their own work.

## G2 · Unprompted cold experience
At least **five genuine new target-audience visitors**, not involved in production, see an **exact-version rendered preview** for 10 seconds without coaching. Record verbatim: “What is this?”, “What would you get?”, “Where would you click first?”, “Would you want to try it, and why?”. Observe the actual first click.

Minimum **4/5** understand the concrete benefit, **4/5** find a meaningful first action, **4/5** independently want to try for a specific reason. A critical false impression about access, outcome or provenance blocks release until corrected. No actual participants means `NOT_RUN`, not a fictional PASS. This is a qualitative gate, not a population conversion estimate.

## G3 · Independent veto
The critic must not have authored, edited or been responsible for shipping the candidate. They review the **exact SHA** and rendered page without the author's sales pitch. A non-author observer records the cold test; the critic can also be that observer.

`GO` needs **(a)** documented six-axis critique from an identifiable reviewer account other than the author; **(b)** the real five-person cold-test record; **(c)** my explicit authorization for the same SHA. A peer-bus nickname, AI label or self-generated second answer is not proof of independence. A critical veto means `REWORK/NO_GO`. Editing public copy, design or CTA resets affected approval.

## G4 · Evidence, render and engineering
Inspect actual render at **320 / 390 / 768 / 1440px**: legibility, no overflow, visible CTA, keyboard interactions, contrast, alt text and language parity. Verify all result links, permission/status statements and honest connection paths. Engineering QA (links, build, HTTP, rollback) is necessary but never substitutes for creative review. This does not claim WCAG certification.

## Decision
`DRAFT → AUTHOR_REWORK → INDEPENDENT_CRITIQUE → COLD_TEST → FOUNDER_GO → PUBLISH → POST_RELEASE_CHECK`

Default is **HOLD**. Missing evidence or a failed gate means **NO_GO**. Rework occurs on a separate branch, followed by new review. A narrowly scoped urgent security fix that adds no public claims may be separately documented but is not a route around experience review. [Review form](HEA_REVIEW_PACKET.md).

## Enforcement limitation
All four public LUCH repositories currently have **no active GitHub rulesets** protecting `main`, and the connected GitHub tool cannot change repository administration settings. Therefore this is a **mandatory manual release hold, not a technical push lock**.

Authorized admins must independently enable PR-only updates, prohibit direct/force pushes, require an actual non-author approval, block author bypass, and test the rule. **No GitHub Actions.**

HEA R1–R4 are published with technical evidence but have **no independently evidenced G1–G3 PASS**. Do not approve them retroactively. **Next public experience release: HOLD.**
